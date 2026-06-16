// scripts/fixUserIndex.js
// 실행: node scripts/fixUserIndex.js
import 'dotenv/config';
import mongoose from 'mongoose';

const MONGO_URI = process.env.MONGO_URI;

async function run() {
  await mongoose.connect(MONGO_URI);
  const users = mongoose.connection.db.collection('users');

  // 1) seed가 만들다 만 데모 데이터 정리 (선택)
  const del = await users.deleteMany({
    email: { $regex: /^(senior_|guardian_)/ },
  });
  console.log(`🧹 데모 사용자 ${del.deletedCount}건 삭제`);

  // 2) 잘못된 기존 인덱스 드롭
  try {
    await users.dropIndex('provider_1_provider_id_1');
    console.log('🗑️  기존 provider_1_provider_id_1 인덱스 삭제');
  } catch (e) {
    console.log('ℹ️  드롭할 인덱스 없음 (무시 가능):', e.message);
  }

  await mongoose.disconnect();
  console.log('✅ 정리 완료');
}

run().catch((e) => { console.error(e); process.exit(1); });
