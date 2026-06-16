# ==================================================
# 전처리 모듈
# --------------------------------------------------
# 역할:
# 1. ECG 파일(CSV/WFDB) 읽기
# 2. 리샘플링 (250Hz 통일)
# 3. 밴드패스 필터 (0.5~40Hz 잡음 제거)
# 4. R-peak 검출
# 5. beat 추출 (트랙 1 입력: 200샘플)
# 6. 30초 윈도우 추출 (트랙 2 입력: 7500샘플)
# 7. HRV 특징값 계산 (RMSSD, SDNN, LF/HF)
# 8. 심박수(BPM) 계산
# ==================================================

import numpy as np
from scipy.signal import butter, filtfilt, resample as sp_resample, find_peaks


def bandpass_filter(signal, lowcut=0.5, highcut=40.0, fs=250, order=4):
    """
    밴드패스 필터 (0.5~40Hz)
    0.5Hz 이하: 기저선 흔들림 제거
    40Hz 이상: 근육 잡음, 전기 잡음 제거
    """
    nyq = 0.5 * fs
    b, a = butter(order, [lowcut/nyq, highcut/nyq], btype='band')
    return filtfilt(b, a, signal)


def detect_r_peaks(signal, fs=250):
    """
    R-peak 검출 (Pan-Tompkins 알고리즘)
    --------------------------------------------------
    ECG R-peak 감지 표준 알고리즘 (1985년 Pan & Tompkins 논문 기반)
    실제 서비스에서 갤럭시 워치 raw signal만 들어올 때 사용
    학습 때는 MIT-BIH .atr annotation 파일로 R-peak 가져왔지만
    실제 서비스에서는 annotation 파일이 없으므로 직접 감지해야 함

    Parameters
    ----------
    signal : np.ndarray, ECG 신호 (250Hz 리샘플링 후)
    fs     : int, 샘플링 레이트 (기본 250Hz)

    Returns
    -------
    peaks : np.ndarray, R-peak 위치 (샘플 인덱스)

    알고리즘 5단계:
    1. 밴드패스 필터 (5~15Hz): QRS 성분만 강조, 나머지 잡음 제거
    2. 미분: 신호의 기울기를 강조 → R-peak의 급격한 상승 부분 부각
    3. 제곱: 음수를 양수로 변환 + 큰 값 더 강조
    4. 이동평균 (150ms): 노이즈 제거, 부드럽게 만들기
    5. 피크 검출: 임계값 이상 + 최소 간격 300ms 조건으로 R-peak 찾기
    """

    # 1단계: 밴드패스 필터 (5~15Hz)
    # QRS 복합파 주파수 성분은 5~15Hz에 집중되어 있음
    # 이 범위 밖의 P파, T파, 기저선 잡음 제거
    nyq = 0.5 * fs
    b, a = butter(4, [5/nyq, 15/nyq], btype='band')
    filtered = filtfilt(b, a, signal)

    # 2단계: 미분
    # R-peak는 급격히 올라갔다 내려오는 부분
    # 미분하면 기울기가 강조되어 R-peak 위치 파악 쉬워짐
    diff = np.diff(filtered)

    # 3단계: 제곱
    # 미분값이 음수면 의미 없으므로 제곱해서 양수로 만듦
    # 동시에 큰 값(R-peak)은 더 크게, 작은 값(잡음)은 더 작게
    squared = diff ** 2

    # 4단계: 이동평균 (150ms 윈도우)
    # 150ms = 약 37샘플 (250Hz 기준)
    # 노이즈 제거하고 부드럽게 만들어 피크 검출 안정화
    window_size = int(0.15 * fs)
    integrated = np.convolve(squared, np.ones(window_size)/window_size, mode='same')

    # 5단계: 피크 검출
    # threshold: 이동평균값의 50% 이상인 피크만 검출
    # distance: 최소 300ms 간격 (200BPM 이상은 부정맥으로 간주)
    threshold = np.mean(integrated) * 0.5
    distance  = int(fs * 0.3)
    peaks, _  = find_peaks(integrated, height=threshold, distance=distance)

    return peaks


