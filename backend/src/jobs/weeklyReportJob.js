import cron from 'node-cron';
import User from '../models/User.js';
import AnalysisResult from '../models/AnalysisResult.js';
import Report from '../models/Report.js';
import GuardianRelation from '../models/GuardianRelation.js';
import * as aiService from '../services/aiService.js';
import { sendPushNotification } from '../utils/notification.js';

function computeMaxRiskLevel(analyses) {
  if (analyses.some(a => a.riskLevel === 'high')) return 'high';
  if (analyses.some(a => a.riskLevel === 'mid')) return 'mid';
  return 'low';
}

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

  return { avgHeartRate, maxRiskLevel: computeMaxRiskLevel(analyses), afDetectedDays: afDates.size, totalArrhythmiaCount, riskDistribution };
}

async function generateWeeklyForUser(user, periodStart, periodEnd) {
  try {
    const analyses = await AnalysisResult.find({
      userId:     user._id,
      analyzedAt: { $gte: periodStart, $lte: periodEnd },
    }).sort({ analyzedAt: 1 });

    if (analyses.length === 0) return; // 이번 주 측정 없으면 스킵

    const lastAnalysisAt = analyses[analyses.length - 1].analyzedAt;

    // 동일 주 리포트가 이미 있으면 스킵
    const existing = await Report.findOne({
      userId:        user._id,
      reportType:    'self',
      reportPeriod:  'weekly',
      lastAnalysisAt,
    });
    if (existing) return;

    const report = await Report.create({
      userId:         user._id,
      reportType:     'self',
      reportCategory: 'fullReport',
      reportPeriod:   'weekly',
      periodStart,
      periodEnd,
      lastAnalysisAt,
      analysisIds:    analyses.map(a => a._id),
      analysisCount:  analyses.length,
      maxRiskLevel:   computeMaxRiskLevel(analyses),
      status:         'generating',
    });

    const latest  = analyses[analyses.length - 1];
    const summary = computePeriodSummary(analyses);

    aiService.generateReport({
      analysisId:           latest._id,
      userId:               user._id,
      age:                  user.age,
      gender:               user.gender,
      medicalHistory:       user.medicalHistory,
      reportPeriod:         'weekly',
      measurementCount:     analyses.length,
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

      // 사용자 FCM 알림
      if (user.deviceToken) {
        sendPushNotification(
          user.deviceToken,
          '주간 건강 리포트가 준비됐어요 📋',
          '이번 주 심장 건강 리포트를 확인해 보세요!',
          { type: 'report', reportType: 'weekly', reportId: report._id.toString() }
        ).catch(() => {});
      }

      // 수락된 보호자 FCM 알림
      const guardianRelations = await GuardianRelation.find({
        userId:         user._id,
        relationStatus: 'accepted',
      }).populate('guardianId', 'deviceToken');

      for (const rel of guardianRelations) {
        const token = rel.guardianId?.deviceToken;
        if (token) {
          sendPushNotification(
            token,
            '보호 중인 분의 주간 리포트가 준비됐어요 📋',
            `${user.nickname ?? '어르신'}의 이번 주 건강 리포트를 확인해 보세요!`,
            { type: 'report', userId: user._id.toString(), reportType: 'weekly', reportId: report._id.toString() }
          ).catch(() => {});
        }
      }
    }).catch(async (err) => {
      console.error(`[주간 리포트] AI 생성 실패 (userId: ${user._id}):`, err.message);
      await Report.findByIdAndUpdate(report._id, { status: 'failed' });
    });

  } catch (err) {
    console.error(`[주간 리포트] 처리 오류 (userId: ${user._id}):`, err.message);
  }
}

export function startWeeklyReportJob() {
  // 매주 일요일 오전 6시 KST
  cron.schedule('0 6 * * 0', async () => {
    console.log('[주간 리포트] 자동 생성 시작...');

    const now        = new Date();
    const periodEnd  = new Date(now);
    periodEnd.setHours(23, 59, 59, 999);

    const periodStart = new Date(periodEnd);
    periodStart.setDate(periodStart.getDate() - 6); // 월요일 00:00
    periodStart.setHours(0, 0, 0, 0);

    const users = await User.find({ role: 'user' })
      .select('_id age gender medicalHistory deviceToken nickname');

    console.log(`[주간 리포트] 대상 사용자 ${users.length}명`);

    await Promise.allSettled(users.map(user => generateWeeklyForUser(user, periodStart, periodEnd)));

    console.log('[주간 리포트] 자동 생성 완료');
  }, {
    timezone: 'Asia/Seoul',
  });

  console.log('[주간 리포트] 스케줄러 등록 완료 (매주 일요일 오전 6시 KST)');
}
