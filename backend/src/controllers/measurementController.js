import Measurement from '../models/Measurement.js';
import * as aiService from '../services/aiService.js';

// CSV를 직접 파싱해서 경량 파형과 R-peak를 추출하는 임시 함수
// (AI 서버 완성 전까지 사용, AI 서버 연동 시 이 부분 제거하고 fire-and-forget으로 복구)
function parseCSV(buffer) {
  const text = buffer.toString('utf-8');
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error('CSV 데이터가 너무 적습니다.');

  // 헤더에서 따옴표 제거 후 비교 (예: 'sample #','MLII','V5')
  const headers = lines[0].split(',').map(h => h.trim().replace(/^['"]|['"]$/g, '').toLowerCase());
  const candidates = ['ecg', 'y', 'value', 'signal', 'mv', 'mlii', 'v5', 'v1', 'v2', 'v6'];
  let yIdx = headers.findIndex(h => candidates.includes(h));
  // 못 찾으면 'sample #'(인덱스) 다음 컬럼을 신호로 간주
  if (yIdx === -1) {
    const sampleIdx = headers.findIndex(h => h.includes('sample'));
    yIdx = sampleIdx !== -1 ? sampleIdx + 1 : 1;
  }
  if (yIdx === -1 || yIdx >= headers.length) throw new Error('ECG 데이터 컬럼을 찾을 수 없습니다.');

  const raw = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const y = parseFloat(cols[yIdx]);
    if (!isNaN(y)) raw.push(y);
  }
  if (raw.length < 10) throw new Error('유효한 데이터가 너무 적습니다.');

  // 정규화: 평균을 빼고 -1~1 범위로 스케일링 (raw ADC 값 대응)
  const mean = raw.reduce((a, b) => a + b, 0) / raw.length;
  const centered = raw.map(v => v - mean);
  const maxAbs = centered.reduce((m, v) => Math.max(m, Math.abs(v)), 0) || 1;
  const waveform = centered.map(v => Math.round((v / maxAbs) * 1000) / 1000);

  const sampleRate = 250;

  const max = waveform.reduce((m, v) => Math.max(m, v), -Infinity);
  const threshold = max * 0.6;
  const rPeaks = [];
  for (let i = 1; i < waveform.length - 1; i++) {
    if (waveform[i] > threshold && waveform[i] > waveform[i-1] && waveform[i] > waveform[i+1]) {
      const idx = i;
      if (rPeaks.length === 0 || (idx - rPeaks[rPeaks.length - 1]) > sampleRate * 0.3) {
        rPeaks.push(idx);
      }
    }
  }

  // 시각화용 다운샘플링 (최대 5000개)
  const MAX_POINTS = 5000;
  let finalWaveform = waveform;
  let finalRPeaks = rPeaks;
  let finalSampleRate = sampleRate;

  if (waveform.length > MAX_POINTS) {
    const step = Math.ceil(waveform.length / MAX_POINTS);
    finalWaveform = waveform.filter((_, i) => i % step === 0);
    finalRPeaks = rPeaks.map(idx => Math.round(idx / step)).filter((v, i, arr) => arr.indexOf(v) === i);
    finalSampleRate = Math.round(sampleRate / step);
  }

  return { waveform: finalWaveform, rPeaks: finalRPeaks, sampleRate: finalSampleRate };
}

export const uploadECG = async (req, res, next) => {
  try {
    const { measured_at } = req.body;
    const file = req.file;

    const measurement = await Measurement.create({
      user_id: req.user.id,
      file_name: file.originalname,
      file_ext: file.originalname.split('.').pop().toUpperCase(),
      file_size: file.size,
      status: 'processing',
      measured_at: measured_at || new Date(),
    });

    // ===== 임시: AI 서버 대신 백엔드에서 CSV 직접 파싱 =====
    try {
      if (measurement.file_ext === 'CSV') {
        const { waveform, rPeaks, sampleRate } = parseCSV(file.buffer);

        await Measurement.findByIdAndUpdate(measurement._id, {
          ecg_waveform_lite: waveform,
          r_peaks: rPeaks,
          sampling_rate: sampleRate,
          status: 'completed',
        });
      } else {
        aiService.analyze({
          fileBuffer: file.buffer,
          fileName: file.originalname,
          measurementId: measurement._id,
          userId: req.user.id,
        }).catch(err => {
          console.error('FastAPI 전송 실패:', err.message);
          Measurement.findByIdAndUpdate(measurement._id, { status: 'failed' }).catch(() => {});
        });
      }
    } catch (parseErr) {
      console.error('CSV 파싱 실패:', parseErr.message);
      await Measurement.findByIdAndUpdate(measurement._id, { status: 'failed' });
    }
    // ===== 임시 로직 끝 =====

    res.status(201).json({ measurementId: measurement._id, status: 'processing' });
  } catch (err) {
    next(err);
  }
};

export const getMeasurements = async (req, res, next) => {
  try {
    const measurements = await Measurement.find({ user_id: req.user.id }).sort({ measured_at: -1 });
    res.json(measurements);
  } catch (err) {
    next(err);
  }
};

export const getMeasurement = async (req, res, next) => {
  try {
    const measurement = await Measurement.findOne({ _id: req.params.id, user_id: req.user.id });
    if (!measurement) return res.status(404).json({ message: '없는 측정 데이터입니다.' });
    res.json(measurement);
  } catch (err) {
    next(err);
  }
};

// 보호자가 특정 사용자(피보호자)의 측정 목록 조회
export const getPatientMeasurements = async (req, res, next) => {
  try {
    const measurements = await Measurement.find({ user_id: req.params.userId }).sort({ measured_at: -1 });
    res.json(measurements);
  } catch (err) {
    next(err);
  }
};

// 보호자가 특정 사용자(피보호자)의 측정 단건 조회
export const getPatientMeasurement = async (req, res, next) => {
  try {
    const measurement = await Measurement.findOne({ _id: req.params.id, user_id: req.params.userId });
    if (!measurement) return res.status(404).json({ message: '없는 측정 데이터입니다.' });
    res.json(measurement);
  } catch (err) {
    next(err);
  }
};