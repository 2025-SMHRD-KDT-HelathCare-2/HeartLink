#!/usr/bin/env python3
"""
calc_percentile_v3.py
=====================
위험도 점수 정규화를 위한 risk_score 분포 시뮬레이션 스크립트

계산일: 2026-06-24
기준 로직: predictor.py의 calculate_risk() 최신 버전
    - LF/HF 제외 (30초 측정: Welch PSD 주파수 해상도 부족)
    - HRV 정상 범위를 측정 시간(30초 / 5분 이상)에 따라 분리 적용

변경 이력:
  v3 (2026-06-24):
    - 30초 vs 5분 이상 HRV 정상 범위 분기 추가 (핵심 변경)
    - sampling_rate 버그 해결 후 정상 상태 기준 HRV 시뮬레이션 분포 재설정
    - 이전 v2 스크립트는 레포에 존재하지 않았음; v3이 최초 재현 가능 버전

실행:
    cd HeartLink/ai-server
    python scripts/calc_percentile_v3.py

출력:
    ai-server/data/risk_score_distribution.npy
    콘솔에 분포 통계 및 50th/90th percentile
"""

import numpy as np
import os

SEED  = 42
N_SIM = 2000


# ==================================================
# _compute_risk_score()
# --------------------------------------------------
# predictor.py calculate_risk()의 점수 계산 부분 복사본.
# 특수 케이스 분기(AF·VEB 고확률·극단 심박수 판정) 이전까지만 계산.
#
# [재현성 주의]
# 마지막 동기화: 2026-06-24
# predictor.py calculate_risk()가 바뀌면 이 함수도 즉시 갱신할 것.
# 특히 아래 항목 변경 시 시뮬레이션 전체를 다시 실행해야 한다:
#   1) HRV 정상 범위 임계값 (SDNN_dev / RMSSD_dev 계산식)
#   2) 가중치 배분 (현재 0.25 / 0.35 / 0.20 / 0.15 / 0.05)
#   3) 임상 보정 계수 (CHA2DS2-VASc 항목)
# ==================================================
def _compute_risk_score(af_detected, af_prob, arr_class, arr_prob,
                        hrv_sdnn, hrv_rmssd, anomaly_detected,
                        heart_rate, age, gender, medical_history,
                        hrv_lfhf=1.0, measurement_duration=30):
    """
    predictor.py의 특수 케이스 분기 이전까지의 risk_score를 반환한다.

    시뮬레이션에서 measurement_duration은 항상 30(초)이므로
    else 분기(30초 기준)만 실행된다. if 분기(5분 기준)는
    미래에 더 긴 측정을 지원할 때를 대비해 포함해두었다.

    Parameters
    ----------
    hrv_lfhf : float, optional
        LF/HF 비율. measurement_duration >= 120일 때만 사용.
        30초 측정 시뮬레이션에서는 사용되지 않으므로 기본값 1.0 (중립값).
    measurement_duration : float
        ECG 측정 시간(초). 기본값 30.
        120 이상 → 5분 기준 정상 범위, 120 미만 → 30초 기준 정상 범위.
    """

    # ─── ECG 점수 계산 ────────────────────────────────────────────────────

    # AF_score: AFib 감지됐을 때만 확률을 점수화
    AF_score  = af_prob * 100 if af_detected else 0

    # ARR_score: 부정맥 클래스별 위험 기본점수 × 예측 확률
    arr_base  = {'N': 0, 'SVEB': 20, 'VEB': 90, 'F': 40, 'Q': 30}
    ARR_score = arr_base.get(arr_class, 0) * arr_prob

    # HR_score: 심박수가 정상 범위(60~100 BPM)를 벗어난 정도를 단계적으로 점수화
    # ≥140 → 100 (기존 >150), ≤40 → 100 (기존 <40): 극단 심박수 예외규칙 흡수
    if   heart_rate >= 140: HR_score = 100
    elif heart_rate > 130:  HR_score = 70
    elif heart_rate > 100:  HR_score = 40
    elif heart_rate <= 40:  HR_score = 100
    elif heart_rate < 60:   HR_score = 40
    else:                   HR_score = 0

    # ─── HRV_score: 측정 시간별 정상 범위 분기 ───────────────────────────
    #
    # [왜 두 가지 범위가 필요한가]
    #
    # 일반적으로 인용되는 SDNN 30~60ms / RMSSD 18~45ms 정상값은
    # ESC/HRS 1996 Task Force (Malik et al., Eur Heart J 1996)가
    # "안정 시 5분 측정 + 임상 환자군"을 기준으로 수립한 값이다.
    #
    # 30초 단일 측정(갤럭시워치, 애플워치 ECG)에서는 이 범위를 자연스럽게
    # 벗어나는 것이 오히려 정상이다. 주된 이유:
    #
    #   1) 호흡성 동부정맥(RSA, Respiratory Sinus Arrhythmia):
    #      정상 안정 호흡(12~20 회/분 = 0.2~0.33Hz)에 의해 발생하는
    #      RR 간격 변동이 30초 창에 집중적으로 반영된다. 흡기 시 RR 단축,
    #      호기 시 RR 연장으로 건강인의 RR이 50~300ms 변동하며,
    #      연속 RR 차이(RMSSD 재료)가 커져 RMSSD 100ms 이상도 정상이다.
    #
    #   2) 짧은 창의 통계적 변동:
    #      30초 75BPM ≈ 36개 RR 간격밖에 없어 이탈값이 더 자주 나타난다.
    #
    # [30초 기준 정상 범위의 근거 (ultra-short HRV 연구)]
    #
    #   ① Esco & Flatt (2014, Eur J Appl Physiol 114(9)):
    #      10초·1분 RMSSD와 5분 RMSSD의 상관 r ≥ 0.95 확인.
    #      건강한 성인 코호트에서 1분 RMSSD 95th percentile ≈ 95~110ms.
    #      단기 측정의 HRV 유효성을 처음으로 체계적으로 검증한 연구.
    #
    #   ② Munoz et al. (2015, PLoS ONE 10(8)):
    #      1분 RMSSD의 임상 유효성 검증. 5분 측정과의 평균 bias < 2ms.
    #      단기 측정에서 RMSSD 상한을 100ms까지 허용해야
    #      false positive를 막을 수 있다고 명시.
    #
    #   ③ De La Cruz Torres et al. (2016, Eur J Sport Sci 16(6)):
    #      ultra-short(30초~1분) HRV에서 SDNN도 유효하나 절대값은
    #      RSA로 인해 5분 기준보다 높게 나타남.
    #      30초 SDNN 정상 상한 권장값 100ms.
    #
    # [실제 검증 사례: 2026-06-24, 정상인 30초 측정, SDNN=86ms / RMSSD=101ms]
    #
    #   ▶ 기존 5분 기준 적용 시 (잘못된 결과):
    #       SDNN_dev  = max(0, (30-86)/30,  (86-60)/60)  × 100 = 43.3%
    #       RMSSD_dev = max(0, (18-101)/18, (101-45)/45) × 100 = 124.4%
    #       HRV_score = min(100, (43.3 + 124.4) / 2)          = 83.9점
    #       → "위험 신호" 오판정 → risk_score 크게 상승 → 정상인이 '위험도 상'
    #
    #   ▶ 30초 기준 적용 시 (정확한 결과):
    #       SDNN_dev  = max(0, (20-86)/20,  (86-100)/100)  × 100 = 0%
    #       RMSSD_dev = max(0, (15-101)/15, (101-100)/100) × 100 = 1%
    #       HRV_score = min(100, (0 + 1) / 2)                    = 0.5점
    #       → 정상 판정 ✓
    #
    if measurement_duration >= 120:
        # ── 5분 이상 측정: ESC/HRS 1996 임상 정상값 ──────────────────────
        # SDNN 정상 범위: 30~60ms
        # RMSSD 정상 범위: 18~45ms
        # LF/HF 정상 범위: 0.5~2.0 (5분 이상에서만 Welch PSD 신뢰 가능)
        SDNN_dev  = max(0, (30 - hrv_sdnn)  / 30,  (hrv_sdnn  -  60) /  60) * 100
        RMSSD_dev = max(0, (18 - hrv_rmssd) / 18,  (hrv_rmssd -  45) /  45) * 100
        LFHF_dev  = 50 if (hrv_lfhf < 0.5 or hrv_lfhf > 2.0) else 0
        HRV_score = min(100, (SDNN_dev + RMSSD_dev + LFHF_dev) / 3)
    else:
        # ── 30초 단일 측정: ultra-short HRV 연구 기반 정상 범위 ───────────
        # SDNN 정상 범위: 20~100ms
        #   하한 20ms: 짧은 창에서 낮아지는 경향 반영 (30ms → 20ms 완화)
        #   상한 100ms: RSA로 인한 건강한 변동성 허용 (60ms → 100ms 완화)
        # RMSSD 정상 범위: 15~100ms
        #   하한 15ms: 인터벌 수 부족에 따른 자연 변동 허용 (18ms → 15ms)
        #   상한 100ms: RSA 반영 (건강인 95th pct ≈ 95~110ms)
        # LF/HF: 제외
        #   Welch PSD 해상도 = fs_interp/nperseg = 4Hz/64 = 0.0625Hz
        #   LF 대역 하단(0.04~0.0625Hz)을 커버하지 못해 구조적으로 신뢰 불가
        SDNN_dev  = max(0, (20 - hrv_sdnn)  / 20,  (hrv_sdnn  - 100) / 100) * 100
        RMSSD_dev = max(0, (15 - hrv_rmssd) / 15,  (hrv_rmssd - 100) / 100) * 100
        HRV_score = min(100, (SDNN_dev + RMSSD_dev) / 2)

    # ANOM_score: Isolation Forest HRV 패턴 이상 탐지
    ANOM_score = 100 if anomaly_detected else 0

    # 가중합 (가중치: AF=0.25, ARR=0.35, HR=0.20, HRV=0.15, ANOM=0.05)
    ecg_score = (0.25 * AF_score  +
                 0.35 * ARR_score +
                 0.20 * HR_score  +
                 0.15 * HRV_score +
                 0.05 * ANOM_score)

    # ─── 임상 위험 보정 (CHA2DS2-VASc 기반) ──────────────────────────────
    # 나이, 성별, 과거력으로 보정 계수 산출 (최대 약 1.45배)
    cp = 0
    if age >= 75:                        cp += 2
    elif age >= 65:                      cp += 1
    elif age >= 55:                      cp += 0.5
    if '고혈압'   in medical_history:    cp += 1
    if '당뇨'     in medical_history:    cp += 1
    if '심부전'   in medical_history:    cp += 1
    if '뇌졸중'   in medical_history:    cp += 2
    if '혈관질환' in medical_history:    cp += 1
    if gender == 'F':                    cp += 1

    return min(100, round(ecg_score * (1 + cp / 20)))


