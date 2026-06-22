// scripts/seedGuardianChart.js
// 실행: node scripts/seedGuardianChart.js
import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

import User from '../src/models/User.js';
import Measurement from '../src/models/Measurement.js';
import AnalysisResult from '../src/models/AnalysisResult.js';
import GuardianRelation from '../src/models/GuardianRelation.js';

const DAYS = 30;
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/heartlink';

const SENIOR_EMAIL = 'senior@demo.com';
const GUARDIAN_EMAIL = 'guardian@demo.com';

function levelFromScore(score) {
    if (score >= 70) return 'high';
    if (score >= 40) return 'mid';
    return 'low';
}

function jitter(base, range) {
    return Math.max(0, Math.min(100, Math.round(base + (Math.random() - 0.5) * range)));
}

// 재실행 대비: 기존 데모 계정과 관련 데이터를 먼저 정리
async function cleanupExisting() {
    const oldUsers = await User.find({ email: { $in: [SENIOR_EMAIL, GUARDIAN_EMAIL] } }).select('_id');
    const oldUserIds = oldUsers.map((u) => u._id);
    if (oldUserIds.length === 0) return;

    const oldMeasurements = await Measurement.find({ userId: { $in: oldUserIds } }).select('_id');
    const oldMeasurementIds = oldMeasurements.map((m) => m._id);

    await AnalysisResult.deleteMany({ measurementId: { $in: oldMeasurementIds } });
    await Measurement.deleteMany({ userId: { $in: oldUserIds } });
    await GuardianRelation.deleteMany({
        $or: [{ userId: { $in: oldUserIds } }, { guardianId: { $in: oldUserIds } }],
    });
    await User.deleteMany({ _id: { $in: oldUserIds } });

    console.log('🧹 기존 데모 데이터 정리 완료');
}

async function run() {
    await mongoose.connect(MONGO_URI);
    console.log('✅ MongoDB 연결됨');

    await cleanupExisting();

    const hashedPw = await bcrypt.hash('test1234', 10); // 공통 데모 비밀번호

    const senior = await User.create({
        email: SENIOR_EMAIL,
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

    const guardian = await User.create({
        email: GUARDIAN_EMAIL,
        password: hashedPw,
        provider: 'local',
        nickname: '데모 보호자',
        role: 'guardian',
        phone: '01056342685',
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

        // 심박수: 위험도가 높을수록 약간 높게 분포
        const heartRate = jitter(70 + riskScore * 0.2, 12);
        // 부정맥 발생 횟수: 정상(N)이 아니면 1회 이상 발생하도록
        const arrhythmiaCount = arrhythmiaClass === 'N'
            ? 0
            : 1 + Math.floor(Math.random() * 5);

        const measurement = await Measurement.create({
            userId: senior._id,
            fileName: `ecg_${measuredAt.toISOString().slice(0, 10)}.csv`,
            fileExt: 'CSV',
            fileSize: 50000 + Math.floor(Math.random() * 10000),
            leadType: 'Lead I',
            samplingRate: 250,
            ecgWaveformLite: [],
            status: 'completed', // 분석 완료 상태
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
            heartRate,
            arrhythmiaCount,
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
