from fastapi import FastAPI

# ==================================================
# HeartLink AI Server
# --------------------------------------------------
# 역할:
# 1. 생체신호 데이터 수신
# 2. 위험도 예측
# 3. 관리자용 리포트 생성
# 4. TTS 음성 변환
# ==================================================

app = FastAPI(
    title="HeartLink AI Server",
    version="0.1.0"
)


@app.get("/")
def root():
    """
    서버 실행 확인용 API
    """
    return {
        "message": "HeartLink AI Server Running"
    }


@app.get("/health")
def health_check():
    """
    백엔드 연결 상태 확인용 API
    """
    return {
        "status": "ok"
    }