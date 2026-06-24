import Report from '../models/Report.js';
import AnalysisResult from '../models/AnalysisResult.js';
import Measurement from '../models/Measurement.js';
import GuardianRelation from '../models/GuardianRelation.js';
import User from '../models/User.js';
import * as aiService from '../services/aiService.js';
import { synthesize as synthesizeTTS } from '../services/ttsService.js';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const CLASS_DISPLAY = { N: 'N (정상)', SVEB: 'SVEB', VEB: 'VEB', F: 'F', Q: 'Q' };

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

// 분석 결과 배열 → AI 서버에 보낼 기간 종합 요약값 계산
function computePeriodSummary(analyses) {
  const heartRates = analyses.map(a => a.heartRate ?? 0).filter(v => v > 0);
  const avgHeartRate = heartRates.length
    ? Math.round(heartRates.reduce((s, v) => s + v, 0) / heartRates.length)
    : 0;

  const afDates = new Set(
    analyses.filter(a => a.afDetected).map(a => new Date(a.analyzedAt).toISOString().slice(0, 10))
  );

  const totalArrhythmiaCount = analyses.reduce((s, a) => s + (a.arrhythmiaCount ?? 0), 0);

  const counts = { low: 0, mid: 0, high: 0 };
  for (const a of analyses) counts[a.riskLevel ?? 'low']++;
  const total = analyses.length || 1;
  const riskDistribution = {
    low:  Math.round(counts.low  / total * 100),
    mid:  Math.round(counts.mid  / total * 100),
    high: Math.round(counts.high / total * 100),
  };

  return {
    avgHeartRate,
    maxRiskLevel:         computeMaxRiskLevel(analyses),
    afDetectedDays:       afDates.size,
    totalArrhythmiaCount,
    riskDistribution,
  };
}

// 분석 결과 배열 → 일간 형식 응답 생성
function buildDailyPayload(analyses, report, latestAnalysis, memberName) {
  const heartRates = analyses.map(a => a.heartRate ?? 0).filter(v => v > 0);

  const hourlyHeartRate = analyses.map(a => ({
    time: new Date(a.analyzedAt).toLocaleTimeString('ko-KR', {
      hour: '2-digit', minute: '2-digit', hour12: false,
    }),
    bpm: Math.round(a.heartRate ?? 0),
    riskLevel: a.riskLevel ?? 'low',
  }));

  const classCounts = {};
  for (const a of analyses) {
    const cls = a.arrhythmiaClass ?? 'N';
    classCounts[cls] = (classCounts[cls] ?? 0) + 1;
  }
  const arrhythmiaByType = Object.entries(classCounts).map(([cls, count]) => ({
    type: CLASS_DISPLAY[cls] ?? cls,
    count,
  }));

  const base = {
    type: 'daily',
    date: (report?.periodStart ?? latestAnalysis?.analyzedAt ?? new Date()).toISOString().slice(0, 10),
    riskScore: latestAnalysis?.riskScore ?? 0,
    riskLevel: report?.maxRiskLevel ?? latestAnalysis?.riskLevel ?? 'low',
    reportText: report?.reportText ?? '',
    reportStatus: report?.status ?? 'completed',
    measurementCount: analyses.length,
    maxHeartRate: heartRates.length ? Math.max(...heartRates) : 0,
    avgHeartRate: heartRates.length ? Math.round(heartRates.reduce((s, v) => s + v, 0) / heartRates.length) : 0,
    minHeartRate: heartRates.length ? Math.min(...heartRates) : 0,
    afDetected: analyses.some(a => a.afDetected),
    hourlyHeartRate,
    arrhythmiaByType,
  };
  if (memberName !== undefined) base.memberName = memberName;
  return base;
}

