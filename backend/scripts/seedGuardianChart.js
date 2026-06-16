// scripts/seedGuardianChart.js
// 실행: node scripts/seedGuardianChart.js
import 'dotenv/config';
import mongoose from 'mongoose';

import User from '../src/models/User.js';
import Measurement from '../src/models/Measurement.js';
import AnalysisResult from '../src/models/AnalysisResult.js';
import GuardianRelation from '../src/models/GuardianRelation.js';

const DAYS = 30;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/heartlink';

function levelFromScore(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'mid';
  return 'low';
}

function jitter(base, range) {
  return Math.max(0, Math.min(100, Math.round(base + (Math.random() - 0.5) * range)));
}

async function run() {
  await mongoose.connect(MONGO_URI);
  console.log('✅ MongoDB 연결됨');

  const senior = await User.create({
    email: `senior_${Date.now()}@demo.com`,
    provider: 'local',
    nickname: '데모 어르신',
    role: 'user',
    phone: `0109${Math.floor(1000000 + Math.random() * 8999999)}`,
    phoneVerified: true,
    age: 72,
    gender: 'M',
    medicalHistory: ['고혈압'],
  });

  const guardian = await User.create({
    email: `guardian_${Date.now()}@demo.com`,
    provider: 'local',
    nickname: '데모 보호자',
    role: 'guardian',
    phone: `0108${Math.floor(1000000 + Math.random() * 8999999)}`,
    phoneVerified: true,
  });

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

  const docs = [];
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

    const measurement = await Measurement.create({
      userId: senior._id,
      fileName: `ecg_${measuredAt.toISOString().slice(0, 10)}.csv`,
      fileExt: 'CSV',
      fileSize: 50000 + Math.floor(Math.random() * 10000),
      leadType: 'Lead I',
      samplingRate: 250,
      ecgWaveformLite: [],
      rPeaks: [],
      measuredAt,
    });

    docs.push({
      measurementId: measurement._id,
      userId: senior._id,
      arrhythmiaClass,
      arrhythmiaProb: +Math.random().toFixed(2),
      afDetected,
      afProb: afDetected ? +(0.6 + Math.random() * 0.4).toFixed(2) : +(Math.random() * 0.3).toFixed(2),
      hrvRmssd: jitter(40 - (DAYS - 1 - i) * 0.5, 10),
      hrvSdnn: jitter(50 - (DAYS - 1 - i) * 0.5, 12),
      hrvLfhf: +(1 + Math.random()).toFixed(2),
      anomalyDetected,
      riskScore,
      riskLevel,
      analyzedAt: measuredAt,
    });
  }

  await AnalysisResult.insertMany(docs);
  console.log(`📊 ${docs.length}일치 분석 데이터 생성 완료`);

  await mongoose.disconnect();
  console.log('✅ 완료. 위 시니어 _id로 보호자 차트를 확인하세요.');
}

run().catch((e) => {
  console.error(JSON.stringify(e.writeErrors?.[0]?.err ?? e, null, 2));
  process.exit(1);
});

