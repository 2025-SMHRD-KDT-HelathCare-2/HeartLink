// scripts/initDB.js
// 실행: node scripts/initDB.js
import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error('❌ .env에 MONGO_URI가 없습니다.');
  process.exit(1);
}

const collections = [
  /* 1) users */
  {
    name: 'users',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['email', 'provider', 'nickname', 'role', 'phoneVerified', 'createdAt'],
        properties: {
          email: { bsonType: 'string', description: '이메일(로그인 ID)' },
          password: { bsonType: 'string', description: 'bcrypt 비밀번호(소셜 가입자는 없음)' },
          provider: { enum: ['local', 'google', 'naver', 'kakao'], description: '가입 경로' },
          providerId: { bsonType: 'string', description: '소셜 고유 식별자' },
          profileImage: { bsonType: 'string', description: '프로필 이미지 URL' },
          nickname: { bsonType: 'string', description: '닉네임' },
          role: { enum: ['user', 'guardian'], description: '사용자 유형' },
          phone: { bsonType: 'string', description: '인증된 휴대폰 번호' },
          phoneVerified: { bsonType: 'bool', description: '휴대폰 인증 여부' },
          age: { bsonType: 'int', description: '연령' },
          gender: { enum: ['M', 'F'], description: '성별' },
          medicalHistory: { bsonType: 'array', description: '기저질환 목록' },
          medications: { bsonType: 'array', description: '복용약 목록' },
          deviceToken: { bsonType: 'string', description: 'FCM 푸시 토큰' },
          createdAt: { bsonType: 'date', description: '가입 일자' },
          updatedAt: { bsonType: 'date', description: '수정 일자' },
        },
      },
    },
    indexes: [
      { key: { email: 1 }, options: { unique: true, sparse: true } },
      { key: { role: 1 } },
      {
        key: { provider: 1, providerId: 1 },
        options: {
          unique: true,
          partialFilterExpression: { providerId: { $exists: true, $type: 'string' } },
        },
      },
      {
        key: { phone: 1 },
        options: {
          unique: true,
          partialFilterExpression: { phone: { $exists: true, $type: 'string' } },
        },
      },
    ],

  },

  /* 2) phone_verifications */
  {
    name: 'phone_verifications',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['phone', 'code', 'purpose', 'verified', 'attemptCount', 'expiresAt', 'createdAt'],
        properties: {
          phone: { bsonType: 'string', description: '인증 대상 번호' },
          code: { bsonType: 'string', description: '인증번호(해시 저장)' },
          purpose: { enum: ['signup', 'find_pw'], description: '인증 용도' },
          verified: { bsonType: 'bool', description: '인증 성공 여부' },
          attemptCount: { bsonType: 'int', description: '검증 시도 횟수' },
          expiresAt: { bsonType: 'date', description: '만료 시각' },
          createdAt: { bsonType: 'date', description: '발급 일자' },
        },
      },
    },
    indexes: [
      { key: { phone: 1, createdAt: -1 } },
      { key: { expiresAt: 1 }, options: { expireAfterSeconds: 0 } },
    ],
  },

  /* 3) guardian_relations */
  {
    name: 'guardian_relations',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['userId', 'guardianId', 'guardianName', 'guardianContact', 'notifyPermission', 'relationStatus', 'createdAt'],
        properties: {
          userId: { bsonType: 'objectId', description: '본인 참조' },
          guardianId: { bsonType: 'objectId', description: '보호자 참조' },
          guardianName: { bsonType: 'string', description: '보호자 이름' },
          guardianContact: { bsonType: 'string', description: '보호자 연락처' },
          guardianEmail: { bsonType: 'string', description: '보호자 이메일' },
          notifyPermission: { bsonType: 'bool', description: '알림 수신 권한' },
          relationStatus: { enum: ['pending', 'accepted'], description: '관계 상태' },
          createdAt: { bsonType: 'date', description: '등록 일자' },
          updatedAt: { bsonType: 'date', description: '수정 일자' },
        },
      },
    },
    indexes: [
      { key: { userId: 1 } },
      { key: { guardianId: 1 } },
    ],
  },

  /* 4) measurements */
  {
    name: 'measurements',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['userId', 'fileName', 'fileExt', 'fileSize', 'measuredAt', 'createdAt'],
        properties: {
          userId: { bsonType: 'objectId', description: '사용자 참조' },
          fileName: { bsonType: 'string', description: '원본 파일명' },
          fileExt: { enum: ['WFDB', 'EDF', 'CSV'], description: '파일 확장자' },
          fileSize: { bsonType: 'int', description: '파일 크기(byte)' },
          leadType: { bsonType: 'string', description: '리드 종류' },
          samplingRate: { bsonType: 'int', description: '샘플링 레이트(Hz)' },
          ecgWaveformLite: { bsonType: 'array', description: '표시용 다운샘플 파형' },
          rPeaks: { bsonType: 'array', description: 'R-peak 좌표' },
          measuredAt: { bsonType: 'date', description: '측정 시각' },
          createdAt: { bsonType: 'date', description: '저장 일자' },
        },
      },
    },
    indexes: [
      { key: { userId: 1, measuredAt: -1 } },
    ],
  },

  /* 5) analysis_results */
  {
    name: 'analysis_results',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['measurementId', 'userId', 'riskScore', 'riskLevel', 'analyzedAt', 'createdAt'],
        properties: {
          measurementId: { bsonType: 'objectId', description: '측정 참조' },
          userId: { bsonType: 'objectId', description: '사용자 참조' },
          arrhythmiaClass: { enum: ['N', 'SVEB', 'VEB', 'F', 'Q'], description: '부정맥 분류' },
          arrhythmiaProb: { bsonType: 'double', description: '부정맥 확률' },
          afDetected: { bsonType: 'bool', description: '심방세동 의심 여부' },
          afProb: { bsonType: 'double', description: 'AF 확률' },
          hrvRmssd: { bsonType: 'double', description: 'HRV-RMSSD' },
          hrvSdnn: { bsonType: 'double', description: 'HRV-SDNN' },
          hrvLfhf: { bsonType: 'double', description: 'HRV-LF/HF' },
          anomalyDetected: { bsonType: 'bool', description: '이상 탐지 여부' },
          riskScore: { bsonType: 'int', minimum: 0, maximum: 100, description: '위험도 점수' },
          riskLevel: { enum: ['high', 'mid', 'low'], description: '위험도 단계' },
          analyzedAt: { bsonType: 'date', description: '분석 시각' },
          createdAt: { bsonType: 'date', description: '저장 일자' },
        },
      },
    },
    indexes: [
      { key: { measurementId: 1 }, options: { unique: true } },
      { key: { userId: 1, analyzedAt: -1 } },
      { key: { riskLevel: 1 } },
    ],
  },

  /* 6) reports */
  {
    name: 'reports',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['analysisId', 'userId', 'reportType', 'reportCategory', 'riskLevel', 'createdAt'],
        properties: {
          analysisId: { bsonType: 'objectId', description: '분석 결과 참조' },
          userId: { bsonType: 'objectId', description: '사용자 참조' },
          reportType: { enum: ['self', 'guardian'], description: '리포트 유형' },
          reportCategory: { enum: ['emergency_alert', 'full_report'], description: '리포트 구분' },
          reportTextUser: { bsonType: 'string', description: '본인용 안내문' },
          reportTextGuardian: { bsonType: 'string', description: '보호자용 리포트' },
          recommendedAction: { bsonType: 'string', description: '권장 조치' },
          ttsAudioUrl: { bsonType: 'string', description: '본인용 음성 경로' },
          pdfUrl: { bsonType: 'string', description: 'PDF 경로' },
          riskLevel: { enum: ['high', 'mid', 'low'], description: '위험도 단계' },
          createdAt: { bsonType: 'date', description: '생성 일자' },
        },
      },
    },
    indexes: [
      { key: { analysisId: 1 } },
      { key: { userId: 1, createdAt: -1 } },
    ],
  },

  /* 7) notifications */
  {
    name: 'notifications',
    validator: {
      $jsonSchema: {
        bsonType: 'object',
        required: ['analysisId', 'userId', 'guardianId', 'riskLevel', 'channel', 'message', 'sendStatus', 'sentAt', 'createdAt'],
        properties: {
          analysisId: { bsonType: 'objectId', description: '분석 결과 참조' },
          userId: { bsonType: 'objectId', description: '본인 참조' },
          guardianId: { bsonType: 'objectId', description: '보호자 참조' },
          riskLevel: { enum: ['high', 'mid', 'low'], description: '위험도 단계' },
          channel: { enum: ['push', 'sms'], description: '발송 채널' },
          message: { bsonType: 'string', description: '알림 메시지' },
          sendStatus: { enum: ['success', 'fail'], description: '발송 상태' },
          isRead: { bsonType: 'bool', description: '확인 여부' },
          sentAt: { bsonType: 'date', description: '발송 시각' },
          createdAt: { bsonType: 'date', description: '저장 일자' },
        },
      },
    },
    indexes: [
      { key: { guardianId: 1, sentAt: -1 } },
      { key: { analysisId: 1 } },
    ],
  },
];

async function initDatabase() {
  await mongoose.connect(MONGO_URI);
  const db = mongoose.connection.db;
  console.log(`✅ MongoDB 연결됨 (DB: ${db.databaseName})\n`);

  const existing = (await db.listCollections().toArray()).map((c) => c.name);

  for (const col of collections) {
    try {
      if (existing.includes(col.name)) {
        await db.command({ collMod: col.name, validator: col.validator, validationLevel: 'moderate' });
        console.log(`♻️  [${col.name}] 이미 존재 → 검증 규칙 갱신`);
      } else {
        await db.createCollection(col.name, { validator: col.validator });
        console.log(`🆕 [${col.name}] 생성 완료`);
      }

      const coll = db.collection(col.name);
      for (const idx of col.indexes) {
        const name = await coll.createIndex(idx.key, idx.options || {});
        console.log(`    └─ index: ${name}`);
      }
    } catch (e) {
      console.error(`❌ [${col.name}] 처리 중 오류:`, e.message);
    }
  }

  await mongoose.disconnect();
  console.log('\n🎉 모든 컬렉션 초기화 완료');
}

initDatabase().catch((e) => {
  console.error('치명적 오류:', e);
  process.exit(1);
});