// 분석 결과 배열 → 주간 형식 응답 생성
function buildWeeklyPayload(analyses, report, latestAnalysis, memberName) {
  const byDay = new Map();
  for (const a of analyses) {
    const key = WEEKDAYS[new Date(a.analyzedAt).getDay()];
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(a);
  }

  const dailyStats = Array.from(byDay.entries()).map(([day, dayArr]) => {
    const bpms = dayArr.map(a => a.heartRate ?? 0).filter(v => v > 0);
    const counts = { low: 0, mid: 0, high: 0 };
    for (const a of dayArr) counts[a.riskLevel ?? 'low']++;
    const total = dayArr.length || 1;
    const dominantRisk = counts.high > 0 ? 'high' : counts.mid > 0 ? 'mid' : 'low';
    return {
      day,
      avgBpm: bpms.length ? Math.round(bpms.reduce((s, v) => s + v, 0) / bpms.length) : 0,
      riskLevel: dominantRisk,
      low:  Math.round(counts.low  / total * 100),
      mid:  Math.round(counts.mid  / total * 100),
      high: Math.round(counts.high / total * 100),
    };
  });

  const hrvTrend = Array.from(byDay.entries()).map(([day, dayArr]) => ({
    day,
    rmssd: Math.round(dayArr.reduce((s, a) => s + (a.hrvRmssd ?? 0), 0) / dayArr.length),
    sdnn:  Math.round(dayArr.reduce((s, a) => s + (a.hrvSdnn  ?? 0), 0) / dayArr.length),
  }));

  const distinctDates   = new Set(analyses.map(a => new Date(a.analyzedAt).toISOString().slice(0, 10)));
  const afDates         = new Set(analyses.filter(a => a.afDetected).map(a => new Date(a.analyzedAt).toISOString().slice(0, 10)));
  const totalArrhythmia = analyses.reduce((s, a) => s + (a.arrhythmiaCount ?? 0), 0);

  const base = {
    type: 'weekly',
    startDate: (report?.periodStart ?? new Date()).toISOString().slice(0, 10),
    endDate:   (report?.periodEnd   ?? new Date()).toISOString().slice(0, 10),
    riskScore:             latestAnalysis?.riskScore ?? 0,
    riskLevel:             report?.maxRiskLevel ?? latestAnalysis?.riskLevel ?? 'low',
    reportText:            report?.reportText ?? '',
    reportStatus:          report?.status ?? 'completed',
    afDays:                afDates.size,
    totalArrhythmiaCount:  totalArrhythmia,
    measurementDays:       distinctDates.size,
    dailyStats,
    hrvTrend,
  };
  if (memberName !== undefined) base.memberName = memberName;
  return base;
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
        riskLevel:        r.maxRiskLevel ?? obj.riskLevel,
        riskScore:        analysis?.riskScore ?? 0,
        analysisId:       r._id,
        report_text_user: r.reportText ?? obj.reportTextUser,
        reportTextUser:   r.reportText ?? obj.reportTextUser,
      };
    }));

    res.json(enhanced);
  } catch (err) {
    next(err);
  }
};

// 특정 리포트 단건 조회 (reportId 기준) — 집계 차트 데이터 포함
export const getReport = async (req, res, next) => {
  try {
    const report = await Report.findOne({ _id: req.params.reportId, userId: req.user.id });
    if (!report) return res.status(404).json({ message: '리포트가 없습니다.' });

    const analyses = await AnalysisResult.find({ _id: { $in: report.analysisIds ?? [] } })
      .sort({ analyzedAt: 1 });

    const latestAnalysis = analyses[analyses.length - 1] ?? null;

    const period = report.reportPeriod ?? 'daily';

    if (period === 'weekly') {
      return res.json(buildWeeklyPayload(analyses, report, latestAnalysis, undefined));
    }
    return res.json(buildDailyPayload(analyses, report, latestAnalysis, undefined));
  } catch (err) {
    next(err);
  }
};