def calculate_hrv(r_peaks, fs=250):
    """
    HRV 특징값 계산
    - RMSSD: 연속 RR간격 차이의 제곱평균제곱근 (부교감신경 활동)
    - SDNN: RR간격 표준편차 (자율신경 전체 활동)
    - LF/HF ratio: 저주파/고주파 비율 (교감/부교감 균형)
    정상 범위: SDNN 30~60ms, RMSSD 18~45ms, LF/HF 0.5~2.0
    """
    if len(r_peaks) < 2:
        return 0.0, 0.0, 1.0

    rr_intervals = np.diff(r_peaks) / fs * 1000
    rmssd = float(np.sqrt(np.mean(np.diff(rr_intervals) ** 2)))
    sdnn  = float(np.std(rr_intervals))

    if len(rr_intervals) >= 4:
        mid  = len(rr_intervals) // 2
        lf   = float(np.std(rr_intervals[:mid]))
        hf   = float(np.std(rr_intervals[mid:]))
        lfhf = lf / hf if hf > 0 else 1.0
    else:
        lfhf = 1.0

    return rmssd, sdnn, lfhf


def calculate_heart_rate(r_peaks, fs=250):
    """
    평균 심박수 계산 (BPM)
    RR간격 평균으로 계산: 60000 / mean_rr(ms)
    정상 범위: 60~100 BPM
    """
    if len(r_peaks) < 2:
        return 75.0
    rr_intervals = np.diff(r_peaks) / fs * 1000
    mean_rr = np.mean(rr_intervals)
    return float(60000 / mean_rr)


def preprocess_ecg(signal_raw, fs_original=250):
    """
    ECG 전처리 전체 파이프라인

    Parameters
    ----------
    signal_raw  : np.ndarray, 원본 ECG 신호
    fs_original : int, 원본 샘플링 레이트

    Returns
    -------
    dict:
        beat        : (200,) 대표 beat (트랙 1 입력)
        window      : (7500,) 30초 윈도우 (트랙 2 입력)
        hrv_features: (3,) [rmssd, sdnn, lfhf]
        heart_rate  : float, 평균 BPM
        r_peaks     : list, R-peak 위치
    """
    # 리샘플링 (250Hz 통일)
    if fs_original != 250:
        new_length = int(len(signal_raw) * 250 / fs_original)
        signal = sp_resample(signal_raw, new_length)
    else:
        signal = signal_raw.copy()

    # 밴드패스 필터
    signal = bandpass_filter(signal, fs=250)

    # R-peak 검출
    r_peaks = detect_r_peaks(signal, fs=250)

    # HRV 특징값
    rmssd, sdnn, lfhf = calculate_hrv(r_peaks, fs=250)
    hrv_features = np.array([rmssd, sdnn, lfhf], dtype=np.float32)

    # 심박수
    heart_rate = calculate_heart_rate(r_peaks, fs=250)

    # 대표 beat 추출 (중간 R-peak 기준, 200샘플)
    beat = np.zeros(200, dtype=np.float32)
    if len(r_peaks) > 0:
        mid_peak = r_peaks[len(r_peaks) // 2]
        start, end = mid_peak - 90, mid_peak + 110
        if start >= 0 and end <= len(signal):
            b = signal[start:end]
            max_val = np.max(np.abs(b))
            beat = (b / max_val).astype(np.float32) if max_val > 0 else b.astype(np.float32)

    # 30초 윈도우 추출 (7500샘플)
    window = np.zeros(7500, dtype=np.float32)
    if len(signal) >= 7500:
        window = signal[:7500].astype(np.float32)
    else:
        window[:len(signal)] = signal.astype(np.float32)

    return {
        'beat':         beat,
        'window':       window,
        'hrv_features': hrv_features,
        'heart_rate':   heart_rate,
        'r_peaks':      r_peaks.tolist(),
    }