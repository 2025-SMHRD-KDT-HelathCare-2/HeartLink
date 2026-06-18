# ==================================================
# 리포트 생성 모듈
# --------------------------------------------------
# 역할:
# 1. MCP 서버에서 환자 과거 데이터 조회
# 2. Gemini API 호출
# 3. 하나의 프롬프트로 고령자용 + 보호자용 동시 생성
#    - report_text_user    : 고령자용 (쉬운 말, TTS 용도)
#    - report_text_guardian: 보호자용 (의학적 정보 포함)
#    - recommended_action  : 핵심 권장 조치 한 줄
#
# [위험도별 시나리오]
# 하(low): 안심 메시지 + 생활 정보 / 상태 안정 요약
# 중(mid): 생활 관리 + 가족 알림 / 병원 동행 권유
# 상(high): 안정 취하기 + 병원 방문 / 즉시 행동 지침
#
# [MCP 연동]
# 백엔드 MCP 서버(포트 3001)에서 MongoDB 환자 과거 데이터 조회
# mcp 패키지로 MCP 프로토콜 표준에 맞게 연결
# 가져온 데이터를 프롬프트에 추가해 더 정확한 리포트 생성
# ==================================================

import asyncio
import json
import re
from google import genai
from mcp import ClientSession
from mcp.client.streamable_http import streamablehttp_client
from utils.config import GEMINI_API_KEY, MCP_URL

# Gemini API 초기화 (서버 시작 시 한 번만)
client = genai.Client(api_key=GEMINI_API_KEY)


async def get_patient_history(user_id: str) -> dict:
    """
    MCP 서버에서 환자 과거 데이터 조회
    --------------------------------------------------
    백엔드가 @mongodb-js/mcp-server 공식 패키지로 MCP 서버 구성
    Python mcp 패키지로 MCP 프로토콜 표준에 맞게 연결
    MongoDB 공식 aggregate 툴로 analysis_results 컬렉션에서 조회

    왜 aggregate 툴이냐면?
    - @mongodb-js/mcp-server가 제공하는 표준 MongoDB MCP 툴
    - 커스텀 툴 없이 바로 사용 가능
    - pipeline으로 정렬, 제한, 필드 선택 한 번에 처리

    Parameters
    ----------
    user_id : str, 유저 ID

    Returns
    -------
    dict:
        - past_risk_levels   : 최근 7일 위험도 (high/mid/low)
        - past_hrv           : 최근 7일 HRV RMSSD (ms)
        - arrhythmia_history : 최근 부정맥 이력 (N/SVEB/VEB/F/Q)
    """
    try:
        async with streamablehttp_client(MCP_URL) as (read, write, _):
            async with ClientSession(read, write) as session:
                await session.initialize()

                # MongoDB aggregate 툴 호출
                # analysisresults 컬렉션에서 해당 유저의 최근 7일 데이터 조회
                # $match: 유저 필터링
                # $sort: 최신순 정렬
                # $limit: 최근 7개만
                # $project: 필요한 필드만 선택
                result = await session.call_tool(
                    "aggregate",
                    arguments={
                        "collection": "analysisresults",
                        "pipeline": [
                            {"$match": {"userId": user_id}},
                            {"$sort": {"analyzedAt": -1}},
                            {"$limit": 7},
                            {"$project": {
                                "riskLevel": 1,
                                "hrvRmssd": 1,
                                "arrhythmiaClass": 1,
                                "analyzedAt": 1
                            }}
                        ]
                    }
                )

                if result.content:
                    raw = result.content[0].text
                    match = re.search(r'\[[\s\S]*\]', raw)
                    results = json.loads(match.group()) if match else []

                    # 필요한 데이터만 추출해서 반환
                    past_risk   = [r.get("riskLevel", "") for r in results]
                    past_hrv    = [r.get("hrvRmssd", 0) for r in results]
                    arr_history = [r.get("arrhythmiaClass", "N") for r in results]

                    return {
                        "past_risk_levels":   past_risk,
                        "past_hrv":           past_hrv,
                        "arrhythmia_history": arr_history
                    }
                return {}

    except Exception as e:
        # MCP 서버 오류 시 빈 딕셔너리 반환
        # 현재 분석 데이터만으로 리포트 생성 (과거 데이터 없이도 동작)
        print(f"MCP 서버 오류: {e}")
        return {}


