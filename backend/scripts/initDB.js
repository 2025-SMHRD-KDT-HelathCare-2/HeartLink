// scripts/initDB.js
// 실행: node scripts/initDB.js
// 기능: 기존 8개 컬렉션을 모두 초기화(drop)하고, models 기준으로 다시 생성한 뒤,
//       인덱스를 재생성하고 데모 관계 데이터를 재설정한다.
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
    // 컬렉션이 없으면 명시적으로 생성
    await model.createCollection().catch(() => {});
    // 모델 스키마에 정의된 인덱스로 동기화(불필요 인덱스 제거 + 누락 인덱스 생성)
    await model.syncIndexes();
    console.log(`📁 ${name} 생성 및 인덱스 동기화`);
  }
  console.log('✅ 컬렉션/인덱스 재생성 완료');
}

// 3) 데모 관계 데이터 재설정
async function seedRelations() {
  const hashedPw = await bcrypt.hash('test1234', 10); // 공통 데모 비밀번호

  // 시니어(본인)
  const senior = await User.create({
    email: 'senior@demo.com',
    password: hashedPw,
    provider: 'local',
    nickname: '데모 어르신',
    role: 'user',
    phone: '01095118147',
    phoneVerified: true,
    age: 72,
    gender: 'M',
    medicalHistory: ['고혈압'],
  });

  // 보호자
  const guardian = await User.create({
    email: 'guardian@demo.com',
    password: hashedPw,
    provider: 'local',
    nickname: '데모 보호자',
    role: 'guardian',
    phone: '01056342685',
    phoneVerified: true,
  });

  // 본인 ↔ 보호자 관계
  await GuardianRelation.create({
    userId: senior._id,
    guardianId: guardian._id,
    guardianName: guardian.nickname,
    guardianContact: guardian.phone,
    guardianEmail: guardian.email,
    notifyPermission: true,
    relationStatus: 'accepted',
  });

  console.log(`👤 시니어 _id: ${senior._id}`);
  console.log(`🧑‍🦰 보호자 _id: ${guardian._id}`);

  // 30일치 측정 + 분석 데이터 생성 (Measurement 1:1 AnalysisResult)
  const DAYS = 30;
  const analysisDocs = [];

  for (let i = DAYS - 1; i >= 0; i--) {
    const measuredAt = new Date();
    measuredAt.setDate(measuredAt.getDate() - i);
    measuredAt.setHours(9, 0, 0, 0);

    const trend = 25 + (DAYS - 1 - i) * 1.5;
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
      fileName: `ecg_${measuredAt.toISOString().slice(0, 10)}.csv`,
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
      afProb: afDetected ? +(0.6 + Math.random() * 0.4).toFixed(2) : +(Math.random() * 0.3).toFixed(2),
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

  await AnalysisResult.insertMany(analysisDocs);
  console.log(`📊 측정/분석 ${analysisDocs.length}일치 데이터 생성 완료`);
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
  console.error('❌ initDB 실패:', JSON.stringify(e.writeErrors?.[0]?.err ?? e, null, 2));
  process.exit(1);
});
