# ==================================================
# HeartLink AI Server - main.py
# --------------------------------------------------
# 역할:
# 1. ECG 파일 수신 (백엔드 → AI 서버)
# 2. 전처리 (preprocessing.py)
# 3. 모델 추론 (predictor.py)
# 4. 분석 결과 반환 (백엔드 → MongoDB 저장)
# 5. 리포트 생성 (Gemini API → 백엔드 → MongoDB 저장)
# 6. TTS 음성 변환 (Google Cloud TTS → 백엔드 → 프론트)
#
# 엔드포인트:
# GET  /         → 서버 실행 확인
# GET  /health   → 백엔드 연결 상태 확인
# POST /analyze  → ECG 분석 메인 엔드포인트
# POST /report   → 리포트 생성 엔드포인트
# POST /tts      → TTS 음성 변환 엔드포인트
# ==================================================

import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response


def _is_number(s: str) -> bool:
    try:
        float(s.strip())
        return True
    except ValueError:
        return False

from services.preprocessing import preprocess_ecg
from services.predictor import predict
from services.report_generator import generate_report
from services.tts_service import text_to_speech

app = FastAPI(
    title="HeartLink AI Server",
    version="0.1.0"
)


@app.get("/")
def root():
    """
    서버 실행 확인용 API
    """
    return {"message": "HeartLink AI Server Running"}


