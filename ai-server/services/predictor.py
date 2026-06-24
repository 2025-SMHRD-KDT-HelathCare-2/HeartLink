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
      모두 위험)으로 수정. 추가로, 심박수가 임상적으로 명백히
      위험한 수준(140 이상 또는 40 이하)이면 가중합산 점수와 무관하게
      바로 'high'로 분류하는 예외 규칙을 추가함.

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
    if heart_rate > 150:
        HR_score = 100      # 심한 빈맥 (심실빈맥 의심 수준)
    elif heart_rate > 130:
        HR_score = 70       # 중등도 빈맥
    elif heart_rate > 100:
        HR_score = 40       # 경미한 빈맥
    elif heart_rate < 40:
        HR_score = 100      # 심한 서맥
    elif heart_rate < 60:
        HR_score = 40       # 경미한 서맥
    else:
        HR_score = 0        # 정상 범위 (60~100)

    # HRV_score (가중치 0.15)
    # 정상 범위 이탈 정도를 점수화
    # SDNN 30ms 미만: 자율신경 기능 저하
    # RMSSD 18ms 미만: 부교감신경 활동 저하
    # [v2 추가] 위 지표가 너무 "높은" 경우도 위험 신호로 추가
    # (리듬이 불규칙하면 RR간격 변동성이 비정상적으로 커져서
    #  HRV 수치 자체가 매우 높게 측정될 수 있음)
    # 30초 미만 측정: LF 대역 Welch 주파수 해상도 부족으로 LF/HF 제외
    SDNN_dev  = max(0, (30 - hrv_sdnn) / 30, (hrv_sdnn - 60) / 60) * 100
    RMSSD_dev = max(0, (18 - hrv_rmssd) / 18, (hrv_rmssd - 45) / 45) * 100
    if measurement_duration >= 120:
        LFHF_dev  = 50 if (hrv_lfhf < 0.5 or hrv_lfhf > 2.0) else 0
        HRV_score = min(100, (SDNN_dev + RMSSD_dev + LFHF_dev) / 3)
    else:
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

    # ==================================================
    # 3단계: 최종 점수 + 위험도 등급
    # ==================================================
    risk_score = min(100, round(ecg_score * clinical_factor))

    # --------------------------------------------------
    # [점수 임계값 산출 근거]
    # 계산일   : 2026-06-23
    # 계산 방법: 실제 사용자 데이터가 없으므로 아래 조건으로 2,000건을
    #            가상 시뮬레이션한 뒤, 특수 케이스(절대 기준 해당 건)를
    #            제외한 1,951건을 대상으로 percentile 산출
    #
    # 시뮬레이션 분포 설계 (ai-server/scripts/calc_percentile_v2.py 참고)
    #   트랙1 클래스 비율 : N=89%, SVEB=4%, VEB=7%, F=1%, Q=0%
    #     (MIT-BIH 데이터셋 기반 실제 트랙1 모델 출력 분포와 동일하게 맞춤)
    #   arr_prob         : N~Normal(0.90,0.05), SVEB~Normal(0.72,0.14),
    #                      VEB~Normal(0.55,0.13) clip 0.699, F~Normal(0.65,0.15)
    #   heart_rate       : Normal(76,14), clip(45,138) / AF시 Normal(85,18) clip(50,99)
    #   hrv_sdnn         : Normal(38,14), clip(8,90)
    #   hrv_rmssd        : Normal(28,12), clip(5,70)
    #   hrv_lfhf         : Normal(1.4,0.7), clip(0.2,3.5)
    #   anomaly_detected : N=15%, 이상클래스=45% 확률
    #   환자 프로파일     : age Normal(72,8), 여성 60%, 고혈압 55%, 당뇨 25%
    #   AF 발생률        : 3% (트랙2 모델 별도, 전원 특수케이스 제외됨)
    #
    #   산출 결과
    #   - 50th percentile (MID_THRESHOLD) = 3점
    #   - 90th percentile (HIGH_THRESHOLD) = 14점
    #
    # ※ 이 임계값(14, 3)은 2026-06-23에 가상 시뮬레이션 데이터로
    #   계산한 추정치이며, 실제 사용자 risk_score 분포와 다를 수 있음.
    #   서비스 운영 후 실제 데이터가 쌓이면 반드시 재계산 필요.
    # --------------------------------------------------
    HIGH_THRESHOLD = 14  # 90th percentile (비특수케이스 상위 10% 기준)
    MID_THRESHOLD  = 3   # 50th percentile

    # 위험도 등급 결정
    # 1순위: 특수 케이스(임상적 절대 기준) — percentile과 무관하게 우선 적용
    # AF는 심박수랑 같이 봐야 함 (간호사 임상 피드백)
    if af_detected and heart_rate >= 100:
        # AF + 빠른 심박수 → 당장 응급실
        risk_level = 'high'
        risk_score = max(risk_score, 80)
    elif af_detected and heart_rate < 100:
        # AF + 정상 심박수 → 근시일 내 병원 방문
        risk_level = 'mid'
        risk_score = max(risk_score, 50)
    elif arr_class == 'VEB' and arr_prob >= 0.70:
        # 심실성 부정맥 빈발 → 위험
        risk_level = 'high'
        risk_score = max(risk_score, 80)
    elif heart_rate >= 140 or heart_rate <= 40:
        # 심한 빈맥/서맥 → 부정맥 분류 결과와 무관하게 high
        risk_level = 'high'
        risk_score = max(risk_score, 80)
    # 2순위: 비특수케이스 — percentile 기반 상대 기준
    elif risk_score >= HIGH_THRESHOLD:
        risk_level = 'high'
    elif risk_score >= MID_THRESHOLD:
        risk_level = 'mid'
    else:
        risk_level = 'low'

    return risk_score, risk_level


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