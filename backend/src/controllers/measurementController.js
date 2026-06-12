import Measurement from '../models/Measurement.js';
import GuardianRelation from '../models/GuardianRelation.js';
import { analyze } from '../services/aiService.js';

async function verifyGuardianAccess(guardianId, userId) {
  const relation = await GuardianRelation.findOne({
    guardian_id: guardianId,
    user_id: userId,
    relation_status: 'accepted',
  });
  return !!relation;
}

function parseCSVBuffer(buffer) {
  const lines = buffer.toString('utf8').trim().split(/\r?\n/);
  if (lines.length < 2) return { points: [], sampleRate: 250 };

  const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
  const xIdx = headers.findIndex(h => ['timestamp', 'time', 'x', 't'].includes(h));
  const yIdx = headers.findIndex(h => ['ecg', 'y', 'value', 'signal', 'mv'].includes(h));
  if (yIdx === -1) return { points: [], sampleRate: 250 };

  const points = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',');
    const y = parseFloat(cols[yIdx]);
    if (!isNaN(y)) points.push(y);
  }

  let sampleRate = 250;
  if (xIdx >= 0 && lines.length > 2) {
    const x1 = parseFloat(lines[1].split(',')[xIdx]);
    const x2 = parseFloat(lines[2].split(',')[xIdx]);
    if (!isNaN(x1) && !isNaN(x2) && x2 > x1) {
      sampleRate = Math.round(1 / (x2 - x1));
    }
  }

  return { points, sampleRate };
}

function movingAverage(data, window = 5) {
  return data.map((_, i) => {
    const slice = data.slice(Math.max(0, i - window + 1), i + 1);
    const avg = slice.reduce((a, b) => a + b, 0) / slice.length;
    return Math.round(avg * 1000) / 1000;
  });
}

function downsample(data, maxPoints = 1000) {
  if (data.length <= maxPoints) return data;
  const step = data.length / maxPoints;
  return Array.from({ length: maxPoints }, (_, i) => data[Math.floor(i * step)]);
}

function detectRPeaks(data, sampleRate) {
  const max = Math.max(...data);
  const threshold = max * 0.6;
  const minGap = Math.floor(sampleRate * 0.3);
  const peaks = [];

  for (let i = 1; i < data.length - 1; i++) {
    if (data[i] > threshold && data[i] > data[i - 1] && data[i] > data[i + 1]) {
      if (peaks.length === 0 || i - peaks[peaks.length - 1] > minGap) {
        peaks.push(i);
      }
    }
  }
  return peaks.map(idx => Math.round((idx / sampleRate) * 1000) / 1000);
}

function buildEcgPoints(yValues, effectiveSampleRate) {
  return yValues.map((y, i) => ({
    x: Math.round((i / effectiveSampleRate) * 1000) / 1000,
    y,
  }));
}

export const uploadECG = async (req, res, next) => {
  try {
    const { measured_at } = req.body;
    const file = req.file;
    const ext = file.originalname.split('.').pop().toUpperCase();

    let ecgWaveformLite = [];
    let rPeaks = [];
    let effectiveSampleRate = 250;

    if (ext === 'CSV') {
      const { points, sampleRate } = parseCSVBuffer(file.buffer);
      if (points.length > 0) {
        const smoothed = movingAverage(points, 5);
        ecgWaveformLite = downsample(smoothed, 1000);
        rPeaks = detectRPeaks(smoothed, sampleRate);
        const duration = points.length / sampleRate;
        effectiveSampleRate = Math.round(ecgWaveformLite.length / duration);
      }
    }

    const measurement = await Measurement.create({
      user_id: req.user.id,
      file_name: file.originalname,
      file_ext: ext,
      file_size: file.size,
      status: 'pending',
      measured_at: measured_at || new Date(),
      ecg_waveform_lite: ecgWaveformLite,
      r_peaks: rPeaks,
      sampling_rate: effectiveSampleRate,
    });

    analyze({
      fileBuffer: file.buffer,
      fileName: file.originalname,
      measurementId: measurement._id,
      userId: req.user.id,
    }).then(() => {
      Measurement.findByIdAndUpdate(measurement._id, { status: 'processing' }).catch(() => {});
    }).catch(err => {
      console.error('FastAPI 전송 실패:', err.message);
      Measurement.findByIdAndUpdate(measurement._id, { status: 'failed' }).catch(() => {});
    });

    res.status(201).json({
      measurementId: measurement._id,
      status: 'pending',
      ecgPoints: buildEcgPoints(ecgWaveformLite, effectiveSampleRate),
      rPeaks,
      sampleRate: effectiveSampleRate,
    });
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

    const sr = measurement.sampling_rate || 250;
    res.json({
      ...measurement.toObject(),
      ecgPoints: buildEcgPoints(measurement.ecg_waveform_lite, sr),
      rPeaks: measurement.r_peaks,
      sampleRate: sr,
    });
  } catch (err) {
    next(err);
  }
};

export const getPatientMeasurements = async (req, res, next) => {
  try {
    const hasAccess = await verifyGuardianAccess(req.user.id, req.params.userId);
    if (!hasAccess) return res.status(403).json({ message: '해당 환자의 데이터에 접근 권한이 없습니다.' });

    const measurements = await Measurement.find({ user_id: req.params.userId }).sort({ measured_at: -1 });
    res.json(measurements);
  } catch (err) {
    next(err);
  }
};

export const getPatientMeasurement = async (req, res, next) => {
  try {
    const hasAccess = await verifyGuardianAccess(req.user.id, req.params.userId);
    if (!hasAccess) return res.status(403).json({ message: '해당 환자의 데이터에 접근 권한이 없습니다.' });

    const measurement = await Measurement.findOne({ _id: req.params.id, user_id: req.params.userId });
    if (!measurement) return res.status(404).json({ message: '없는 측정 데이터입니다.' });
    res.json(measurement);
  } catch (err) {
    next(err);
  }
};