async def generate_report(
    analysis_result: dict,
    age: int = 70,
    gender: str = 'F',
    medical_history: list = None,
    user_id: str = '',
    target: str = 'both'
) -> dict:
    """
    Gemini API로 고령자용 + 보호자용 리포트 동시 생성

    하나의 프롬프트로 6가지 시나리오(대상 × 위험도) 처리
    JSON 형식으로 출력해서 reports 컬렉션에 바로 저장 가능
    백엔드가 "캐시에 리포트가 없을 때만" AI 서버를 부르고,
    이때 target으로 시니어용인지 보호자용인지 알려주기로 했음.
    - target='user'     : 시니어가 보는 리포트만 생성
    - target='guardian' : 보호자가 보는 리포트만 생성
    - target='both'     : 기존 동작과 동일 (하위 호환용 기본값)

    Parameters
    ----------
    analysis_result : dict
        - arrhythmia_class : 부정맥 클래스 (N/SVEB/VEB/F/Q)
        - arrhythmia_prob  : 부정맥 확률
        - af_detected      : AFib 감지 여부
        - af_prob          : AFib 확률
        - hrv_rmssd        : HRV (정상 18~45ms)
        - hrv_sdnn         : HRV (정상 30~60ms)
        - anomaly_detected : HRV 이상 탐지
        - risk_score       : 위험도 점수 (0~100)
        - risk_level       : 위험도 등급 (high/mid/low)
        - heart_rate       : 심박수 (BPM)
        
    age            : int,  나이
    gender         : str,  성별 ('M'/'F')
    medical_history: list, 과거력 (None이면 빈 리스트로 처리)
    user_id        : str,  MCP 과거 데이터 조회용

    Returns
    -------
    dict:
        - report_text_user    : 고령자용 메시지 (target='guardian'이면 이 키 없음)
        - report_text_guardian: 보호자용 메시지 (target='user'이면 이 키 없음)
        - recommended_action  : 핵심 권장 조치 한 줄
    """

    # mutable default argument 방지
    if medical_history is None:
        medical_history = []

    # 잘못된 값이 들어오면 안전하게 기존 동작(both)으로 처리
    if target not in ('user', 'guardian', 'both'):
        target = 'both'

    # 분석 결과 파싱
    risk_level  = analysis_result.get('risk_level', 'low')
    risk_score  = analysis_result.get('risk_score', 0)
    arr_class   = analysis_result.get('arrhythmia_class', 'N')
    arr_prob    = analysis_result.get('arrhythmia_prob', 0)
    af_detected = analysis_result.get('af_detected', False)
    af_prob     = analysis_result.get('af_prob', 0)
    hrv_rmssd   = analysis_result.get('hrv_rmssd', 0)
    hrv_sdnn    = analysis_result.get('hrv_sdnn', 0)
    anomaly     = analysis_result.get('anomaly_detected', False)
    heart_rate  = analysis_result.get('heart_rate', 75)

    # 위험도 변환 (high/mid/low → 상/중/하)
    risk_kor   = {'high': '상', 'mid': '중', 'low': '하'}
    risk_label = risk_kor.get(risk_level, '하')

    # 성별 변환
    gender_kor = '여성' if gender == 'F' else '남성'

    # 과거력 텍스트 변환
    medical_history_text = ', '.join(medical_history) if medical_history else '없음'

    # MCP 서버에서 과거 데이터 조회
    history     = await get_patient_history(user_id) if user_id else {}
    past_risk   = history.get('past_risk_levels', [])
    past_hrv    = history.get('past_hrv', [])
    arr_history = history.get('arrhythmia_history', [])

    past_risk_text = ', '.join(past_risk[-7:]) if past_risk else '데이터 없음'
    past_hrv_text  = ', '.join([str(h) for h in past_hrv[-7:]]) if past_hrv else '데이터 없음'
    arr_hist_text  = ', '.join(arr_history[-3:]) if arr_history else '이력 없음'

    # target에 따라 Gemini에게 요청할 출력 필드를 다르게 구성
    if target == 'user':
        output_format = '''{
  "report_text_user": "어르신용 메시지 (3~5문장, TTS로 읽어줄 것이므로 자연스럽게)",
  "recommended_action": "핵심 권장 조치 한 줄"
}'''
    elif target == 'guardian':
        output_format = '''{
  "report_text_guardian": "보호자용 메시지 (5~7문장, 의학적 정보 포함)",
  "recommended_action": "핵심 권장 조치 한 줄"
}'''
    else:  # both
        output_format = '''{
  "report_text_user": "어르신용 메시지 (3~5문장, TTS로 읽어줄 것이므로 자연스럽게)",
  "report_text_guardian": "보호자용 메시지 (5~7문장, 의학적 정보 포함)",
  "recommended_action": "핵심 권장 조치 한 줄"
}'''

    prompt = f"""
당신은 어르신과 가족을 돕는 심장 건강 안내 도우미입니다.

[역할/톤 규칙]
- 모든 문장은 초등학생도 이해할 만큼 쉽게 씁니다.
- 어려운 의학 용어는 반드시 쉬운 말로 풀어 씁니다.
  (예: "심방세동" → "심장이 불규칙하게 뛰는 상태")
- 특정 호칭("할머님", "어르신" 등)을 사용하지 말고, 호칭 없이 자연스러운 존댓말로 작성합니다.
- 진단을 단정하지 말고 "~인 것 같아요", "~가 좋겠어요" 같은 표현을 씁니다.
- 어르신께는 겁을 주지 않되, 해야 할 행동은 분명히 알려줍니다.
- 복약 용량 조정 같은 의학적 판단은 절대 하지 않습니다.
- 모든 리포트 끝에 "이 안내는 참고용이며 의사의 진료를 대신하지 않습니다"를 포함합니다.

[오늘 분석 결과]
- 위험도: {risk_label} ({risk_score}점/100점)
- 심박수: {heart_rate:.0f}BPM (정상 60~100BPM)
- 심장 리듬: {arr_class} (확률 {arr_prob:.0%})
  * N=정상, SVEB=심실상성, VEB=심실성, F=융합, Q=미분류
- 불규칙 박동(심방세동) 의심: {'예' if af_detected else '아니오'} (확률 {af_prob:.0%})
- 심박 변동성(HRV) RMSSD: {hrv_rmssd:.1f}ms (정상 18~45ms)
- 심박 변동성(HRV) SDNN: {hrv_sdnn:.1f}ms (정상 30~60ms)
- HRV 이상 탐지: {'있음' if anomaly else '없음'}

[어르신 정보]
- 나이: {age}세, 성별: {gender_kor}
- 평소 앓는 병: {medical_history_text}

[최근 7일 위험도 추이]
{past_risk_text}

[최근 7일 HRV 추이]
{past_hrv_text}

[부정맥 이력]
{arr_hist_text}

[위험도별 작성 지침]
■ 위험도가 '하'일 때
  - 어르신용: 안심시키는 말 + 심장에 좋은 생활 정보(음식, 가벼운 운동, 약 챙기기, 수면 등)
  - 보호자용: 현재 상태가 안정적임을 요약. 특별한 조치 불필요 안내.

■ 위험도가 '중'일 때
  - 어르신용: 무리하지 말라는 안내 + 생활 관리 팁 + 증상 있으면 가족에게 알리라는 안내
  - 보호자용: 가까운 시일 내 병원(순환기내과) 동행 권유 + 살펴봐야 할 증상 안내

■ 위험도가 '상'일 때
  - 어르신용: 편히 앉거나 누워 안정 취하기 + 보호자에게 연락하라는 차분한 안내 (겁주지 말 것)
  - 보호자용: 즉시 취해야 할 구체적 행동 지침 순서대로 (연락/방문, 증상 확인, 119 안내 등)

[특수 케이스 안내]
부정맥 클래스가 VEB(심실성)이고 확률이 70% 이상인 경우, 위험도 점수가 낮게 나와도
"심실성 부정맥이 자주 감지되고 있어 점수와 별개로 병원 방문이 필요하다"는 내용을
어르신용과 보호자용 메시지 모두에 명확히 포함하세요. 점수 숫자보다 이 부정맥 패턴의
중요성을 우선해서 안내하세요.

[출력 형식]
반드시 아래 JSON 형식으로만 답하세요. 다른 말은 하지 마세요.
{output_format}
"""

    try:
        # generate_content는 동기 함수 → asyncio.to_thread로 이벤트 루프 블로킹 방지
        response = await asyncio.to_thread(
            client.models.generate_content,
            model="gemini-2.5-flash",
            contents=prompt
        )
        text = response.text.strip()

        # JSON 파싱: 정규식으로 { } 블록만 추출
        # Gemini가 ```json ... ``` 또는 앞뒤 설명을 붙여 반환할 수 있음
        match = re.search(r'\{[\s\S]*\}', text)
        if not match:
            raise ValueError("Gemini 응답에서 JSON을 찾지 못했습니다.")
        result = json.loads(match.group())
        return result

    except Exception as e:
        print(f"Gemini API 오류: {e}")
        fallback = {
            "recommended_action": f"위험도 {risk_label} - 상태를 지속적으로 모니터링하세요."
        }
        if target in ('user', 'both'):
            fallback["report_text_user"] = f"오늘 심장 건강 위험도는 {risk_label}입니다. 정확한 분석을 위해 잠시 후 다시 시도해주세요. 이 안내는 참고용이며 의사의 진료를 대신하지 않습니다."
        if target in ('guardian', 'both'):
            fallback["report_text_guardian"] = f"위험도: {risk_label} ({risk_score}점). 부정맥: {arr_class}. API 오류로 상세 리포트 생성에 실패했습니다. 이 안내는 참고용이며 의사의 진료를 대신하지 않습니다."
        return fallback