# ==================================================
# TTS 모듈
# --------------------------------------------------
# 역할:
# 1. Google Cloud Text-to-Speech API 호출
# 2. 리포트 텍스트 → 음성 변환
# 3. mp3 바이트 반환
#
# 왜 Google Cloud TTS냐면?
# - 월 400만 자 무료 티어 (학생 프로젝트 수준에서 충분)
# - 한국어 고품질 음성 지원 (WaveNet)
# - 고령자용 리포트 음성 읽기에 최적화
#
# 속도 설정:
# - 느리게: 0.75 (어르신이 이해하기 쉽게)
# - 보통  : 1.0
# - 빠르게: 1.25
# ==================================================

import base64
import httpx
from utils.config import GOOGLE_TTS_API_KEY

# Google Cloud TTS API 엔드포인트
TTS_URL = "https://texttospeech.googleapis.com/v1/text:synthesize"

# 속도 매핑
# 프론트 슬라이더 값(0,1,2) → TTS speaking_rate
SPEED_MAP = {
    0: 0.75,  # 느리게
    1: 1.0,   # 보통
    2: 1.25,  # 빠르게
}


async def text_to_speech(text: str, speed: int = 1) -> bytes:
    """
    텍스트 → 음성 변환 (Google Cloud TTS API)

    Parameters
    ----------
    text  : str, 변환할 텍스트 (고령자용 리포트)
    speed : int, 속도 (0=느리게, 1=보통, 2=빠르게)
            프론트 슬라이더 값과 동일

    Returns
    -------
    bytes: mp3 오디오 데이터
    """
    speaking_rate = SPEED_MAP.get(speed, 1.0)

    payload = {
        "input": {
            "text": text
        },
        "voice": {
            # 한국어 WaveNet 음성
            # WaveNet은 구글 딥러닝 기반 고품질 음성
            # ko-KR-WaveNet-A: 여성 음성 (어르신께 친근한 느낌)
            "languageCode": "ko-KR",
            "name": "ko-KR-WaveNet-A",
            "ssmlGender": "FEMALE"
        },
        "audioConfig": {
            "audioEncoding": "MP3",
            # speaking_rate: 0.25~4.0 사이 값
            # 0.75 느리게, 1.0 보통, 1.25 빠르게
            "speakingRate": speaking_rate,
            # pitch: 기본값 0.0 (변경 없음)
            "pitch": 0.0
        }
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(
                TTS_URL,
                json=payload,
                params={"key": GOOGLE_TTS_API_KEY}
            )

            if response.status_code != 200:
                raise Exception(f"TTS API 오류: {response.status_code} {response.text}")

            # 응답에서 base64 인코딩된 오디오 데이터 추출
            audio_content = response.json()["audioContent"]
            return base64.b64decode(audio_content)

    except Exception as e:
        print(f"TTS 오류: {e}")
        raise