// scripts/initDB.js
// 실행: node scripts/initDB.js
// 기능: 기존 8개 컬렉션을 모두 초기화(drop)하고, models 기준으로 다시 생성한 뒤,
//       인덱스를 재생성하고 데모 관계 + 한 달치 테스트 데이터를 재설정한다.
//       - 시니어 2명, 보호자 5명(시니어별 2명·3명), 총 7명
//       - 시니어별 30일치 측정/분석(하루 0~3회 랜덤), 일/주/월 리포트, 알림 생성
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// ───────── 8개 모델 불러오기 ─────────
import User from '../src/models/User.js';
import GuardianRelation from '../src/models/GuardianRelation.js';
import Measurement from '../src/models/Measurement.js';
import AnalysisResult from '../src/models/AnalysisResult.js';
import Report from '../src/models/Report.js';
import Notification from '../src/models/Notification.js';
import PhoneVerification from '../src/models/PhoneVerification.js';
import PasswordResetCode from '../src/models/PasswordResetCode.js';

const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/heartlink';

// ───────── 데모 데이터용 환경변수 ─────────
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'test1234';

const SENIOR_PHONES = [
  process.env.DEMO_SENIOR1_PN,
  process.env.DEMO_SENIOR2_PN,
];

const GUARDIAN_PHONES = [
  process.env.DEMO_GUARDIAN1_PN,
  process.env.DEMO_GUARDIAN2_PN,
  process.env.DEMO_GUARDIAN3_PN,
  process.env.DEMO_GUARDIAN4_PN,
  process.env.DEMO_GUARDIAN5_PN,
];

// 값 누락 시 조기 경고 (오타/미설정 방지)
if (SENIOR_PHONES.some((p) => !p) || GUARDIAN_PHONES.some((p) => !p)) {
  throw new Error('데모 전화번호 환경변수(.env)가 누락되었습니다. DEMO_*_PN 값을 확인하세요.');
}

// drop 및 인덱스 동기화 대상(생성 순서 = 의존 관계 순서)
const MODELS = [
  User,
  GuardianRelation,
  Measurement,
  AnalysisResult,
  Report,
  Notification,
  PhoneVerification,
  PasswordResetCode,
];

// ───────── 유틸 ─────────
function levelFromScore(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'mid';
  return 'low';
}

function jitter(base, range) {
  return Math.max(0, Math.min(100, Math.round(base + (Math.random() - 0.5) * range)));
}

// 위험도 우선순위(최악값 비교용): high > mid > low
const RISK_RANK = { low: 0, mid: 1, high: 2 };
function maxRisk(a, b) {
  return RISK_RANK[a] >= RISK_RANK[b] ? a : b;
}

// 주(week) 시작(월요일 00:00) 계산
function startOfWeek(date) {
  const d = new Date(date);
  const day = (d.getDay() + 6) % 7; // 월=0 ... 일=6
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}
// 달(month) 시작(1일 00:00) 계산
function startOfMonth(date) {
  const d = new Date(date);
  d.setDate(1);
  d.setHours(0, 0, 0, 0);
  return d;
}
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// 1) 기존 컬렉션 전부 삭제 (데이터 + 인덱스 + Atlas validator 동시 제거)
async function dropAllCollections() {
  const existing = await mongoose.connection.db
    .listCollections()
    .toArray()
    .then((arr) => arr.map((c) => c.name));

  for (const model of MODELS) {
    const name = model.collection.collectionName;
    if (existing.includes(name)) {
      await mongoose.connection.db.dropCollection(name);
      console.log(`🗑️  ${name} 컬렉션 삭제`);
    }
  }
  console.log('✅ 기존 컬렉션 초기화 완료');
}

// 2) 빈 컬렉션 생성 + 모델에 정의된 인덱스 재생성
async function createCollectionsAndIndexes() {
  for (const model of MODELS) {
    const name = model.collection.collectionName;
    await model.createCollection().catch(() => { });
    await model.syncIndexes();
    console.log(`📁 ${name} 생성 및 인덱스 동기화`);
  }
  console.log('✅ 컬렉션/인덱스 재생성 완료');
}

