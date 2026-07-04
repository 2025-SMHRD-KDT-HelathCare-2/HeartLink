// scripts/seedDemoData.js
// 실행 방법: backend 폴더에서  ->  node scripts/seedDemoData.js
//
// [이 스크립트가 하는 일]
//   - initDB.js 로 이미 만들어진 데모 계정(senior1~4@demo.com, guardian1~10@demo.com)을
//     "이메일로 찾아서" 재사용합니다. (계정은 새로 만들지 않습니다)
//   - 시연에 필요한 아래 데이터를 채워 넣습니다.
//       1) 보호자 연계(N:M)  ※ 아래 요구사항대로 재설정
//            · 시니어1 ↔ 보호자1,2,3
//            · 시니어2 ↔ 보호자3,4
//            · 시니어3 ↔ 보호자1,2
//            · 시니어4 ↔ 보호자1
//          (그 결과: 보호자1의 시니어 = 시니어1,3,4 / 보호자2의 시니어 = 시니어1,3)
//       2) 시니어1~4 각각 30일치 측정 + 분석 데이터
//       3) 시니어1~4 각각 일일 리포트 3개 + 주간 리포트 3개
//          (좋음=low / 중간=mid / 위험=high 가 골고루 섞이도록 강제 분배)
//
//   ※ 재실행 대비: 이 스크립트는 "데모 계정과 관련된" 기존 관계/측정/분석/리포트/알림만
//      정리한 뒤 다시 생성합니다. (다른 실제 사용자 데이터는 건드리지 않습니다)

import 'dotenv/config';
import mongoose from 'mongoose';

import User from '../src/models/User.js';
import GuardianRelation from '../src/models/GuardianRelation.js';
import Measurement from '../src/models/Measurement.js';
import AnalysisResult from '../src/models/AnalysisResult.js';
import Report from '../src/models/Report.js';
import Notification from '../src/models/Notification.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/heartlink';

// ════════════════════════════════════════════════════════════════════
//  공통 설정
// ════════════════════════════════════════════════════════════════════

const DAYS = 30; // 측정 데이터 기간(일)

// 더미 심전도 사양 (initDB.js 와 동일하게 80Hz × 10초 = 800샘플)
const DUMMY_FS = 80;
const DUMMY_DURATION_SEC = 10;
const DUMMY_SAMPLE_COUNT = DUMMY_FS * DUMMY_DURATION_SEC;

// 리포트에서 사용할 위험 등급 3종 (좋음/중간/위험)
const LEVELS = ['low', 'mid', 'high'];
// 등급 한글 라벨 (리포트 본문용)
const LEVEL_LABEL = { low: '좋음', mid: '중간', high: '위험' };
// 위험도 우선순위 (최악값 비교용)
const RISK_RANK = { low: 0, mid: 1, high: 2 };

// ════════════════════════════════════════════════════════════════════
//  유틸 함수 (initDB.js 의 방식과 동일 계열)
// ════════════════════════════════════════════════════════════════════

// 0~100 범위로 가두는 랜덤 지터
function jitter(base, range) {
  return Math.max(0, Math.min(100, Math.round(base + (Math.random() - 0.5) * range)));
}

// 점수 → 등급
function levelFromScore(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'mid';
  return 'low';
}

// 등급 → 그 등급 범위 안의 대표 점수 하나 생성
function scoreFromLevel(level) {
  if (level === 'high') return jitter(82, 20); // 70~100 근처
  if (level === 'mid') return jitter(55, 20); // 40~70 근처
  return jitter(25, 20); // 0~40 근처
}

