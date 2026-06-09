from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    """
    분석 요청 데이터
    """

    heart_rate: float
    sleep_hours: float
    stress_score: float


class AnalyzeResponse(BaseModel):
    """
    분석 결과 데이터
    """

    risk_level: str
    fatigue_score: float
    report: str