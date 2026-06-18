import Report from '../models/Report.js';
import AnalysisResult from '../models/AnalysisResult.js';
import Measurement from '../models/Measurement.js';
import GuardianRelation from '../models/GuardianRelation.js';
import User from '../models/User.js';
import * as aiService from '../services/aiService.js';
import { synthesize as synthesizeTTS } from '../services/ttsService.js';

async function verifyGuardianAccess(guardianId, userId) {
  const relation = await GuardianRelation.findOne({
    guardianId,
    userId,
    relationStatus: 'accepted',
  });
  return !!relation;
}

function computeMaxRiskLevel(analyses) {
  if (analyses.some(a => a.riskLevel === 'high')) return 'high';
  if (analyses.some(a => a.riskLevel === 'mid')) return 'mid';
  return 'low';
}

// 내 리포트 목록 조회 (최신 분석의 riskScore 포함)
export const getReportList = async (req, res, next) => {
  try {
    const reports = await Report.find({ userId: req.user.id }).sort({ createdAt: -1 });

    const enhanced = await Promise.all(reports.map(async r => {
      const latestId = r.analysisIds?.[r.analysisIds.length - 1];
      const analysis = latestId
        ? await AnalysisResult.findById(latestId).select('riskScore')
        : null;
      const obj = r.toObject();
      return {
        ...obj,
        riskLevel:        r.maxRiskLevel ?? obj.riskLevel,            // 신·구 스키마 모두 처리
        riskScore:        analysis?.riskScore ?? 0,
        analysisId:       r._id,                                      // 프론트 navigate용 (report _id로 대체)
        report_text_user: r.reportText ?? obj.reportTextUser,         // compat alias
        reportTextUser:   r.reportText ?? obj.reportTextUser,         // compat alias
      };
    }));

    res.json(enhanced);
  } catch (err) {
    next(err);
  }
};

// 특정 리포트 단건 조회 (reportId 기준)
export const getReport = async (req, res, next) => {
  try {
    const report = await Report.findOne({ _id: req.params.reportId, userId: req.user.id });
    if (!report) return res.status(404).json({ message: '리포트가 없습니다.' });

    // 최신 분석 결과에서 심박수·ECG 파형 가져오기
    const latestAnalysis = report.analysisIds?.length
      ? await AnalysisResult.findById(report.analysisIds[report.analysisIds.length - 1])
          .select('riskScore heartRate measurementId')
      : null;

    const measurement = latestAnalysis?.measurementId
      ? await Measurement.findById(latestAnalysis.measurementId).select('ecgWaveformLite rPeaks')
      : null;

    res.json({
      ...report.toObject(),
      riskScore: latestAnalysis?.riskScore ?? 0,
      heartRate: latestAnalysis?.heartRate ?? 0,
      ecgWaveformLite: measurement?.ecgWaveformLite ?? [],
      rPeaks: measurement?.rPeaks ?? [],
    });
  } catch (err) {
    next(err);
  }
};

// 리포트 on-demand 생성: 마지막 리포트 이후의 미보고 분석 결과를 묶어서 리포트 생성
export const generateReport = async (req, res, next) => {
  try {
    // 이미 생성 중인 리포트가 있으면 그걸 반환
    const generating = await Report.findOne({ userId: req.user.id, reportType: 'self', status: 'generating' });
    if (generating) return res.json(generating);

    // 마지막 완료 리포트의 periodEnd를 기준으로 새 기간 시작점 결정
    const lastReport = await Report.findOne({ userId: req.user.id, reportType: 'self', status: 'completed' })
      .sort({ createdAt: -1 });

    const periodStart = lastReport?.periodEnd ?? new Date(0);
    const periodEnd = new Date();

    const analyses = await AnalysisResult.find({
      userId: req.user.id,
      analyzedAt: { $gt: periodStart, $lte: periodEnd },
    }).sort({ analyzedAt: 1 });

    if (analyses.length === 0) {
      return res.status(400).json({ message: '새로운 분석 결과가 없습니다.' });
    }

    const report = await Report.create({
      userId:          req.user.id,
      reportType:      'self',
      reportCategory:  'full_report',
      periodStart,
      periodEnd,
      analysisIds:     analyses.map(a => a._id),
      analysisCount:   analyses.length,
      maxRiskLevel:    computeMaxRiskLevel(analyses),
      status:          'generating',
    });

    // 202 즉시 반환 후 AI 리포트 텍스트 생성 (fire-and-forget)
    res.status(202).json(report);

    const user = await User.findById(req.user.id).select('age gender medicalHistory');
    const latest = analyses[analyses.length - 1];

    aiService.generateReport({
      analysisId:      latest._id,
      userId:          req.user.id,
      age:             user?.age,
      gender:          user?.gender,
      medicalHistory:  user?.medicalHistory,
      arrhythmiaClass: latest.arrhythmiaClass,
      arrhythmiaProb:  latest.arrhythmiaProb,
      afDetected:      latest.afDetected,
      afProb:          latest.afProb,
      hrvRmssd:        latest.hrvRmssd,
      hrvSdnn:         latest.hrvSdnn,
      hrvLfhf:         latest.hrvLfhf,
      anomalyDetected: latest.anomalyDetected,
      riskScore:       latest.riskScore,
      riskLevel:       latest.riskLevel,
      heartRate:       latest.heartRate,
    }).then(async ({ data: reportData }) => {
      await Report.findByIdAndUpdate(report._id, {
        reportText:       reportData.report_text_user ?? reportData.report_text_guardian,
        recommendedAction: reportData.recommended_action,
        status:           'completed',
      });
    }).catch(async (err) => {
      console.error('리포트 생성 실패:', err.message);
      await Report.findByIdAndUpdate(report._id, { status: 'failed' });
    });

  } catch (err) {
    next(err);
  }
};