// 하루 시작(00:00)
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
// 하루 끝(23:59:59.999)
function endOfDay(date) {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}
// 그 주 월요일 00:00
function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 월=0 ... 일=6
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 진짜 같은 더미 심전도 파형 + R-peak 생성 (initDB.js 와 동일 로직)
function generateDummyEcg(heartRate = 75) {
  const beatIntervalSec = 60 / heartRate;
  const samplesPerBeat = beatIntervalSec * DUMMY_FS;
  const waveform = [];
  const rPeaks = [];

  const gaussian = (x, center, amp, width) =>
    amp * Math.exp(-((x - center) ** 2) / (2 * width ** 2));

  for (let i = 0; i < DUMMY_SAMPLE_COUNT; i++) {
    const posInBeat = i % samplesPerBeat;
    const pWave = gaussian(posInBeat, samplesPerBeat * 0.2, 0.1, samplesPerBeat * 0.03);
    const qrsWave = gaussian(posInBeat, samplesPerBeat * 0.4, 1.2, samplesPerBeat * 0.012);
    const tWave = gaussian(posInBeat, samplesPerBeat * 0.65, 0.25, samplesPerBeat * 0.05);
    const noise = (Math.random() - 0.5) * 0.03;
    const baseline = 0.05 * Math.sin((2 * Math.PI * i) / DUMMY_SAMPLE_COUNT);
    waveform.push(+(pWave + qrsWave + tWave + noise + baseline).toFixed(4));
  }
  for (let beat = 0; ; beat++) {
    const rIndex = Math.round(beat * samplesPerBeat + samplesPerBeat * 0.4);
    if (rIndex >= DUMMY_SAMPLE_COUNT) break;
    rPeaks.push(rIndex);
  }
  return { waveform, rPeaks };
}

// ════════════════════════════════════════════════════════════════════
//  1) 데모 계정 조회 + 이 데모 계정 관련 기존 데이터 정리
// ════════════════════════════════════════════════════════════════════

async function loadDemoUsers() {
  // initDB.js 가 만든 이메일 규칙 그대로 조회
  const seniors = [];
  for (let i = 1; i <= 4; i++) {
    const u = await User.findOne({ email: `senior${i}@demo.com` });
    if (!u) throw new Error(`계정 없음: senior${i}@demo.com  (먼저 node scripts/initDB.js 실행 필요)`);
    seniors.push(u);
  }
  const guardians = [];
  for (let i = 1; i <= 10; i++) {
    const u = await User.findOne({ email: `guardian${i}@demo.com` });
    if (!u) throw new Error(`계정 없음: guardian${i}@demo.com  (먼저 node scripts/initDB.js 실행 필요)`);
    guardians.push(u);
  }
  console.log('✅ 데모 계정 조회 완료 (시니어 4명 / 보호자 10명)');
  return { seniors, guardians };
}

// 데모 시니어들과 연관된 기존 데이터만 삭제 (실제 사용자 데이터는 건드리지 않음)
async function cleanupDemoData(seniors, guardians) {
  const seniorIds = seniors.map((s) => s._id);
  const guardianIds = guardians.map((g) => g._id);

  const oldMeasurements = await Measurement.find({ userId: { $in: seniorIds } }).select('_id');
  const oldMeasurementIds = oldMeasurements.map((m) => m._id);

  await Notification.deleteMany({ userId: { $in: seniorIds } });
  await Report.deleteMany({ userId: { $in: seniorIds } });
  await AnalysisResult.deleteMany({ measurementId: { $in: oldMeasurementIds } });
  await Measurement.deleteMany({ userId: { $in: seniorIds } });
  await GuardianRelation.deleteMany({
    $or: [{ userId: { $in: seniorIds } }, { guardianId: { $in: guardianIds } }],
  });

  console.log('🧹 기존 데모 데이터(관계/측정/분석/리포트/알림) 정리 완료');
}

// ════════════════════════════════════════════════════════════════════
//  2) 보호자 연계(N:M) 재설정 — 요구사항 매핑
// ════════════════════════════════════════════════════════════════════

