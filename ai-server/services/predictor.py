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

TRACK1_MODEL = os.path.join(MODEL_DIR, 'track1_resnet1d.onnx')
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
                   age=70, gender='F', medical_history=[]):
    """
    위험도 산출 함수
    3단계로 계산: ECG 점수 → 임상 보정 → 최종 등급

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

    # ==================================================
    # 1단계: ECG 분석 점수 (0~100)
    # 4가지 점수를 가중치로 합산
    # ==================================================

    # AF_score (가중치 0.30)
    # AFib 감지됐을 때만 확률 × 100, 아니면 0
    # 심박수랑 같이 봐야 해서 단독으로 high 안 됨 (3단계에서 처리)
    AF_score = af_prob * 100 if af_detected else 0

    # ARR_score (가중치 0.40, 가장 높음)
    # 부정맥 클래스별 기본 위험점수 × 예측 확률
    # VEB(심실성): 90점 → 가장 위험, 빈발 시 심실빈맥 위험
    # F(융합박동): 40점 → 중간 위험
    # Q(미분류):   30점 → 불확실
    # SVEB(심실상성): 20점 → 심방 발생, 별로 안 위험
    # N(정상):     0점
    arr_base  = {'N': 0, 'SVEB': 20, 'VEB': 90, 'F': 40, 'Q': 30}
    ARR_score = arr_base.get(arr_class, 0) * arr_prob

    # HRV_score (가중치 0.20)
    # 정상 범위 이탈 정도를 점수화
    # SDNN 30ms 미만: 자율신경 기능 저하
    # RMSSD 18ms 미만: 부교감신경 활동 저하
    # LF/HF 0.5~2.0 범위 밖: 교감/부교감 불균형
    SDNN_dev  = max(0, (30 - hrv_sdnn) / 30) * 100
    RMSSD_dev = max(0, (18 - hrv_rmssd) / 18) * 100
    LFHF_dev  = 50 if (hrv_lfhf < 0.5 or hrv_lfhf > 2.0) else 0
    HRV_score = (SDNN_dev + RMSSD_dev + LFHF_dev) / 3

    # ANOM_score (가중치 0.10)
    # Isolation Forest가 HRV 패턴 이상 감지 시 100점
    # 위 3개 지표로 못 잡는 패턴 이상을 보완
    ANOM_score = 100 if anomaly_detected else 0

    # 가중 합산
    ecg_score = (0.30 * AF_score +
                 0.40 * ARR_score +
                 0.20 * HRV_score +
                 0.10 * ANOM_score)

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

    # 위험도 등급 결정
    # AF는 심박수랑 같이 봐야 함 (간호사 임상 피드백)
    if af_detected and heart_rate >= 100:
        # AF + 빠른 심박수 → 당장 응급실
        risk_level = 'high'
    elif af_detected and heart_rate < 100:
        # AF + 정상 심박수 → 근시일 내 병원 방문
        risk_level = 'mid'
    elif arr_class == 'VEB' and arr_prob >= 0.70:
        # 심실성 부정맥 빈발 → 위험
        risk_level = 'high'
    elif risk_score >= 67:
        risk_level = 'high'
    elif risk_score >= 34:
        risk_level = 'mid'
    else:
        risk_level = 'low'

    return risk_score, risk_level


def predict(ecg_beat, ecg_window, hrv_features, heart_rate=75.0,
            age=70, gender='F', medical_history=[]):
    """
    전체 예측 파이프라인

    Parameters
    ----------
    ecg_beat    : np.ndarray (200,)  beat 단위 신호 → 트랙 1 입력
    ecg_window  : np.ndarray (7500,) 30초 윈도우   → 트랙 2 입력
    hrv_features: np.ndarray (3,)    [rmssd, sdnn, lfhf]
    heart_rate  : float, 평균 BPM
    age, gender, medical_history: 위험도 보정용 사용자 정보

    Returns
    -------
    dict: 분석 결과 전체
    """

    # 트랙 1: 부정맥 분류
    # 입력 shape: (1, 1, 200) → [배치, 채널, 길이]
    input1    = ecg_beat.reshape(1, 1, 200).astype(np.float32)
    output1   = sess_track1.run(None, {'input': input1})[0]  # (1, 5)
    probs1    = softmax(output1[0])
    arr_idx   = int(np.argmax(probs1))
    arr_class = CLASS_NAMES[arr_idx]
    arr_prob  = float(probs1[arr_idx])

    # 트랙 2: AFib 감지
    # 입력 shape: (1, 1, 7500) → [배치, 채널, 길이]
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

    # 위험도 산출
    risk_score, risk_level = calculate_risk(
        af_detected, af_prob, arr_class, arr_prob,
        hrv_sdnn, hrv_rmssd, hrv_lfhf, anomaly_detected,
        heart_rate, age, gender, medical_history
    )

    return {
        'arrhythmia_class': arr_class,
        'arrhythmia_prob':  arr_prob,
        'af_detected':      af_detected,
        'af_prob':          af_prob,
        'hrv_rmssd':        hrv_rmssd,
        'hrv_sdnn':         hrv_sdnn,
        'hrv_lfhf':         hrv_lfhf,
        'anomaly_detected': anomaly_detected,
        'risk_score':       risk_score,
        'risk_level':       risk_level,
        'analyzed_at':      datetime.now(timezone.utc).isoformat(),
    }