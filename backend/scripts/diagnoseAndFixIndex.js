// scripts/diagnoseAndFixIndex.js
// 실행: node scripts/diagnoseAndFixIndex.js
import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  const users = mongoose.connection.db.collection('users');

  // 1) 현재 인덱스 전부 출력 (진단)
  console.log('── 현재 users 인덱스 ──');
  const before = await users.indexes();
  console.log(JSON.stringify(before, null, 2));

  // 2) 데모 데이터 정리
  const del = await users.deleteMany({ email: { $regex: /^(senior_|guardian_)/ } });
  console.log(`\n🧹 데모 사용자 ${del.deletedCount}건 삭제`);

  // 3) provider/providerId 관련 인덱스 전부 드롭 (이름이 뭐든)
  for (const idx of before) {
    if (idx.key && idx.key.provider !== undefined && idx.key.providerId !== undefined) {
      await users.dropIndex(idx.name);
      console.log(`🗑️  인덱스 삭제: ${idx.name}`);
    }
    // phone 단일 유니크도 정리
    if (idx.key && Object.keys(idx.key).length === 1 && idx.key.phone !== undefined) {
      await users.dropIndex(idx.name);
      console.log(`🗑️  인덱스 삭제: ${idx.name}`);
    }
  }

  // 4) partial 인덱스로 새로 생성
  await users.createIndex(
    { provider: 1, providerId: 1 },
    { unique: true, partialFilterExpression: { providerId: { $exists: true, $type: 'string' } } }
  );
  console.log('✅ provider+providerId partial unique 인덱스 생성');

  await users.createIndex(
    { phone: 1 },
    { unique: true, partialFilterExpression: { phone: { $exists: true, $type: 'string' } } }
  );
  console.log('✅ phone partial unique 인덱스 생성');

  // 5) 최종 인덱스 확인
  console.log('\n── 수정 후 users 인덱스 ──');
  console.log(JSON.stringify(await users.indexes(), null, 2));

  await mongoose.disconnect();
  console.log('\n✅ 완료');
}

run().catch((e) => { console.error(e); process.exit(1); });