async function seedRelations(seniors, guardians) {
  // 인덱스는 0부터이므로 시니어1 = seniors[0], 보호자1 = guardians[0]
  //   · 시니어1 ↔ 보호자1,2,3
  //   · 시니어2 ↔ 보호자3,4
  //   · 시니어3 ↔ 보호자1,2
  //   · 시니어4 ↔ 보호자1
  const relationMap = [
    { senior: seniors[0], guardians: [guardians[0], guardians[1], guardians[2]] },
    { senior: seniors[1], guardians: [guardians[2], guardians[3]] },
    { senior: seniors[2], guardians: [guardians[0], guardians[1]] },
    { senior: seniors[3], guardians: [guardians[0]] },
  ];

  for (const { senior, guardians: gs } of relationMap) {
    for (const g of gs) {
      await GuardianRelation.create({
        userId: senior._id,
        guardianId: g._id,
        guardianName: g.nickname,
        guardianContact: g.phone,
        guardianEmail: g.email,
        notifyPermission: true,
        relationStatus: 'accepted',
      });
    }
  }

  console.log('🔗 보호자 연계(N:M) 재설정 완료');
  // 이후 알림 생성을 위해 시니어별 보호자 id 목록 반환
  return relationMap.map(({ senior, guardians: gs }) => ({
    senior,
    guardianIds: gs.map((g) => g._id),
  }));
}

// ════════════════════════════════════════════════════════════════════
//  3) 시니어 1명의 30일치 측정 + 분석 생성
// ════════════════════════════════════════════════════════════════════

async function seedMeasurements(senior, dayOffsetBase = 0) {
  const analysisDocs = [];

  for (let i = DAYS - 1; i >= 0; i--) {
    // 하루 0~3회 측정 (미측정일도 섞이도록)
    const timesToday = [0, 1, 1, 2, 3][Math.floor(Math.random() * 5)];

    for (let t = 0; t < timesToday; t++) {
      const measuredAt = new Date();
      measuredAt.setDate(measuredAt.getDate() - i);
      const hour = [8, 13, 19, 22][t % 4] + Math.floor(Math.random() * 2);
      measuredAt.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

      const trend = 25 + (DAYS - 1 - i) * 1.2 + dayOffsetBase;
      const riskScore = jitter(trend, 20);
      const riskLevel = levelFromScore(riskScore);

      const afDetected = Math.random() < riskScore / 150;
      const anomalyDetected = Math.random() < riskScore / 120;
      const arrhythmiaClass = afDetected
        ? 'SVEB'
        : ['N', 'N', 'N', 'VEB'][Math.floor(Math.random() * 4)];

      const heartRate = jitter(70 + riskScore * 0.2, 12);
      const arrhythmiaCount = arrhythmiaClass === 'N' ? 0 : 1 + Math.floor(Math.random() * 5);
      const { waveform, rPeaks } = generateDummyEcg(heartRate);

      const measurement = await Measurement.create({
        userId: senior._id,
        fileName: `ecg_${measuredAt.toISOString().slice(0, 19).replace(/[:T]/g, '')}.csv`,
        fileExt: 'CSV',
        fileSize: 50000 + Math.floor(Math.random() * 10000),
        leadType: 'Lead I',
        samplingRate: DUMMY_FS,
        ecgWaveformLite: waveform,
        status: 'completed',
        rPeaks,
        measuredAt,
      });

      analysisDocs.push({
        measurementId: measurement._id,
        userId: senior._id,
        arrhythmiaClass,
        arrhythmiaProb: +Math.random().toFixed(2),
        afDetected,
        afProb: afDetected
          ? +(0.6 + Math.random() * 0.4).toFixed(2)
          : +(Math.random() * 0.3).toFixed(2),
        hrvRmssd: jitter(40 - (DAYS - 1 - i) * 0.5, 10),
        hrvSdnn: jitter(50 - (DAYS - 1 - i) * 0.5, 12),
        hrvLfhf: +(1 + Math.random()).toFixed(2),
        heartRate,
        arrhythmiaCount,
        anomalyDetected,
        riskScore,
        riskLevel,
        analyzedAt: measuredAt,
      });
    }
  }

  const inserted = await AnalysisResult.insertMany(analysisDocs);
  console.log(`   📊 ${senior.nickname}: 측정/분석 ${inserted.length}건 생성`);
  return inserted;
}