// 리포트 on-demand 생성: type(daily/weekly)과 analysisId 기준 날짜 범위 필터링
export const generateReport = async (req, res, next) => {
  try {
    // 이미 생성 중인 리포트가 있으면 그걸 반환
    const generating = await Report.findOne({ userId: req.user.id, reportType: 'self', status: 'generating' });
    if (generating) return res.json(generating);

    const { type = 'daily', analysisId } = req.body;

    // 기준 날짜 결정: analysisId가 있으면 그 분석 날짜, 없으면 오늘
    let refDate = new Date();
    if (analysisId) {
      const refAnalysis = await AnalysisResult.findById(analysisId).select('analyzedAt');
      if (refAnalysis?.analyzedAt) refDate = new Date(refAnalysis.analyzedAt);
    }

    // 날짜 범위 계산
    const endOfDay = new Date(refDate);
    endOfDay.setHours(23, 59, 59, 999);
    const startOfDay = new Date(refDate);
    startOfDay.setHours(0, 0, 0, 0);

    let periodStart, periodEnd;
    if (type === 'weekly') {
      periodEnd   = endOfDay;
      periodStart = new Date(endOfDay);
      periodStart.setDate(periodStart.getDate() - 6);
      periodStart.setHours(0, 0, 0, 0);
    } else {
      periodStart = startOfDay;
      periodEnd   = endOfDay;
    }

    const analyses = await AnalysisResult.find({
      userId:      req.user.id,
      analyzedAt:  { $gte: periodStart, $lte: periodEnd },
    }).sort({ analyzedAt: 1 });

    if (analyses.length === 0) {
      return res.status(400).json({ message: '해당 기간에 분석 결과가 없습니다.' });
    }

    const lastAnalysisAt = analyses[analyses.length - 1].analyzedAt;
    const reportPeriod   = type === 'weekly' ? 'weekly' : 'daily';

    // 동일 기간 기존 리포트가 있으면 재생성 없이 반환 (unique 인덱스 충돌 방지)
    const existing = await Report.findOne({
      userId:        req.user.id,
      reportType:    'self',
      reportPeriod,
      lastAnalysisAt,
    });
    if (existing) return res.json(existing);

    const report = await Report.create({
      userId:          req.user.id,
      reportType:      'self',
      reportCategory:  'fullReport',
      reportPeriod,
      periodStart,
      periodEnd,
      lastAnalysisAt,
      analysisIds:     analyses.map(a => a._id),
      analysisCount:   analyses.length,
      maxRiskLevel:    computeMaxRiskLevel(analyses),
      status:          'generating',
    });

    // 202 즉시 반환 후 AI 리포트 텍스트 생성 (fire-and-forget)
    res.status(202).json(report);

    const user = await User.findById(req.user.id).select('age gender medicalHistory');
    const latest = analyses[analyses.length - 1];
    const summary = computePeriodSummary(analyses);

    aiService.generateReport({
      analysisId:           latest._id,
      userId:               req.user.id,
      age:                  user?.age,
      gender:               user?.gender,
      medicalHistory:       user?.medicalHistory,
      reportPeriod:         type === 'weekly' ? 'weekly' : 'daily',
      measurementCount:     analyses.length,
      // 최신 측정값 (가장 최근 상태)
      arrhythmiaClass:      latest.arrhythmiaClass,
      arrhythmiaProb:       latest.arrhythmiaProb,
      afDetected:           latest.afDetected,
      afProb:               latest.afProb,
      hrvRmssd:             latest.hrvRmssd,
      hrvSdnn:              latest.hrvSdnn,
      hrvLfhf:              latest.hrvLfhf,
      anomalyDetected:      latest.anomalyDetected,
      riskScore:            latest.riskScore,
      riskLevel:            latest.riskLevel,
      heartRate:            latest.heartRate,
      // 기간 종합 요약값
      avgHeartRate:         summary.avgHeartRate,
      maxRiskLevel:         summary.maxRiskLevel,
      afDetectedDays:       summary.afDetectedDays,
      totalArrhythmiaCount: summary.totalArrhythmiaCount,
      riskDistribution:     summary.riskDistribution,
      target:               'both',
    }).then(async ({ data: reportData }) => {
      await Report.findByIdAndUpdate(report._id, {
        reportText:         reportData.report_text_user,
        reportTextGuardian: reportData.report_text_guardian,
        recommendedAction:  reportData.recommended_action,
        status:             'completed',
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
      _id:         report._id,
      analysisIds: report.analysisIds,
      userId:      report.userId,
      reportText:  report.reportTextGuardian ?? report.reportText,
      createdAt:   report.createdAt,
    });
  } catch (err) {
    next(err);
  }
};

// 보호자: 환자 최신 상태 조회 (type=daily|weekly 쿼리 지원, 집계 차트 데이터 포함)
export const getGuardianReport = async (req, res, next) => {
  try {
    const hasAccess = await verifyGuardianAccess(req.user.id, req.params.userId);
    if (!hasAccess) return res.status(403).json({ message: '해당 환자의 데이터에 접근 권한이 없습니다.' });

    const type = req.query.type ?? 'daily';

    // 날짜 범위: 오늘 기준 일간/주간
    const now = new Date();
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    let periodStart;
    if (type === 'weekly') {
      periodStart = new Date(endOfDay);
      periodStart.setDate(periodStart.getDate() - 6);
      periodStart.setHours(0, 0, 0, 0);
    } else {
      periodStart = startOfDay;
    }

    const [analyses, user, latestReport] = await Promise.all([
      AnalysisResult.find({
        userId:     req.params.userId,
        analyzedAt: { $gte: periodStart, $lte: endOfDay },
      }).sort({ analyzedAt: 1 }),
      User.findById(req.params.userId).select('nickname'),
      Report.findOne({ userId: req.params.userId }).sort({ createdAt: -1 }),
    ]);

    const latestAnalysis = analyses[analyses.length - 1] ?? null;
    const memberName = user?.nickname ?? '';

    // 기간 내 분석이 없으면 빈 응답
    if (analyses.length === 0) {
      const empty = {
        memberName,
        type,
        riskScore:   0,
        riskLevel:   'low',
        reportText:  latestReport?.reportTextGuardian ?? latestReport?.reportText ?? '',
        reportStatus: 'completed',
      };
      if (type === 'weekly') {
        return res.json({ ...empty, startDate: periodStart.toISOString().slice(0, 10), endDate: endOfDay.toISOString().slice(0, 10), afDays: 0, totalArrhythmiaCount: 0, measurementDays: 0, dailyStats: [], hrvTrend: [] });
      }
      return res.json({ ...empty, date: startOfDay.toISOString().slice(0, 10), measurementCount: 0, maxHeartRate: 0, avgHeartRate: 0, minHeartRate: 0, afDetected: false, hourlyHeartRate: [], arrhythmiaByType: [] });
    }

    // latestReport는 TTS용으로만 활용, 차트 데이터는 직접 집계
    const pseudoReport = {
      periodStart,
      periodEnd:    endOfDay,
      maxRiskLevel: computeMaxRiskLevel(analyses),
      reportText:   latestReport?.reportTextGuardian ?? latestReport?.reportText ?? '',
      status:       latestReport?.status ?? 'completed',
    };

    if (type === 'weekly') {
      return res.json(buildWeeklyPayload(analyses, pseudoReport, latestAnalysis, memberName));
    }
    return res.json(buildDailyPayload(analyses, pseudoReport, latestAnalysis, memberName));
  } catch (err) {
    next(err);
  }
};
