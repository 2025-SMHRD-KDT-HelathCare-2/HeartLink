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

from services.preprocessing import preprocess_ecg, downsample_for_storage
from services.predictor import predict
from services.report_generator import generate_report
from services.tts_service import text_to_speech


def _parse_ecg_signal(contents: bytes) -> np.ndarray:
    """CSV bytes → signal_raw ndarray. Apple Watch / MIT-BIH 포맷 공통 처리."""
    csv_text = contents.decode('utf-8')
    lines    = csv_text.strip().split('\n')
    signal_raw = None

    data_start_idx = None
    for i, line in enumerate(lines[:30]):
        stripped = line.strip()
        if stripped and _is_number(stripped):
            data_start_idx = i
            break

    if data_start_idx is not None and data_start_idx > 0:
        ecg_values = []
        for i in range(data_start_idx, len(lines)):
            stripped = lines[i].strip()
            if stripped and _is_number(stripped):
                ecg_values.append(float(stripped))
        signal_raw = np.array(ecg_values, dtype=np.float32)
    else:
        first_cols = [c.strip().strip("'\"") for c in lines[0].split(',')]
        is_header  = any(not _is_number(v) for v in first_cols)
        if is_header:
            headers    = [h.lower() for h in first_cols]
            data_lines = lines[1:]
        else:
            headers    = []
            data_lines = lines

        candidates = ['ecg', 'y', 'value', 'signal', 'mv', 'mlii', 'v5', 'v1', 'v2']
        y_idx = next((i for i, h in enumerate(headers) if h in candidates), None)

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

        max_cols = max(len(r) for r in all_rows)
        data_arr = np.full((len(all_rows), max_cols), np.nan, dtype=np.float32)
        for i, row in enumerate(all_rows):
            data_arr[i, :len(row)] = row

        if y_idx is None:
            if max_cols == 1:
                y_idx = 0
            else:
                col_stds = np.nanstd(data_arr, axis=0)
                col_stds = np.where(np.isnan(col_stds), -1.0, col_stds)
                y_idx    = int(np.argmax(col_stds))

        signal_raw = data_arr[:, y_idx]
        signal_raw = signal_raw[~np.isnan(signal_raw)]

    if signal_raw is None or len(signal_raw) < 100:
        raise HTTPException(status_code=400, detail="ECG 데이터가 너무 적습니다.")

    return signal_raw.astype(np.float32)


def _build_waveforms(filtered_signal: np.ndarray) -> dict:
    """필터링된 250Hz 신호 → ecg_waveform_full / ecg_waveform_lite 딕셔너리."""
    signal_lightweight = downsample_for_storage(filtered_signal, fs_original=250, target_fs=80)
    return {
        "ecg_waveform_full": filtered_signal.tolist(),
        "ecg_waveform_lite": signal_lightweight.tolist(),
    }


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


@app.post("/analyze/preview")
async def analyze_preview(
    file: UploadFile = File(...),
    sampling_rate: int = Form(default=250),
):
    """
    ECG 파형 빠른 미리보기 엔드포인트 (모델 추론 없음)

    분석 결과가 도착하기 전에 파형을 먼저 화면에 표시할 때 사용.
    리샘플링 + 밴드패스 필터까지만 실행하므로 /analyze보다 훨씬 빠름.

    Returns
    -------
    JSON: { ecg_waveform_full, ecg_waveform_lite }
    """
    try:
        contents     = await file.read()
        signal_raw   = _parse_ecg_signal(contents)
        preprocessed = preprocess_ecg(signal_raw, fs_original=sampling_rate)
        return _build_waveforms(preprocessed['filtered_signal'])
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


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
    JSON: AnalysisResult 스키마와 동일한 형식 + ecg_waveform_full/lite
    """
    try:
        contents     = await file.read()
        signal_raw   = _parse_ecg_signal(contents)
        preprocessed = preprocess_ecg(signal_raw, fs_original=sampling_rate)

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

        waveforms = _build_waveforms(preprocessed['filtered_signal'])

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
            **waveforms,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/report")
async def report(
    analysis_id:             str   = Form(...),
    user_id:                 str   = Form(...),
    age:                     int   = Form(default=70),
    gender:                  str   = Form(default='F'),
    medical_history:         str   = Form(default=''),
    arrhythmia_class:        str   = Form(default='N'),
    arrhythmia_prob:         float = Form(default=0.0),
    af_detected:             bool  = Form(default=False),
    af_prob:                 float = Form(default=0.0),
    hrv_rmssd:               float = Form(default=0.0),
    hrv_sdnn:                float = Form(default=0.0),
    hrv_lfhf:                float = Form(default=1.0),
    anomaly_detected:        bool  = Form(default=False),
    risk_score:              int   = Form(default=0),
    risk_level:              str   = Form(default='low'),
    heart_rate:              float = Form(default=75.0),
    target:                  str   = Form(default='both'),
    report_period:           str   = Form(default='daily'),
    measurement_count:       int   = Form(default=1),
    avg_heart_rate:          int   = Form(default=0),
    max_risk_level:          str   = Form(default='low'),
    af_detected_days:        int   = Form(default=0),
    total_arrhythmia_count:  int   = Form(default=0),
    risk_distribution_low:   int   = Form(default=100),
    risk_distribution_mid:   int   = Form(default=0),
    risk_distribution_high:  int   = Form(default=0),
):
    """
    리포트 생성 엔드포인트
    백엔드 generateReport에서 호출
    AnalysisResult 데이터 + 유저 정보 받아서 Gemini로 리포트 생성

    - analysis_id            : 분석 결과 ID
    - user_id                : 유저 ID (MCP 과거 데이터 조회용)
    - age                    : 나이
    - gender                 : 성별
    - medical_history        : 과거력 (쉼표 구분)
    - target                 : 'user'(시니어용만) | 'guardian'(보호자용만) | 'both'(기본값, 둘 다)
    - 나머지 단건 필드         : AnalysisResult 데이터 (최신 1건 기준)
    - report_period          : 'daily' | 'weekly' | 'monthly'
    - measurement_count      : 기간 내 총 측정 건수
    - avg_heart_rate         : 기간 평균 심박수 (BPM)
    - max_risk_level         : 기간 최고 위험도 (high/mid/low)
    - af_detected_days       : AFib 감지 일수
    - total_arrhythmia_count : 총 부정맥 발생 건수
    - risk_distribution_low  : 위험도 '하' 비율 (%)
    - risk_distribution_mid  : 위험도 '중' 비율 (%)
    - risk_distribution_high : 위험도 '상' 비율 (%)

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
            analysis_result         = analysis_result,
            age                     = age,
            gender                  = gender,
            medical_history         = medical_history_list,
            user_id                 = user_id,
            target                  = target,
            report_period           = report_period,
            measurement_count       = measurement_count,
            avg_heart_rate          = avg_heart_rate,
            max_risk_level          = max_risk_level,
            af_detected_days        = af_detected_days,
            total_arrhythmia_count  = total_arrhythmia_count,
            risk_distribution_low   = risk_distribution_low,
            risk_distribution_mid   = risk_distribution_mid,
            risk_distribution_high  = risk_distribution_high,
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