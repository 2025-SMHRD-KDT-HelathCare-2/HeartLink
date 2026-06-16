from pydantic import BaseModel


class AnalyzeResponse(BaseModel):
    """
    POST /analyze 응답 스키마
    predictor.py → main.py → 백엔드로 반환되는 형식
    """
    measurement_id:   str
    user_id:          str
    arrhythmia_class: str    # N / SVEB / VEB / F / Q
    arrhythmia_prob:  float  # 0.0 ~ 1.0
    af_detected:      bool
    af_prob:          float  # 0.0 ~ 1.0
    hrv_rmssd:        float  # ms, 정상 18~45
    hrv_sdnn:         float  # ms, 정상 30~60
    hrv_lfhf:         float  # 정상 0.5~2.0
    anomaly_detected: bool
    risk_score:       int    # 0~100
    risk_level:       str    # low / mid / high
    analyzed_at:      str    # ISO 8601 UTC


class ReportResponse(BaseModel):
    """
    POST /report 응답 스키마
    Gemini API → main.py → 백엔드로 반환되는 형식
    """
    report_text_user:     str  # 고령자용 (TTS 입력)
    report_text_guardian: str  # 보호자용
    recommended_action:   str  # 핵심 권장 조치 한 줄