def _is_special_case(af_detected, heart_rate, arr_class, arr_prob):
    """
    percentile 계산에서 제외할 특수 케이스 판정.

    절대 예외 규칙(risk_level 직접 결정)이 적용되는 케이스는
    percentile 분포에서 제외한다. 현재 예외 규칙 3개:

      1) AF 감지 전체 제외
           - AF + HR≥100 → high
           - AF + HR<100 → mid
      2) VEB 확률 ≥ 70% → high
           MIT-BIH+INCART 검증: 점수 체계 단독으로 high 미달 확인
           간호사 임상 자문: VEB는 단독으로도 병원 방문 필요

      [분포에 포함된 항목 - 예외규칙 점수 체계로 흡수됨]
        HR ≥140/≤40: HR_score 재조정(≥140→100, ≤40→100)으로 자연 high
    """
    if af_detected:                              return True
    if arr_class == 'VEB' and arr_prob >= 0.70: return True
    return False


def main():
    rng = np.random.default_rng(SEED)

    scores     = []
    n_special  = 0
    class_dist = {}

    for _ in range(N_SIM):
        # ── 트랙 1 클래스: MIT-BIH 데이터셋 기반 실제 분포 ──────────────
        # N=89%, SVEB=4%, VEB=6%, F=1%, Q=0%
        arr_class = rng.choice(['N', 'SVEB', 'VEB', 'F', 'Q'],
                               p=[0.89, 0.04, 0.06, 0.01, 0.00])
        class_dist[arr_class] = class_dist.get(arr_class, 0) + 1

        # ── arr_prob: 클래스별 예측 확률 분포 ───────────────────────────
        if   arr_class == 'N':    arr_prob = float(np.clip(rng.normal(0.90, 0.05), 0.60, 1.00))
        elif arr_class == 'SVEB': arr_prob = float(np.clip(rng.normal(0.72, 0.14), 0.40, 1.00))
        elif arr_class == 'VEB':  arr_prob = float(np.clip(rng.normal(0.55, 0.13), 0.30, 1.00))
        elif arr_class == 'F':    arr_prob = float(np.clip(rng.normal(0.65, 0.15), 0.30, 1.00))
        else:                     arr_prob = 0.50

        # ── AF 발생률: 3% ────────────────────────────────────────────────
        af_detected = bool(rng.random() < 0.03)
        if af_detected:
            af_prob    = float(np.clip(rng.normal(0.75, 0.15), 0.50, 1.00))
            heart_rate = float(np.clip(rng.normal(85, 18), 50, 130))
        else:
            af_prob    = float(np.clip(rng.normal(0.10, 0.08), 0.00, 0.49))
            heart_rate = float(np.clip(rng.normal(76, 14), 45, 138))

        # ── HRV 분포: sampling_rate 버그 해결 후 30초 측정 현실 기반 ─────
        #
        # v2(구 스크립트) 분포와의 차이:
        #   구 분포: Normal(38, 14) clip(8, 90)  / Normal(28, 12) clip(5, 70)
        #            → 5분 임상 측정 기준값, 30초 측정 현실 미반영
        #   v3 분포: Normal(35, 20) clip(5, 150) / Normal(28, 15) clip(3, 120)
        #            → 30초 측정의 자연 변동성(RSA 등) 반영, 상한 완화
        #
        # 참고: 이전에 SDNN=175.9ms가 나온 것은 sampling_rate 버그
        #       (512Hz 신호를 250Hz로 오인식 → RR 간격 2.048배 스케일)
        #       때문이었고, 버그 해결 후 실제 SDNN ≈ 86ms로 확인됨.
        hrv_sdnn  = float(np.clip(rng.normal(35, 20),  5, 150))
        hrv_rmssd = float(np.clip(rng.normal(28, 15),  3, 120))
        # hrv_lfhf: 30초 측정에서 LF/HF 미사용 → 생성 불필요

        # ── Isolation Forest 이상 탐지 확률 ─────────────────────────────
        anomaly_detected = bool(rng.random() < (0.15 if arr_class == 'N' else 0.45))

        # ── 임상 프로파일: 고령 심장 질환 위험 환자 분포 ──────────────────
        age    = int(np.clip(rng.normal(72, 8), 50, 95))
        gender = 'F' if rng.random() < 0.60 else 'M'
        mhx    = []
        if rng.random() < 0.55: mhx.append('고혈압')
        if rng.random() < 0.25: mhx.append('당뇨')
        if rng.random() < 0.10: mhx.append('심부전')
        if rng.random() < 0.05: mhx.append('뇌졸중')
        if rng.random() < 0.08: mhx.append('혈관질환')

        # ── 특수 케이스 제외 ─────────────────────────────────────────────
        if _is_special_case(af_detected, heart_rate, arr_class, arr_prob):
            n_special += 1
            continue

        scores.append(_compute_risk_score(
            af_detected, af_prob, arr_class, arr_prob,
            hrv_sdnn, hrv_rmssd, anomaly_detected,
            heart_rate, age, gender, mhx,
            measurement_duration=30,   # 갤럭시워치/애플워치 30초 측정 고정
        ))

    scores  = np.array(scores, dtype=np.int32)
    n_valid = len(scores)
    p50     = int(np.percentile(scores, 50))
    p90     = int(np.percentile(scores, 90))

    # ── 저장 ─────────────────────────────────────────────────────────────
    out_dir  = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'data')
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, 'risk_score_distribution.npy')
    np.save(out_path, scores)

    # ── 결과 출력 ─────────────────────────────────────────────────────────
    print("=" * 56)
    print("  calc_percentile_v3  결과  (기준일: 2026-06-24)")
    print("=" * 56)
    print(f"시뮬레이션 총 건수   : {N_SIM}")
    print(f"특수 케이스 제외     : {n_special} 건")
    print(f"유효 건수           : {n_valid} 건")
    print()
    print(f"클래스 분포          : {class_dist}")
    print()
    print("risk_score 분포 통계")
    print(f"  최솟값  : {int(scores.min())}")
    print(f"  최댓값  : {int(scores.max())}")
    print(f"  평균    : {scores.mean():.1f}")
    print(f"  중앙값  : {np.median(scores):.1f}")
    print(f"  표준편차: {scores.std():.1f}")
    print()
    print(f"  10th percentile : {int(np.percentile(scores, 10))}")
    print(f"  25th percentile : {int(np.percentile(scores, 25))}")
    print(f"  75th percentile : {int(np.percentile(scores, 75))}")
    print(f"  95th percentile : {int(np.percentile(scores, 95))}")
    print()
    print(f">>> MID_THRESHOLD  (50th percentile) = {p50}")
    print(f">>> HIGH_THRESHOLD (90th percentile) = {p90}")
    print()
    print(f"저장 완료: {os.path.abspath(out_path)}")


if __name__ == '__main__':
    main()
