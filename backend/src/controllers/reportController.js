import Report from '../models/Report.js';
import AnalysisResult from '../models/AnalysisResult.js';
import Measurement from '../models/Measurement.js';
import GuardianRelation from '../models/GuardianRelation.js';
import * as aiService from '../services/aiService.js';

async function verifyGuardianAccess(guardianId, userId) {
  const relation = await GuardianRelation.findOne({
    guardianId,
    userId,
    relationStatus: 'accepted',
  });
  return !!relation;
}

export const getReportList = async (req, res, next) => {
  try {
    const reports = await Report.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .populate('analysisId', 'riskScore');
    res.json(reports);
  } catch (err) {
    next(err);
  }
};

export const getReport = async (req, res, next) => {
  try {
    const report = await Report.findOne({ analysisId: req.params.analysisId, userId: req.user.id });
    if (!report) return res.status(404).json({ message: '리포트가 없습니다.' });
    const analysis = await AnalysisResult.findById(report.analysisId).select('riskScore heartRate measurementId');
    const measurement = analysis?.measurementId
      ? await Measurement.findById(analysis.measurementId).select('ecgWaveformLite rPeaks')
      : null;
    res.json({
      ...report.toObject(),
      riskScore: analysis?.riskScore ?? 0,
      heartRate: analysis?.heartRate ?? 0,
      ecgWaveformLite: measurement?.ecgWaveformLite ?? [],
      rPeaks: measurement?.rPeaks ?? [],
    });
  } catch (err) {
    next(err);
  }
};

export const generateReport = async (req, res, next) => {
  try {
    const existing = await Report.findOne({ analysisId: req.params.analysisId, userId: req.user.id });
    if (existing) return res.json(existing);

    // TODO: Gemini 연동으로 리포트 생성
    res.status(501).json({ message: '리포트 생성 미구현' });
  } catch (err) {
    next(err);
  }
};

export const getTTS = async (req, res, next) => {
  try {
    const report = await Report.findOne({ analysisId: req.params.analysisId, userId: req.user.id });
    if (!report) return res.status(404).json({ message: '리포트가 없습니다.' });
    if (!report.reportTextUser) return res.status(400).json({ message: 'TTS 변환할 텍스트가 없습니다.' });

    const speed = Number(req.query.speed ?? 1);
    const { data: audioBuffer } = await aiService.tts({ text: report.reportTextUser, speed });

    res.set('Content-Type', 'audio/mpeg');
    res.send(Buffer.from(audioBuffer));
  } catch (err) {
    next(err);
  }
};

export const getPatientReportList = async (req, res, next) => {
  try {
    const hasAccess = await verifyGuardianAccess(req.user.id, req.params.userId);
    if (!hasAccess) return res.status(403).json({ message: '해당 환자의 데이터에 접근 권한이 없습니다.' });

    const reports = await Report.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(reports);
  } catch (err) {
    next(err);
  }
};

export const getPatientReport = async (req, res, next) => {
  try {
    const hasAccess = await verifyGuardianAccess(req.user.id, req.params.userId);
    if (!hasAccess) return res.status(403).json({ message: '해당 환자의 데이터에 접근 권한이 없습니다.' });

    const report = await Report.findOne({ analysisId: req.params.analysisId, userId: req.params.userId });
    if (!report) return res.status(404).json({ message: '리포트가 없습니다.' });

    res.json({
      _id: report._id,
      analysisId: report.analysisId,
      userId: report.userId,
      reportTextGuardian: report.reportTextGuardian,
      createdAt: report.createdAt,
    });
  } catch (err) {
    next(err);
  }
};