// ───────── 한 명의 시니어에 대한 30일치 측정/분석 생성 ─────────
// 하루 측정 횟수를 0~3회로 랜덤 → "여러 번 잰 날 / 안 잰 날"이 섞이도록
async function seedMeasurementsForSenior(senior, dayOffsetBase = 0) {
  const DAYS = 30;
  const analysisDocs = [];
  const measurementMap = []; // { measuredAt, analysisDraft } 임시 보관

  for (let i = DAYS - 1; i >= 0; i--) {
    // 하루 측정 횟수: 0,1,1,2,3 중 랜덤 (가끔 미측정일 포함)
    const timesToday = [0, 1, 1, 2, 3][Math.floor(Math.random() * 5)];

    for (let t = 0; t < timesToday; t++) {
      const measuredAt = new Date();
      measuredAt.setDate(measuredAt.getDate() - i);
      // 측정 시간대 분산(아침/점심/저녁/야간)
      const hour = [8, 13, 19, 22][t % 4] + Math.floor(Math.random() * 2);
      measuredAt.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

      // 시니어별 추세 차이를 위해 base에 offset 적용
      const trend = 25 + (DAYS - 1 - i) * 1.5 + dayOffsetBase;
      const riskScore = jitter(trend, 18);
      const riskLevel = levelFromScore(riskScore);

      const afDetected = Math.random() < riskScore / 150;
      const anomalyDetected = Math.random() < riskScore / 120;
      const arrhythmiaClass = afDetected
        ? 'SVEB'
        : ['N', 'N', 'N', 'VEB'][Math.floor(Math.random() * 4)];

      const heartRate = jitter(70 + riskScore * 0.2, 12);
      const arrhythmiaCount = arrhythmiaClass === 'N' ? 0 : 1 + Math.floor(Math.random() * 5);

      const measurement = await Measurement.create({
        userId: senior._id,
        fileName: `ecg_${measuredAt.toISOString().slice(0, 19).replace(/[:T]/g, '')}.csv`,
        fileExt: 'CSV',
        fileSize: 50000 + Math.floor(Math.random() * 10000),
        leadType: 'Lead I',
        samplingRate: 250,
        ecgWaveformLite: [],
        status: 'completed',
        rPeaks: [],
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
  console.log(`   📊 ${senior.nickname}: 측정/분석 ${inserted.length}건 생성 (하루 0~3회)`);
  return inserted; // AnalysisResult 문서 배열 반환
}

// ───────── 시니어의 분석 결과로 일/주/월 리포트 + 알림 생성 ─────────
async function seedReportsAndNotifications(senior, guardianIds, analyses) {
  if (!analyses.length) return;

  // analyzedAt 오름차순 정렬
  const sorted = [...analyses].sort((a, b) => a.analyzedAt - b.analyzedAt);
  const now = new Date();

  // 기간별 집계 헬퍼: 주어진 기간에 속한 분석을 모아 리포트 1건 생성
  async function buildReport(period, periodStart, periodEnd, reportType) {
    const inRange = sorted.filter(
      (a) => a.analyzedAt >= periodStart && a.analyzedAt <= periodEnd
    );
    if (!inRange.length) return null;

    const maxLevel = inRange.reduce((acc, a) => maxRisk(acc, a.riskLevel), 'low');
    const lastAnalysisAt = inRange[inRange.length - 1].analyzedAt;
    const avgHr = Math.round(
      inRange.reduce((s, a) => s + a.heartRate, 0) / inRange.length
    );

    // 차트용 간단 집계(예시): 위험도 카운트
    const riskCount = inRange.reduce(
      (acc, a) => ((acc[a.riskLevel] = (acc[a.riskLevel] || 0) + 1), acc),
      {}
    );

    const report = await Report.create({
      userId: senior._id,
      reportType,
      reportCategory: maxLevel === 'high' ? 'emergency_alert' : 'full_report',
      reportPeriod: period,
      periodStart,
      periodEnd,
      lastAnalysisAt,
      analysisIds: inRange.map((a) => a._id),
      analysisCount: inRange.length,
      reportText:
        `[${period}] ${senior.nickname}님의 ${reportType === 'self' ? '본인용' : '보호자용'} 리포트입니다. ` +
        `해당 기간 측정 ${inRange.length}회, 평균 심박수 ${avgHr}bpm, 최고 위험도 ${maxLevel}.`,
      recommendedAction:
        maxLevel === 'high'
          ? '위험도가 높습니다. 가까운 병원 방문을 권장합니다.'
          : '현재 상태는 안정적입니다. 규칙적인 측정을 유지하세요.',
      ttsAudioUrl: `https://demo.heartlink/tts/${senior._id}_${period}_${reportType}.mp3`,
      chartData: { riskCount, avgHeartRate: avgHr, count: inRange.length },
      maxRiskLevel: maxLevel,
      status: 'completed',
    });
    return report;
  }

  // self + guardian 두 타입, 일/주/월 각각 생성
  const periods = [
    ['daily', startOfDay(now), now],
    ['weekly', startOfWeek(now), now],
    ['monthly', startOfMonth(now), now],
  ];

  let reportCount = 0;
  for (const [period, pStart, pEnd] of periods) {
    for (const reportType of ['self', 'guardian']) {
      const r = await buildReport(period, pStart, pEnd, reportType);
      if (r) reportCount++;

      // 보호자용 + 고위험이면 알림 생성
      if (r && reportType === 'guardian' && r.maxRiskLevel === 'high') {
        for (const gId of guardianIds) {
          await Notification.create({
            analysisId: r.analysisIds[r.analysisIds.length - 1],
            userId: senior._id,
            guardianId: gId,
            riskLevel: r.maxRiskLevel,
            channel: 'push',
            message: `${senior.nickname}님의 ${period} 위험도가 높습니다. 확인이 필요합니다.`,
            sendStatus: 'success',
            isRead: false,
            sentAt: new Date(),
          });
        }
      }
    }
  }
  console.log(`   📝 ${senior.nickname}: 리포트 ${reportCount}건 + 알림 생성`);
}

// 3) 데모 관계 데이터 재설정 (시니어 2명, 보호자 5명, 총 7명)
async function seedRelations() {
  const hashedPw = await bcrypt.hash(DEMO_PASSWORD, 10);

  const senior1 = await User.create({
    email: 'senior1@demo.com',
    password: hashedPw,
    provider: 'local',
    nickname: '데모 어르신1',
    role: 'user',
    phone: SENIOR_PHONES[0],   // ← .env에서
    phoneVerified: true,
    age: 72,
    gender: 'M',
    medicalHistory: ['고혈압'],
  });

  const senior2 = await User.create({
    email: 'senior2@demo.com',
    password: hashedPw,
    provider: 'local',
    nickname: '데모 어르신2',
    role: 'user',
    phone: SENIOR_PHONES[1],   // ← .env에서
    phoneVerified: true,
    age: 68,
    gender: 'F',
    medicalHistory: ['당뇨', '부정맥'],
  });


  // ── 보호자 5명 (시니어1 → 2명, 시니어2 → 3명) ──
  const guardianPlan = [
    { senior: senior1, count: 2, baseIdx: 1 },
    { senior: senior2, count: 3, baseIdx: 3 },
  ];

  const seniorGuardianMap = new Map(); // senior._id → [guardianId...]

  for (const plan of guardianPlan) {
    const gIds = [];
    for (let k = 0; k < plan.count; k++) {
      const idx = plan.baseIdx + k;
      const guardian = await User.create({
        email: `guardian${idx}@demo.com`,
        password: hashedPw,
        provider: 'local',
        nickname: `데모 보호자${idx}`,
        role: 'guardian',
        phone: GUARDIAN_PHONES[idx - 1],   // ← idx는 1부터 시작하므로 -1
        phoneVerified: true,
      });


      await GuardianRelation.create({
        userId: plan.senior._id,
        guardianId: guardian._id,
        guardianName: guardian.nickname,
        guardianContact: guardian.phone,
        guardianEmail: guardian.email,
        notifyPermission: true,
        relationStatus: 'accepted',
      });

      gIds.push(guardian._id);
      console.log(`🧑‍🦰 보호자${idx} _id: ${guardian._id} (→ ${plan.senior.nickname})`);
    }
    seniorGuardianMap.set(plan.senior._id.toString(), gIds);
  }

  console.log(`👤 시니어1 _id: ${senior1._id}`);
  console.log(`👤 시니어2 _id: ${senior2._id}`);

  // ── 시니어별 측정/분석 + 리포트/알림 생성 ──
  const seniors = [
    { user: senior1, offset: 0 },
    { user: senior2, offset: 10 }, // 시니어2는 위험도 추세를 조금 더 높게
  ];

  for (const { user, offset } of seniors) {
    const analyses = await seedMeasurementsForSenior(user, offset);
    const gIds = seniorGuardianMap.get(user._id.toString());
    await seedReportsAndNotifications(user, gIds, analyses);
  }

  console.log('✅ 관계/측정/분석/리포트/알림 데이터 생성 완료');
}

// ───────── 메인 실행 ─────────
async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ MongoDB 연결됨:', MONGO_URI);

  await dropAllCollections();
  await createCollectionsAndIndexes();
  await seedRelations();

  await mongoose.disconnect();
  console.log('🎉 initDB 완료. 위 시니어 _id로 보호자 차트를 확인하세요.');
}

run().catch((e) => {
  console.error('❌ initDB 실패');
  console.error('message:', e?.message);
  console.error('name:', e?.name);
  if (e?.errors) {
    // Mongoose ValidationError: 필드별 상세
    for (const [field, err] of Object.entries(e.errors)) {
      console.error(`  - ${field}: ${err.message}`);
    }
  }
  console.error(e?.stack);
  process.exit(1);
});

