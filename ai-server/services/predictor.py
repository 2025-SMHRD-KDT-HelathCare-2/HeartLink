# ==================================================
# 예측 모듈
# --------------------------------------------------
# 역할:
# 1. ONNX 모델 로드 (트랙 1, 트랙 2, HRV)
# 2. ECG 신호 → 부정맥 클래스 예측 (트랙 1)
# 3. ECG 신호 → AFib 감지 (트랙 2)
# 4. HRV 특징값 → 이상 탐지 (HRV Isolation Forest)
# 5. 위험도 산출 (risk_score, risk_level)
#
# [위험도 산출 알고리즘 개요]
# 간호사 임상 피드백 반영하여 설계
# - AF(심방세동)는 심박수랑 같이 봐야 함
#   AF만 있으면 별로 안 위험, AF + 빠른 심박수면 위험
# - VEB(심실성 부정맥)가 가장 위험한 부정맥
#   빈발 시 심실빈맥으로 이어질 수 있음
# - SVEB(심실상성)는 심방에서 발생, 별로 안 위험
# - HRV는 자율신경 상태 반영, 정상 범위 벗어나면 위험 신호
# ==================================================

import numpy as np
import onnxruntime as ort
import os
from datetime import datetime, timezone

# ==================================================
# ONNX 모델 로드
# 서버 시작 시 한 번만 로드해서 메모리에 유지
# 매 요청마다 로드하면 느려짐
# ==================================================
BASE_DIR   = os.path.dirname(os.path.abspath(__file__))
MODEL_DIR  = os.path.join(BASE_DIR, '..', 'models')

TRACK1_MODEL = os.path.join(MODEL_DIR, 'track1_resnet1d_v4.onnx')
TRACK2_MODEL = os.path.join(MODEL_DIR, 'track2_resnet1d.onnx')
HRV_MODEL    = os.path.join(MODEL_DIR, 'hrv_isolation_forest.onnx')

sess_track1 = ort.InferenceSession(TRACK1_MODEL)
sess_track2 = ort.InferenceSession(TRACK2_MODEL)
sess_hrv    = ort.InferenceSession(HRV_MODEL)

# ==================================================
# 위험도 정규화용 시뮬레이션 분포 로드
# --------------------------------------------------
# calc_percentile_v3.py 실행 결과 파일 (2026-06-24 계산)
# normalize_score()가 이 배열을 참조해 raw_score를 percentile 순위로 변환.
# 파일이 없으면 None → normalize_score()가 fallback 모드로 동작.
# ==================================================
DATA_DIR   = os.path.join(BASE_DIR, '..', 'data')
_DIST_PATH = os.path.join(DATA_DIR, 'risk_score_distribution.npy')
try:
    _distribution = np.load(_DIST_PATH)
except FileNotFoundError:
    _distribution = None

# AAMI 5클래스 매핑
# 트랙 1 모델 출력 인덱스 → 클래스 이름
CLASS_NAMES = {0: 'N', 1: 'SVEB', 2: 'VEB', 3: 'F', 4: 'Q'}


def softmax(x):
    """
    소프트맥스 함수
    모델 출력(로짓)을 확률로 변환
    예: [2.1, 0.3, 0.5] → [0.72, 0.10, 0.18]
    """
    e_x = np.exp(x - np.max(x))
    return e_x / e_x.sum()


def normalize_score(raw_score: float) -> int:
    """
    raw_score를 시뮬레이션 분포 기준 percentile 순위(0~100)로 변환.

    [변환 방식]
    _distribution(2000건 시뮬레이션 risk_score 배열)에서
    raw_score보다 작은 값의 비율 × 100을 정수로 반환한다.
    raw_score가 분포의 X번째 percentile에 해당하면 X점을 반환.

    예시 (calc_percentile_v3.py 결과 기준, 2026-06-24):
      raw_score = 0  → 0점 미만인 값 없음 (~0%)  → 반환:  0
      raw_score = 3  → 분포의 50%가 3점 미만     → 반환: 50  (MID 경계)
      raw_score = 15 → 분포의 90%가 15점 미만    → 반환: 90  (HIGH 경계)
      raw_score = 41 → 분포의 99%+가 41점 미만   → 반환: ~99

    [fallback]
    data/risk_score_distribution.npy가 없으면 raw_score를 그대로 반환.
    서버 최초 배포·파일 삭제 시 서버가 중단되지 않도록 함.
    단, fallback 상태에서는 raw_score 최댓값이 ~41점이라 HIGH(≥90)/
    MID(≥50) 기준에 거의 걸리지 않아 등급이 낮게 나올 수 있음.
    반드시 calc_percentile_v3.py를 실행해 파일을 생성할 것.
    """
    if _distribution is None:
        return int(min(100, max(0, round(raw_score))))
    return round(float(np.mean(_distribution < raw_score) * 100))