// ════════════════════════════════════════════════════════════════════
//  4) 리포트 생성 — 일일 3개 + 주간 3개 (좋음/중간/위험 골고루)
// ════════════════════════════════════════════════════════════════════
//
//  요구사항: 시니어마다 일일 리포트 3개, 주간 리포트 3개.
//            그리고 3개가 각각 low/mid/high 를 갖도록 골고루 분포.
//  Report 스키마의 유니크 키는 (userId, reportType, reportPeriod, lastAnalysisAt) 이므로
//  같은 기간단위 3개를 만들려면 lastAnalysisAt 을 서로 다르게 주어야 합니다.
//  → 서로 다른 3개의 기간(날짜/주)에 리포트를 만들어 자연스럽게 키가 달라지도록 합니다.

async function seedReports(senior, guardianIds, analyses) {
  const now = new Date();
  let reportCount = 0;

  // 주어진 등급(level)에 맞는 대표 분석 문서 하나를 만들어 리포트에 연결.
  // (해당 기간에 실제 분석이 있으면 그걸 쓰고, 없으면 등급에 맞는 값으로 채운
  //  대표 분석을 새로 하나 생성해 리포트 근거로 사용합니다. analysisIds 는 최소 1개 필수)
  async function ensureAnchorAnalysis(level, periodStart, periodEnd) {
    // 이 기간 + 이 등급에 맞는 기존 분석 찾기
    const inRange = analyses.filter(
      (a) => a.analyzedAt >= periodStart && a.analyzedAt <= periodEnd && a.riskLevel === level
    );
    if (inRange.length) return inRange;

    // 없으면 대표 분석 1건을 새로 생성 (측정도 1건 동반 생성해 참조 무결성 유지)
    const score = scoreFromLevel(level);
    const hr = jitter(70 + score * 0.2, 10);
    const { waveform, rPeaks } = generateDummyEcg(hr);
    const anchorTime = new Date(periodEnd.getTime() - 60 * 60 * 1000); // 기간 끝 1시간 전

    const m = await Measurement.create({
      userId: senior._id,
      fileName: `ecg_anchor_${level}_${anchorTime.getTime()}.csv`,
      fileExt: 'CSV',
      fileSize: 50000,
      leadType: 'Lead I',
      samplingRate: DUMMY_FS,
      ecgWaveformLite: waveform,
      status: 'completed',
      rPeaks,
      measuredAt: anchorTime,
    });
    const a = await AnalysisResult.create({
      measurementId: m._id,
      userId: senior._id,
      arrhythmiaClass: level === 'high' ? 'SVEB' : 'N',
      arrhythmiaProb: +Math.random().toFixed(2),
      afDetected: level === 'high',
      afProb: level === 'high' ? 0.8 : 0.1,
      hrvRmssd: jitter(40, 10),
      hrvSdnn: jitter(50, 12),
      hrvLfhf: +(1 + Math.random()).toFixed(2),
      heartRate: hr,
      arrhythmiaCount: level === 'high' ? 3 : 0,
      anomalyDetected: level !== 'low',
      riskScore: score,
      riskLevel: level,
      analyzedAt: anchorTime,
    });
    return [a];
  }

  // 리포트 1건 생성 (period: 'daily'|'weekly', level: 'low'|'mid'|'high')
  async function buildOne(period, level, periodStart, periodEnd, reportType) {
    const anchors = await ensureAnchorAnalysis(level, periodStart, periodEnd);
    const maxLevel = level; // 이 리포트의 대표 최고 위험도
    const lastAnalysisAt = anchors[anchors.length - 1].analyzedAt;
    const avgHr = Math.round(anchors.reduce((s, a) => s + a.heartRate, 0) / anchors.length);
    const riskCount = anchors.reduce(
      (acc, a) => ((acc[a.riskLevel] = (acc[a.riskLevel] || 0) + 1), acc),
      {}
    );

    const report = await Report.create({
      userId: senior._id,
      reportType,
      reportCategory: maxLevel === 'high' ? 'emergencyAlert' : 'fullReport',
      reportPeriod: period,
      periodStart,
      periodEnd,
      lastAnalysisAt,
      analysisIds: anchors.map((a) => a._id),
      analysisCount: anchors.length,
      reportText:
        `[${period === 'daily' ? '일일' : '주간'}] ${senior.nickname}님의 ` +
        `${reportType === 'self' ? '본인용' : '보호자용'} 리포트입니다. ` +
        `종합 상태: ${LEVEL_LABEL[maxLevel]}, 평균 심박수 ${avgHr}bpm.`,
      recommendedAction:
        maxLevel === 'high'
          ? '위험도가 높습니다. 가까운 병원 방문을 권장합니다.'
          : maxLevel === 'mid'
          ? '경과 관찰이 필요합니다. 규칙적인 측정을 유지하세요.'
          : '현재 상태는 안정적입니다. 지금처럼 유지하세요.',
      ttsAudioUrl: `https://demo.heartlink/tts/${senior._id}_${period}_${level}_${reportType}.mp3`,
      chartData: { riskCount, avgHeartRate: avgHr, count: anchors.length },
      maxRiskLevel: maxLevel,
      status: 'completed',
    });

    // 보호자용 + 고위험이면 연결된 보호자 전원에게 알림 생성
    if (reportType === 'guardian' && maxLevel === 'high') {
      for (const gId of guardianIds) {
        await Notification.create({
          analysisId: report.analysisIds[report.analysisIds.length - 1],
          userId: senior._id,
          guardianId: gId,
          riskLevel: maxLevel,
          channel: 'push',
          message: `${senior.nickname}님의 위험도가 높습니다. 확인이 필요합니다.`,
          sendStatus: 'success',
          sentAt: lastAnalysisAt,
        });
      }
    }

    return report;
  }

  // ── 일일 리포트 3개: 최근 3일(오늘/어제/그제)에 각각 low/mid/high 배정 ──
  for (let d = 0; d < 3; d++) {
    const day = new Date(now);
    day.setDate(day.getDate() - d);
    const pStart = startOfDay(day);
    const pEnd = endOfDay(day);
    const level = LEVELS[d]; // d=0→low, 1→mid, 2→high (골고루)
    // self / guardian 두 타입 모두 생성 (본인용/보호자용 대시보드 모두 시연 가능)
    await buildOne('daily', level, pStart, pEnd, 'self');
    await buildOne('daily', level, pStart, pEnd, 'guardian');
    reportCount += 2;
  }

  // ── 주간 리포트 3개: 최근 3주에 각각 low/mid/high 배정 ──
  for (let w = 0; w < 3; w++) {
    const base = new Date(now);
    base.setDate(base.getDate() - w * 7);
    const pStart = startOfWeek(base);
    const pEnd = new Date(pStart);
    pEnd.setDate(pEnd.getDate() + 6);
    pEnd.setHours(23, 59, 59, 999);
    const level = LEVELS[w]; // 골고루 분포
    await buildOne('weekly', level, pStart, pEnd, 'self');
    await buildOne('weekly', level, pStart, pEnd, 'guardian');
    reportCount += 2;
  }

  console.log(
    `   📑 ${senior.nickname}: 리포트 ${reportCount}건 생성 ` +
      `(일일 3종 × self/guardian, 주간 3종 × self/guardian, 등급 low/mid/high 분포)`
  );
}

// ════════════════════════════════════════════════════════════════════
//  메인 실행부
// ════════════════════════════════════════════════════════════════════

async function main() {
  console.log('🔌 MongoDB 접속 중...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ MongoDB 접속 완료');

  const { seniors, guardians } = await loadDemoUsers();
  await cleanupDemoData(seniors, guardians);
  const seniorInfos = await seedRelations(seniors, guardians);

  for (let idx = 0; idx < seniorInfos.length; idx++) {
    const { senior, guardianIds } = seniorInfos[idx];
    // 시니어마다 추세를 다르게(offset) 부여
    const analyses = await seedMeasurements(senior, idx * 6);
    await seedReports(senior, guardianIds, analyses);
  }

  console.log('🎉 시연용 데모 데이터 생성이 모두 완료되었습니다!');
}

main()
  .catch((err) => {
    console.error('❌ 오류 발생:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log('🔌 MongoDB 연결 종료');
  });
