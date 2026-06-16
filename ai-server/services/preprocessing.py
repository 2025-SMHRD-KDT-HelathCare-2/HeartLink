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
    R-peak 검출
    threshold: 최대값의 60% 이상인 피크만 검출
    distance: 최소 박동 간격 (300ms = 200bpm 제한)
    """
    threshold = np.max(signal) * 0.6
    distance  = int(fs * 0.3)
    peaks, _  = find_peaks(signal, height=threshold, distance=distance)
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