def calculate_risk(af_detected, af_prob, arr_class, arr_prob,
                   hrv_sdnn, hrv_rmssd, hrv_lfhf, anomaly_detected,
                   heart_rate=75.0,
                   age=70, gender='F', medical_history=None,
                   measurement_duration=30):
    """
    위험도 산출 함수
    3단계로 계산: ECG 점수 → 임상 보정 → 최종 등급

    [v2 수정 배경]
    애플워치 "심실빈맥(고위험)" 라벨 테스트 파일을 분석했을 때,
    heart_rate=142(명백한 빈맥)인데도 risk_level='low'로 잘못 나오는
    문제를 발견함. 원인 2가지를 찾아 수정함:
    1) 심박수 자체가 ECG 점수 계산에 전혀 반영되지 않았음
       (AFib이 감지된 경우에만 심박수를 참고했고, 그 외에는 무시됨)
    2) HRV(SDNN/RMSSD)가 너무 "낮을" 때만 위험으로 봤음.
       실제로는 리듬이 불규칙하면 RR간격 변동이 커져서 HRV가
       비정상적으로 "높게" 측정될 수 있는데, 이 경우를 놓치고 있었음
    → HR_score 항목을 신규 추가하고, HRV_score를 양방향(낮음/높음
      모두 위험)으로 수정.

    [현재 수정]
    예외 규칙 4개 → 3개로 정리:
    - HR ≥ 140 / ≤ 40 예외 제거: HR_score 구간 재조정으로 흡수
      (≥140 → 100점, ≤40 → 100점; 기존은 >150 / <40)
    - AF 관련 2개는 임상 피드백 근거로 유지 (심박수랑 같이 봐야 함)
    - VEB ≥ 70% 예외: 실제 데이터(MIT-BIH+INCART) 검증 + 간호사 임상 자문으로 유지
      (점수 체계로 흡수 가능 판단 후 제거했으나 검증에서 흡수 실패 확인 → 복원)

    Parameters
    ----------
    af_detected     : bool,  AFib 감지 여부
    af_prob         : float, AFib 확률 (0~1)
    arr_class       : str,   부정맥 클래스 (N/SVEB/VEB/F/Q)
    arr_prob        : float, 부정맥 예측 확률 (0~1)
    hrv_sdnn        : float, RR간격 표준편차 (ms), 정상 30~60ms
    hrv_rmssd       : float, 연속 RR간격 차이 제곱평균 (ms), 정상 18~45ms
    hrv_lfhf        : float, 저주파/고주파 비율, 정상 0.5~2.0
    anomaly_detected: bool,  HRV Isolation Forest 이상 탐지 여부
    heart_rate      : float, 평균 심박수 (BPM), 정상 60~100
    age             : int,   나이
    gender          : str,   성별 ('M'/'F')
    medical_history : list,  과거력 리스트
    """
    if medical_history is None:
        medical_history = []

    # ==================================================
    # 1단계: ECG 분석 점수 (0~100)
    # 5가지 점수를 가중치로 합산 (HR_score 신규 추가)
    # ==================================================

    # AF_score (가중치 0.25, 기존 0.30에서 조정)
    # AFib 감지됐을 때만 확률 × 100, 아니면 0
    # 심박수랑 같이 봐야 해서 단독으로 high 안 됨 (3단계에서 처리)
    AF_score = af_prob * 100 if af_detected else 0

    # ARR_score (가중치 0.35, 기존 0.40에서 조정 - 여전히 가장 높음)
    # 부정맥 클래스별 기본 위험점수 × 예측 확률
    # VEB(심실성): 90점 → 가장 위험, 빈발 시 심실빈맥 위험
    # F(융합박동): 40점 → 중간 위험
    # Q(미분류):   30점 → 불확실
    # SVEB(심실상성): 20점 → 심방 발생, 별로 안 위험
    # N(정상):     0점
    arr_base  = {'N': 0, 'SVEB': 20, 'VEB': 90, 'F': 40, 'Q': 30}
    ARR_score = arr_base.get(arr_class, 0) * arr_prob

    # HR_score (가중치 0.20, 신규 추가)
    # 심박수 자체가 정상 범위를 벗어난 정도를 점수화
    # 의학적 기준: 정상 안정시 심박수는 60~100 BPM
    # 100 초과 = 빈맥(tachycardia), 60 미만 = 서맥(bradycardia)
    # 벗어난 정도가 클수록 단계적으로 높은 점수 부여
    # (AI의 부정맥 클래스 분류는 대표 박동 1개의 '모양'만 보기 때문에,
    #  리듬 전체의 빠르기/느리기 자체는 별도로 봐야 놓치지 않음)
    if heart_rate >= 140:
        HR_score = 100      # 심한 빈맥 (140+ = 즉각 위험; 0.20×100=20 → norm≈93 → high)
    elif heart_rate > 130:
        HR_score = 70       # 중등도 빈맥
    elif heart_rate > 100:
        HR_score = 40       # 경미한 빈맥
    elif heart_rate <= 40:
        HR_score = 100      # 심한 서맥 (40 포함; 0.20×100=20 → norm≈93 → high)
    elif heart_rate < 60:
        HR_score = 40       # 경미한 서맥
    else:
        HR_score = 0        # 정상 범위 (60~100)

    # HRV_score (가중치 0.15)
    # ─────────────────────────────────────────────────────────────────────
    # [왜 두 가지 정상 범위가 있는가]
    #
    # 일반적으로 인용되는 임상 정상값(SDNN 30~60ms, RMSSD 18~45ms)은
    # ESC/HRS 1996 Task Force(Malik et al., Eur Heart J 1996)가
    # "안정 시 5분 측정 + 임상 환자군"을 기준으로 수립한 값이다.
    #
    # 30초 단일 측정(갤럭시워치, 애플워치 ECG)에서는 이 범위를 자연스럽게
    # 벗어나는 것이 오히려 정상이다. 주된 이유:
    #
    #   1) 호흡성 동부정맥(RSA): 정상 안정 호흡(12~20회/분)에 의한 RR 변동이
    #      30초 창에 집중 반영 → 건강인의 RMSSD가 80~120ms에 달할 수 있음
    #   2) 짧은 창의 통계적 변동: 30초 75BPM ≈ 36개 RR 간격밖에 없어
    #      자연 이탈값이 더 자주 나타남
    #
    # [30초 기준 범위의 근거 (ultra-short HRV 연구)]
    #   Esco & Flatt (2014, Eur J Appl Physiol): 1분 RMSSD 95th pct ≈ 100ms
    #   Munoz et al. (2015, PLoS ONE): 단기 측정에서 상한 100ms 권장
    #   De La Cruz Torres et al. (2016, Eur J Sport Sci): 30초 SDNN 상한 100ms
    #
    # [실제 검증 사례: 2026-06-24, 정상인 30초 측정, SDNN=86ms / RMSSD=101ms]
    #   5분 기준 적용 → SDNN_dev=43%, RMSSD_dev=124% → HRV_score=84점 (오판정)
    #   30초 기준 적용 → SDNN_dev=0%,  RMSSD_dev=1%  → HRV_score=0.5점 (정상 ✓)
    # ─────────────────────────────────────────────────────────────────────
    if measurement_duration >= 120:
        # 5분 이상 측정: ESC/HRS 1996 임상 정상값
        # SDNN 정상 범위: 30~60ms / RMSSD 정상 범위: 18~45ms
        SDNN_dev  = max(0, (30 - hrv_sdnn)  / 30,  (hrv_sdnn  -  60) /  60) * 100
        RMSSD_dev = max(0, (18 - hrv_rmssd) / 18,  (hrv_rmssd -  45) /  45) * 100
        LFHF_dev  = 50 if (hrv_lfhf < 0.5 or hrv_lfhf > 2.0) else 0
        HRV_score = min(100, (SDNN_dev + RMSSD_dev + LFHF_dev) / 3)
    else:
        # 30초 단일 측정: ultra-short HRV 연구 기반 정상 범위
        # SDNN 정상 범위: 20~100ms (하한 완화: 짧은 창, 상한 완화: RSA 반영)
        # RMSSD 정상 범위: 15~100ms (하한 완화: 인터벌 수 부족, 상한 완화: RSA)
        # LF/HF 제외: Welch 해상도 0.0625Hz → LF 하단(0.04~0.0625Hz) 측정 불가
        SDNN_dev  = max(0, (20 - hrv_sdnn)  / 20,  (hrv_sdnn  - 100) / 100) * 100
        RMSSD_dev = max(0, (15 - hrv_rmssd) / 15,  (hrv_rmssd - 100) / 100) * 100
        HRV_score = min(100, (SDNN_dev + RMSSD_dev) / 2)

    # ANOM_score (가중치 0.05, 기존 0.10에서 조정)
    # Isolation Forest가 HRV 패턴 이상 감지 시 100점
    # 위 지표들로 못 잡는 패턴 이상을 보완
    ANOM_score = 100 if anomaly_detected else 0

    # 가중 합산 (HR_score 추가로 가중치 재배분: 25/35/20/15/5)
    ecg_score = (0.25 * AF_score +
                 0.35 * ARR_score +
                 0.20 * HR_score +
                 0.15 * HRV_score +
                 0.05 * ANOM_score)

    # ==================================================
    # 2단계: 임상 위험 보정 (CHA2DS2-VASc 기반)
    # 나이, 성별, 과거력으로 보정 계수 적용
    # 최대 약 1.45배까지 점수 올라감
    # CHA2DS2-VASc란?
    # 심방세동 환자의 뇌졸중 위험도를 평가하는 국제 표준 점수 체계
    # 2021 대한부정맥학회 뇌졸중 예방 지침에서 사용
    # 각 인자에 점수를 매겨서 합산, 점수가 높을수록 위험
    #
    # 우리는 이 인자들을 보정 계수로 활용
    # clinical_factor = 1 + (clinical_points / 20)
    # 최대 약 1.45배까지 ECG 점수를 올려줌
    # ==================================================
    clinical_points = 0
    if age >= 75:         clinical_points += 2    # 고령
    elif age >= 65:       clinical_points += 1
    elif age >= 55:       clinical_points += 0.5  # 아시아인 조기 위험 반영
    if '고혈압' in medical_history:   clinical_points += 1 # 고혈압: 뇌졸중 위험 인자
    if '당뇨' in medical_history:     clinical_points += 1 # 당뇨: 혈관 손상 위험
    if '심부전' in medical_history:   clinical_points += 1 # 심부전: 심장 기능 저하
    if '뇌졸중' in medical_history:   clinical_points += 2 # 뇌졸중 병력: 재발 위험 높음
    if '혈관질환' in medical_history: clinical_points += 1 # 혈관질환: 동맥경화 등
    if gender == 'F':     clinical_points += 1    # 여성: CHA2DS2-VASc 위험 인자

    clinical_factor = 1 + (clinical_points / 20)

    # raw_score: 임상 보정까지 완료한 원점수 (0~100)
    raw_score = min(100, round(ecg_score * clinical_factor))

    # ==================================================
    # 3단계: percentile 정규화 → 0~100 재매핑
    # --------------------------------------------------
    # raw_score는 분포가 0~41점에 집중되어 직관적이지 않다
    # (calc_percentile_v3.py 시뮬레이션 최댓값 41점).
    # normalize_score()로 재정규화하면:
    #   raw=0  → norm≈0   (최하위권)
    #   raw=3  → norm=50  (분포 중앙값, MID 경계)
    #   raw=15 → norm=90  (분포 90th pct, HIGH 경계)
    #   raw=41 → norm≈99  (분포 최상위)
    #
    # [HIGH_THRESHOLD=14 / MID_THRESHOLD=3 정리]
    # 이전에는 raw_score를 14/3과 직접 비교했다.
    # 정규화 이후에는 _distribution 배열이 그 역할을 대신하므로
    # 별도 상수로 비교하지 않는다.
    # (p50=3 → norm=50, p90=15 → norm=90 이 배열에 인코딩되어 있음)
    # ==================================================
    norm_score = normalize_score(raw_score)

    # --------------------------------------------------
    # 위험도 등급 결정
    #
    # [설계 원칙]
    # 명백한 응급 신호(AF+빈맥, VEB 고확률, 극단 심박수)는
    # percentile 분포가 바뀌어도 항상 'high'가 보장되어야 한다.
    # 분포 기반 점수(norm_score)는 상대적 기준이라 기준 분포가
    # 가상 시뮬레이션(p90=15)에서 실제 데이터(p90=50)로 바뀌는 것만으로
    # high→mid로 등급이 떨어질 수 있음이 실제 테스트에서 확인됐다.
    # (애플워치 심실빈맥 파일 HR=142 → ecg_score≈26 → 새 분포 p90=50 미달)
    # 이런 케이스는 점수 체계로 흡수하려는 시도보다 명시적 예외 규칙이
    # 더 안전하고 유지보수가 쉽다는 결론에 도달함.
    #
    # 1순위: 절대 예외 규칙 (4개, 임상적 절대 기준)
    #   percentile 점수와 무관하게 등급을 직접 결정.
    #   norm_score 범위: high=[90, 100], mid=[50, 89]
    #   → risk_level과 norm_score 항상 동일 기준 (등급 ↔ 점수 불일치 없음)
    #
    #   ① AF + 빠른 심박수(≥100) → high
    #      심방세동 + 빠른 심실반응(RVR) → 즉각적 위험 (간호사 임상 피드백)
    #
    #   ② AF + 느린 심박수(<100) → mid
    #      AF 단독은 별로 안 위험 (간호사 임상 피드백)
    #
    #   ③ VEB 확률 ≥ 70% → high
    #      MIT-BIH+INCART 검증: VEB 1,193개 중 42%가 점수 체계로 흡수 실패
    #      간호사 임상 자문: "VEB는 단독으로도 병원 방문(상 등급) 필요"
    #
    #   ④ 극단 심박수(≥140 또는 ≤40) → high
    #      가상 시뮬레이션 분포(p90=15)에서는 HR_score 재조정만으로 흡수됐으나,
    #      실제 데이터 분포(p90=50)로 교체 후 ecg_score≈26이 p90 미달 → 복원
    #      임상 근거: 심한 빈맥(140+)·심한 서맥(40 이하)은 즉각적 응급 신호
    #
    # 2순위: percentile 기반 상대 기준
    #   HIGH: norm_score >= 90  (분포 상위 10%)
    #   MID:  norm_score >= 50  (분포 상위 50%)
    # --------------------------------------------------
    if af_detected and heart_rate >= 100:
        risk_level = 'high'
        norm_score = max(norm_score, 90)
    elif af_detected and heart_rate < 100:
        risk_level = 'mid'
        norm_score = min(max(norm_score, 50), 89)
    elif arr_class == 'VEB' and arr_prob >= 0.70:
        risk_level = 'high'
        norm_score = max(norm_score, 90)
    elif heart_rate >= 140 or heart_rate <= 40:
        risk_level = 'high'
        norm_score = max(norm_score, 90)
    elif norm_score >= 90:
        risk_level = 'high'
    elif norm_score >= 50:
        risk_level = 'mid'
    else:
        risk_level = 'low'

    return norm_score, risk_level


