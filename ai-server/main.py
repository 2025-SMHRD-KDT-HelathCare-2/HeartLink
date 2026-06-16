# ==================================================
# HeartLink AI Server - main.py
# --------------------------------------------------
# 역할:
# 1. ECG 파일 수신 (백엔드 → AI 서버)
# 2. 전처리 (preprocessing.py)
# 3. 모델 추론 (predictor.py)
# 4. 분석 결과 반환 (백엔드 → MongoDB 저장)
#
# 엔드포인트:
# GET  /         → 서버 실행 확인
# GET  /health   → 백엔드 연결 상태 확인
# POST /analyze  → ECG 분석 메인 엔드포인트
# ==================================================

import numpy as np
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from datetime import datetime, timezone
import io

from services.preprocessing import preprocess_ecg
from services.predictor import predict

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
):
    """
    ECG 분석 메인 엔드포인트

    백엔드 aiService.js에서 multipart/form-data로 요청
    - file: ECG 파일 (CSV)
    - measurement_id: 측정 ID
    - user_id: 유저 ID

    Returns
    -------
    JSON: AnalysisResult 스키마와 동일한 형식
    """
    try:
        # 파일 읽기
        contents = await file.read()

        # CSV 파싱 → numpy 배열
        # measurementController.js의 parseCSV와 동일한 방식
        import csv
        text    = contents.decode('utf-8')
        lines   = text.strip().split('\n')
        headers = [h.strip().strip("'\"").lower() for h in lines[0].split(',')]

        # ECG 신호 컬럼 찾기
        candidates = ['ecg', 'y', 'value', 'signal', 'mv', 'mlii', 'v5', 'v1', 'v2']
        y_idx = next((i for i, h in enumerate(headers) if h in candidates), 1)

        signal_raw = []
        for line in lines[1:]:
            cols = line.split(',')
            if y_idx < len(cols):
                try:
                    signal_raw.append(float(cols[y_idx]))
                except:
                    continue

        if len(signal_raw) < 100:
            raise HTTPException(status_code=400, detail="ECG 데이터가 너무 적습니다.")

        signal_raw = np.array(signal_raw, dtype=np.float32)

        # 전처리
        preprocessed = preprocess_ecg(signal_raw, fs_original=250)

        # 모델 추론 + 위험도 산출
        medical_history_list = medical_history.split(',') if medical_history else []

        result = predict(
            ecg_beat     = preprocessed['beat'],
            ecg_window   = preprocessed['window'],
            hrv_features = preprocessed['hrv_features'],
            heart_rate   = preprocessed['heart_rate'],
            age          = age,
            gender       = gender,
            medical_history = medical_history_list,
        )

        return {
            "measurement_id":   measurement_id,
            "user_id":          user_id,
            "arrhythmia_class": result['arrhythmia_class'],
            "arrhythmia_prob":  result['arrhythmia_prob'],
            "af_detected":      result['af_detected'],
            "af_prob":          result['af_prob'],
            "hrv_rmssd":        result['hrv_rmssd'],
            "hrv_sdnn":         result['hrv_sdnn'],
            "hrv_lfhf":         result['hrv_lfhf'],
            "anomaly_detected": result['anomaly_detected'],
            "risk_score":       result['risk_score'],
            "risk_level":       result['risk_level'],
            "analyzed_at":      result['analyzed_at'],
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))