// TTS 재생 (reportId 기준)
export const getTTS = async (req, res, next) => {
  try {
    const report = await Report.findOne({ _id: req.params.reportId, userId: req.user.id });
    if (!report) return res.status(404).json({ message: '리포트가 없습니다.' });
    if (!report.reportText) return res.status(400).json({ message: 'TTS 변환할 텍스트가 없습니다.' });

    const speed = Number(req.query.speed ?? 1);
    const audioBuffer = await synthesizeTTS({ text: report.reportText, speed });

    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (err) {
    next(err);
  }
};

// 보호자: 환자 TTS
export const getGuardianTTS = async (req, res, next) => {
  try {
    const hasAccess = await verifyGuardianAccess(req.user.id, req.params.userId);
    if (!hasAccess) return res.status(403).json({ message: '해당 환자의 데이터에 접근 권한이 없습니다.' });

    const report = await Report.findOne({ userId: req.params.userId }).sort({ createdAt: -1 });
    if (!report) return res.status(404).json({ message: '리포트가 없습니다.' });

    const text = report.reportText;
    if (!text) return res.status(400).json({ message: 'TTS 변환할 텍스트가 없습니다.' });

    const speed = Number(req.query.speed ?? 1);
    const audioBuffer = await synthesizeTTS({ text, speed });

    res.set('Content-Type', 'audio/mpeg');
    res.send(audioBuffer);
  } catch (err) {
    next(err);
  }
};

// 보호자: 환자 리포트 목록
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

// 보호자: 환자 리포트 단건 (reportId 기준)
export const getPatientReport = async (req, res, next) => {
  try {
    const hasAccess = await verifyGuardianAccess(req.user.id, req.params.userId);
    if (!hasAccess) return res.status(403).json({ message: '해당 환자의 데이터에 접근 권한이 없습니다.' });

    const report = await Report.findOne({ _id: req.params.reportId, userId: req.params.userId });
    if (!report) return res.status(404).json({ message: '리포트가 없습니다.' });

    res.json({
      _id: report._id,
      analysisIds: report.analysisIds,
      userId: report.userId,
      reportText: report.reportText,
      createdAt: report.createdAt,
    });
  } catch (err) {
    next(err);
  }
};

// 보호자: 환자 최신 리포트 상세 (대시보드용)
export const getGuardianReport = async (req, res, next) => {
  try {
    const hasAccess = await verifyGuardianAccess(req.user.id, req.params.userId);
    if (!hasAccess) return res.status(403).json({ message: '해당 환자의 데이터에 접근 권한이 없습니다.' });

    const report = await Report.findOne({ userId: req.params.userId }).sort({ createdAt: -1 });
    if (!report) return res.status(404).json({ message: '리포트가 없습니다.' });

    const [analysis, user, recentAnalyses] = await Promise.all([
      AnalysisResult.findById(report.analysisIds?.[report.analysisIds.length - 1]),
      User.findById(req.params.userId).select('nickname'),
      AnalysisResult.find({ userId: req.params.userId })
        .sort({ analyzedAt: -1 })
        .limit(7)
        .select('analyzedAt hrvRmssd'),
    ]);

    const measurement = analysis?.measurementId
      ? await Measurement.findById(analysis.measurementId).select('ecgWaveformLite rPeaks')
      : null;

    const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
    const hrvTrend = [...recentAnalyses].reverse().map(a => ({
      day: WEEKDAYS[new Date(a.analyzedAt).getDay()],
      value: Math.round(a.hrvRmssd ?? 0),
    }));

    res.json({
      member_name: user?.nickname ?? '',
      created_at: report.createdAt,
      risk_score: analysis?.riskScore ?? 0,
      risk_level: analysis?.riskLevel ?? report.maxRiskLevel ?? 'low',
      heart_rate: analysis?.heartRate ?? 0,
      arrhythmia_count: analysis?.arrhythmiaCount ?? 0,
      report_text: report.reportText ?? '',
      report_text_guardian: report.reportText ?? '',
      ecg_waveform_lite: measurement?.ecgWaveformLite ?? [],
      r_peaks: measurement?.rPeaks ?? [],
      hrv_trend: hrvTrend,
    });
  } catch (err) {
    next(err);
  }
};