def predict(ecg_beat, ecg_window, hrv_features, heart_rate=75.0,
            age=70, gender='F', medical_history=None, r_peaks=None,
            measurement_duration=30):
    """
    전체 예측 파이프라인

    Parameters
    ----------
    ecg_beat    : np.ndarray (200,)  beat 단위 신호 → 트랙 1 입력
    ecg_window  : np.ndarray (7500,) 30초 윈도우   → 트랙 2 입력
    hrv_features: np.ndarray (3,)    [rmssd, sdnn, lfhf]
    heart_rate  : float, 평균 BPM
    age, gender, medical_history: 위험도 보정용 사용자 정보
    r_peaks     : list, R-peak 인덱스 (부정맥 카운트용)

    Returns
    -------
    dict: 분석 결과 전체
    """
    if medical_history is None:
        medical_history = []

    # 트랙 1: 부정맥 분류
    # 입력 shape: (1, 1, 200) → [배치, 채널, 길이]
    # ResNet1D 마지막 레이어 nn.Linear → 로짓 출력이므로 softmax 적용
    input1    = ecg_beat.reshape(1, 1, 200).astype(np.float32)
    output1   = sess_track1.run(None, {'input': input1})[0]  # (1, 5)
    probs1    = softmax(output1[0])
    arr_idx   = int(np.argmax(probs1))
    arr_class = CLASS_NAMES[arr_idx]
    arr_prob  = float(probs1[arr_idx])

    # 트랙 2: AFib 감지
    # 입력 shape: (1, 1, 7500) → [배치, 채널, 길이]
    # ResNet1D 마지막 레이어 nn.Linear → 로짓 출력이므로 softmax 적용 (트랙 1과 동일)
    input2      = ecg_window.reshape(1, 1, 7500).astype(np.float32)
    output2     = sess_track2.run(None, {'input': input2})[0]  # (1, 2)
    probs2      = softmax(output2[0])
    af_detected = bool(np.argmax(probs2) == 1)
    af_prob     = float(probs2[1])

    # HRV: Isolation Forest 이상 탐지
    # 입력 shape: (1, 3)
    # 출력: 1(정상) or -1(이상)
    input_hrv        = hrv_features.reshape(1, 3).astype(np.float32)
    output_hrv       = sess_hrv.run(None, {'float_input': input_hrv})
    anomaly_detected = bool(output_hrv[0][0] == -1)

    hrv_rmssd = float(hrv_features[0])
    hrv_sdnn  = float(hrv_features[1])
    hrv_lfhf  = float(hrv_features[2])

    # 전체 R-peak별 beat 분류 → 비정상 beat 횟수 카운트
    # 윈도우(7500샘플) 안에 있는 R-peak만 처리
    arrhythmia_count = 0
    if r_peaks is not None and len(r_peaks) > 0:
        win_len = len(ecg_window)
        for peak in r_peaks:
            start, end = peak - 90, peak + 110
            if start < 0 or end > win_len:
                continue
            seg = ecg_window[start:end].astype(np.float32)
            max_val = np.max(np.abs(seg))
            if max_val > 0:
                seg = seg / max_val
            out = sess_track1.run(None, {'input': seg.reshape(1, 1, 200)})[0]
            cls = CLASS_NAMES[int(np.argmax(softmax(out[0])))]
            if cls != 'N':
                arrhythmia_count += 1

    # 위험도 산출
    risk_score, risk_level = calculate_risk(
        af_detected, af_prob, arr_class, arr_prob,
        hrv_sdnn, hrv_rmssd, hrv_lfhf, anomaly_detected,
        heart_rate, age, gender, medical_history,
        measurement_duration=measurement_duration
    )

    return {
        'arrhythmia_class': arr_class,
        'arrhythmia_prob':  arr_prob,
        'af_detected':      af_detected,
        'af_prob':          af_prob,
        'heart_rate':       heart_rate,
        'hrv_rmssd':        hrv_rmssd,
        'hrv_sdnn':         hrv_sdnn,
        'hrv_lfhf':         hrv_lfhf,
        'anomaly_detected': anomaly_detected,
        'arrhythmia_count': arrhythmia_count,
        'risk_score':       risk_score,
        'risk_level':       risk_level,
        'analyzed_at':      datetime.now(timezone.utc).isoformat(),
    }