@app.get("/health")
def health_check():
    """
    백엔드 연결 상태 확인용 API
    """
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(
    file: UploadFile = File(...),
    measurement_id: str = Form(...),
    user_id: str = Form(...),
    age: int = Form(default=70),
    gender: str = Form(default='F'),
    medical_history: str = Form(default=''),  # 쉼표로 구분된 문자열로 받기
    sampling_rate: int = Form(default=250),   # 원본 샘플링 레이트 (MIT-BIH: 360, 갤럭시워치: 250)
):
    """
    ECG 분석 메인 엔드포인트

    백엔드 aiService.js에서 multipart/form-data로 요청
    - file           : ECG 파일 (CSV)
    - measurement_id : 측정 ID
    - user_id        : 유저 ID
    - age            : 나이 (위험도 보정용)
    - gender         : 성별 (위험도 보정용)
    - medical_history: 과거력 (쉼표 구분, 위험도 보정용)

    Returns
    -------
    JSON: AnalysisResult 스키마와 동일한 형식
    """
    try:
        # 파일 읽기
        contents = await file.read()

        # CSV 파싱 → numpy 배열
        csv_text = contents.decode('utf-8')
        lines    = csv_text.strip().split('\n')

        # 첫 줄이 헤더인지 숫자 데이터인지 판별
        first_cols = [c.strip().strip("'\"") for c in lines[0].split(',')]
        is_header  = any(not _is_number(v) for v in first_cols)

        if is_header:
            headers    = [h.lower() for h in first_cols]
            data_lines = lines[1:]
        else:
            headers    = []
            data_lines = lines

        # ECG 신호 컬럼 찾기 (헤더가 있으면 이름으로, 없으면 나중에 분산으로 결정)
        candidates = ['ecg', 'y', 'value', 'signal', 'mv', 'mlii', 'v5', 'v1', 'v2']
        y_idx = next((i for i, h in enumerate(headers) if h in candidates), None)

        # 모든 컬럼 파싱
        all_rows = []
        for line in data_lines:
            cols = line.split(',')
            row  = []
            for c in cols:
                try:
                    row.append(float(c.strip()))
                except ValueError:
                    row.append(float('nan'))
            if row:
                all_rows.append(row)

        if not all_rows:
            raise HTTPException(status_code=400, detail="ECG 데이터가 없습니다.")

        # 행 길이를 최빈값으로 통일한 뒤 numpy 배열로 변환
        max_cols   = max(len(r) for r in all_rows)
        data_arr   = np.full((len(all_rows), max_cols), np.nan, dtype=np.float32)
        for i, row in enumerate(all_rows):
            data_arr[i, :len(row)] = row

        if y_idx is None:
            # 헤더 매칭 실패 → 분산이 가장 큰 컬럼 선택 (단조 증가하는 타임스탬프 컬럼 방지)
            if max_cols == 1:
                y_idx = 0
            else:
                col_stds = np.nanstd(data_arr, axis=0)
                y_idx    = int(np.argmax(col_stds))

        signal_raw = data_arr[:, y_idx]
        signal_raw = signal_raw[~np.isnan(signal_raw)]

        if len(signal_raw) < 100:
            raise HTTPException(status_code=400, detail="ECG 데이터가 너무 적습니다.")

        signal_raw = signal_raw.astype(np.float32)

        # 전처리 (실제 sampling_rate 전달)
        preprocessed = preprocess_ecg(signal_raw, fs_original=sampling_rate)

        # 모델 추론 + 위험도 산출
        medical_history_list = medical_history.split(',') if medical_history else []

        result = predict(
            ecg_beat        = preprocessed['beat'],
            ecg_window      = preprocessed['window'],
            hrv_features    = preprocessed['hrv_features'],
            heart_rate      = preprocessed['heart_rate'],
            age             = age,
            gender          = gender,
            medical_history = medical_history_list,
            r_peaks         = preprocessed['r_peaks'],
        )

        return {
            "measurement_id":    measurement_id,
            "user_id":           user_id,
            "arrhythmia_class":  result['arrhythmia_class'],
            "arrhythmia_prob":   result['arrhythmia_prob'],
            "af_detected":       result['af_detected'],
            "af_prob":           result['af_prob'],
            "heart_rate":        round(result['heart_rate']),
            "hrv_rmssd":         result['hrv_rmssd'],
            "hrv_sdnn":          result['hrv_sdnn'],
            "hrv_lfhf":          result['hrv_lfhf'],
            "anomaly_detected":  result['anomaly_detected'],
            "arrhythmia_count":  result['arrhythmia_count'],
            "risk_score":        result['risk_score'],
            "risk_level":        result['risk_level'],
            "analyzed_at":       result['analyzed_at'],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/report")
async def report(
    analysis_id:      str   = Form(...),
    user_id:          str   = Form(...),
    age:              int   = Form(default=70),
    gender:           str   = Form(default='F'),
    medical_history:  str   = Form(default=''),
    arrhythmia_class: str   = Form(default='N'),
    arrhythmia_prob:  float = Form(default=0.0),
    af_detected:      bool  = Form(default=False),
    af_prob:          float = Form(default=0.0),
    hrv_rmssd:        float = Form(default=0.0),
    hrv_sdnn:         float = Form(default=0.0),
    hrv_lfhf:         float = Form(default=1.0),
    anomaly_detected: bool  = Form(default=False),
    risk_score:       int   = Form(default=0),
    risk_level:       str   = Form(default='low'),
    heart_rate:       float = Form(default=75.0),
):
    """
    리포트 생성 엔드포인트
    백엔드 generateReport에서 호출
    AnalysisResult 데이터 + 유저 정보 받아서 Gemini로 리포트 생성

    - analysis_id    : 분석 결과 ID
    - user_id        : 유저 ID (MCP 과거 데이터 조회용)
    - age            : 나이
    - gender         : 성별
    - medical_history: 과거력 (쉼표 구분)
    - 나머지          : AnalysisResult 데이터

    Returns
    -------
    JSON:
        - report_text_user    : 고령자용 메시지
        - report_text_guardian: 보호자용 메시지
        - recommended_action  : 핵심 권장 조치 한 줄
    """
    try:
        medical_history_list = medical_history.split(',') if medical_history else []

        analysis_result = {
            'arrhythmia_class': arrhythmia_class,
            'arrhythmia_prob':  arrhythmia_prob,
            'af_detected':      af_detected,
            'af_prob':          af_prob,
            'hrv_rmssd':        hrv_rmssd,
            'hrv_sdnn':         hrv_sdnn,
            'hrv_lfhf':         hrv_lfhf,
            'anomaly_detected': anomaly_detected,
            'risk_score':       risk_score,
            'risk_level':       risk_level,
            'heart_rate':       heart_rate,
        }

        result = await generate_report(
            analysis_result = analysis_result,
            age             = age,
            gender          = gender,
            medical_history = medical_history_list,
            user_id         = user_id,
        )

        return result

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/tts")
async def tts(
    text:  str = Form(...),
    speed: int = Form(default=1),  # 0=느리게, 1=보통, 2=빠르게
):
    """
    TTS 음성 변환 엔드포인트
    텍스트 → mp3 음성 변환 (Google Cloud TTS)

    - text : 변환할 텍스트 (고령자용 리포트)
    - speed: 속도 (0=느리게, 1=보통, 2=빠르게)
             프론트 슬라이더 값과 동일

    Returns
    -------
    mp3 오디오 파일 (bytes)
    """
    try:
        audio_bytes = await text_to_speech(text=text, speed=speed)
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg"
        )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))