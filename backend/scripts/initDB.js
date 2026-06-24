// scripts/initDB.js
// 실행 방법: 프로젝트 루트(backend)에서  ->  node scripts/initDB.js
//
// 이 스크립트가 하는 일 (한 번 실행하면 아래 작업을 순서대로 수행합니다)
//   1) 기존 8개 컬렉션을 전부 삭제(drop)  → 데이터/인덱스/Atlas validator 까지 깨끗이 제거
//   2) 모델(models) 정의를 기준으로 컬렉션을 다시 만들고 인덱스를 동기화
//   3) 데모용 사용자(시니어 2명 + 보호자 5명)와 보호자 관계를 생성
//   4) 시니어마다 30일치 측정/분석 데이터를 생성 (하루 0~3회 랜덤)
//      - 이때 measurement 에는 "진짜 같은" 더미 심전도 파형(ecgWaveformLite)과
//        R파 위치(rPeaks)를 80Hz × 10초 = 800 샘플 분량으로 채워 넣습니다.
//   5) 일/주/월 리포트와 (고위험인 경우) 보호자 알림을 생성
//
// ※ .env 파일에 MONGO_URI, DEMO_*_PN 등의 값이 미리 설정되어 있어야 합니다.

import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcrypt';

// ───────── 8개 모델 불러오기 ─────────
// (컬렉션을 만들고 지우는 순서가 의존 관계 순서와 같도록 정렬합니다)
import User from '../src/models/User.js';
import GuardianRelation from '../src/models/GuardianRelation.js';
import Measurement from '../src/models/Measurement.js';
import AnalysisResult from '../src/models/AnalysisResult.js';
import Report from '../src/models/Report.js';
import Notification from '../src/models/Notification.js';
import PhoneVerification from '../src/models/PhoneVerification.js';
import PasswordResetCode from '../src/models/PasswordResetCode.js';

// MongoDB 접속 주소: .env 에 값이 없으면 로컬 DB로 접속
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/heartlink';

// ───────── 데모 데이터용 환경변수 ─────────
// 데모 계정 공통 비밀번호 (실제 가입 시처럼 bcrypt로 해싱해서 저장합니다)
const DEMO_PASSWORD = process.env.DEMO_PASSWORD || 'test1234';

// 시니어(피보호자) 2명의 전화번호
const SENIOR_PHONES = [
  process.env.DEMO_SENIOR1_PN,
  process.env.DEMO_SENIOR2_PN,
];

// 보호자 5명의 전화번호
const GUARDIAN_PHONES = [
  process.env.DEMO_GUARDIAN1_PN,
  process.env.DEMO_GUARDIAN2_PN,
  process.env.DEMO_GUARDIAN3_PN,
  process.env.DEMO_GUARDIAN4_PN,
  process.env.DEMO_GUARDIAN5_PN,
];

// 전화번호 값이 하나라도 비어 있으면 즉시 에러 (오타/미설정 방지)
if (SENIOR_PHONES.some((p) => !p) || GUARDIAN_PHONES.some((p) => !p)) {
  throw new Error('데모 전화번호 환경변수(.env)가 누락되었습니다. DEMO_*_PN 값을 확인하세요.');
}

// drop 및 인덱스 동기화 대상 (생성 순서 = 의존 관계 순서)
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

// ════════════════════════════════════════════════════════════════════
//  더미 심전도(ECG) 데이터 생성 영역  ★ 이번에 핵심으로 추가/변경된 부분 ★
// ════════════════════════════════════════════════════════════════════

// 더미 심전도의 기본 사양: 80Hz(1초에 80번 측정) × 10초 = 총 800개 샘플
const DUMMY_FS = 80;                       // 샘플링 주파수 (Hz)
const DUMMY_DURATION_SEC = 10;             // 측정 길이 (초)
const DUMMY_SAMPLE_COUNT = DUMMY_FS * DUMMY_DURATION_SEC; // 80 × 10 = 800개

/**
 * generateDummyEcg
 * ---------------------------------------------------------------
 * "진짜 심전도처럼 보이는" 더미 파형과 R파(심박 정점) 위치를 만들어 줍니다.
 *
 * 심전도 한 박동은 보통 P파 → QRS파(가장 뾰족한 봉우리) → T파 모양입니다.
 * 여기서는 가우시안(종 모양) 곡선 여러 개를 더해서 그 모양을 흉내냅니다.
 *   - P파  : QRS 직전의 작고 완만한 봉우리
 *   - QRS  : 가장 높고 뾰족한 봉우리 (이 꼭대기가 바로 R-peak)
 *   - T파  : QRS 뒤의 중간 크기 봉우리
 * 여기에 약간의 잡음(noise)과 기저선 흔들림(baseline wander)을 더해
 * 실제 측정처럼 자연스럽게 만듭니다.
 *
 * @param {number} heartRate  - 분당 심박수(bpm). 박동 간격을 정하는 데 사용
 * @returns {{ waveform: number[], rPeaks: number[] }}
 *          waveform: 길이 800짜리 심전도 진폭 배열 (mV 단위 가정)
 *          rPeaks  : R파가 위치한 "샘플 인덱스" 배열 (0~799 사이 정수)
 */
function generateDummyEcg(heartRate = 75) {
  // 1박동에 걸리는 시간(초) = 60 / 심박수.  예) 75bpm → 0.8초
  const beatIntervalSec = 60 / heartRate;
  // 1박동이 몇 개의 샘플에 해당하는지 = 박동시간 × 샘플링주파수
  const samplesPerBeat = beatIntervalSec * DUMMY_FS;

  // 결과를 담을 배열들
  const waveform = [];
  const rPeaks = [];

  // 가우시안(종 모양) 곡선 한 점의 값을 계산하는 작은 헬퍼 함수
  //   center: 봉우리 중심 위치, amp: 봉우리 높이, width: 봉우리 폭(작을수록 뾰족)
  const gaussian = (x, center, amp, width) =>
    amp * Math.exp(-((x - center) ** 2) / (2 * width ** 2));

  // 800개 샘플을 하나씩 만들어 나갑니다.
  for (let i = 0; i < DUMMY_SAMPLE_COUNT; i++) {
    // 이 샘플이 "현재 박동 안에서 몇 번째 위치"인지 (0 ~ samplesPerBeat)
    const posInBeat = i % samplesPerBeat;

    // ── 한 박동 안에서 P / QRS / T 파를 각각 그립니다 ──
    // 봉우리 중심 위치는 박동 길이에 대한 상대 비율로 잡습니다.
    const pWave = gaussian(posInBeat, samplesPerBeat * 0.20, 0.10, samplesPerBeat * 0.03); // P파
    const qrsWave = gaussian(posInBeat, samplesPerBeat * 0.40, 1.20, samplesPerBeat * 0.012); // QRS(R파)
    const tWave = gaussian(posInBeat, samplesPerBeat * 0.65, 0.25, samplesPerBeat * 0.05); // T파

    // 잡음: 아주 작은 랜덤 값 (실제 센서 노이즈 흉내)
    const noise = (Math.random() - 0.5) * 0.03;
    // 기저선 흔들림: 호흡 등으로 천천히 위아래로 출렁이는 효과 (느린 사인파)
    const baseline = 0.05 * Math.sin((2 * Math.PI * i) / DUMMY_SAMPLE_COUNT);

    // 세 파형 + 잡음 + 기저선을 모두 더하고, 소수점 4자리로 정리해서 저장
    const value = pWave + qrsWave + tWave + noise + baseline;
    waveform.push(+value.toFixed(4));
  }

  // ── R-peak(R파 꼭대기) 위치 계산 ──
  // QRS 봉우리 중심이 박동의 40% 지점이므로, 각 박동마다 그 위치를 인덱스로 환산
  for (let beat = 0; ; beat++) {
    const rIndex = Math.round(beat * samplesPerBeat + samplesPerBeat * 0.40);
    if (rIndex >= DUMMY_SAMPLE_COUNT) break; // 800을 넘어가면 종료
    rPeaks.push(rIndex);
  }

  return { waveform, rPeaks };
}

// ───────── 그 외 유틸 함수들 ─────────

// 위험 점수(0~100)를 위험 등급 문자열로 변환
function levelFromScore(score) {
  if (score >= 70) return 'high';
  if (score >= 40) return 'mid';
  return 'low';
}

// base 값 주변으로 ±(range/2) 만큼 랜덤하게 흔들되, 0~100 범위로 가두는 함수
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
// 하루(day) 시작(00:00) 계산
function startOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

// ───────── 1) 기존 컬렉션 전부 삭제 ─────────
// (데이터 + 인덱스 + Atlas validator 를 한 번에 제거)
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

// ───────── 2) 빈 컬렉션 생성 + 인덱스 재생성 ─────────
async function createCollectionsAndIndexes() {
  for (const model of MODELS) {
    const name = model.collection.collectionName;
    await model.createCollection().catch(() => { });
    await model.syncIndexes();
    console.log(`📁 ${name} 생성 및 인덱스 동기화`);
  }
  console.log('✅ 컬렉션/인덱스 재생성 완료');
}

// ───────── 3) 데모 사용자 + 보호자 관계 생성 ─────────
// 시니어(측정 본인=role:'user') 2명, 보호자(role:'guardian') 5명을 만들고
// (시니어1 ↔ 보호자2명) / (시니어2 ↔ 보호자3명) 으로 연결합니다.
async function seedUsersAndRelations() {
  // 비밀번호는 실제 가입과 동일하게 bcrypt 해싱 (salt rounds = 10)
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // 시니어(측정 본인) 2명 생성
  const seniors = [];
  for (let i = 0; i < SENIOR_PHONES.length; i++) {
    const senior = await User.create({
      email: `senior${i + 1}@demo.com`, // email 필수 + unique
      nickname: `데모시니어${i + 1}`,
      password: passwordHash,
      provider: 'local',          // 일반 가입
      role: 'user',               // ★ 'senior'가 아니라 'user' (측정 본인)
      phone: SENIOR_PHONES[i],    // ★ 필드명은 phoneNumber가 아니라 phone
      phoneVerified: true,        // 데모이므로 인증 완료 상태
      age: 70 + i,                // 데모용 나이
      gender: i % 2 === 0 ? 'M' : 'F',
    });
    seniors.push(senior);
  }

  // 보호자 5명 생성
  const guardians = [];
  for (let i = 0; i < GUARDIAN_PHONES.length; i++) {
    const guardian = await User.create({
      email: `guardian${i + 1}@demo.com`,
      nickname: `데모보호자${i + 1}`,
      password: passwordHash,
      provider: 'local',
      role: 'guardian',           // 보호자
      phone: GUARDIAN_PHONES[i],
      phoneVerified: true,
      age: 40 + i,
      gender: i % 2 === 0 ? 'F' : 'M',
    });
    guardians.push(guardian);
  }

  // 보호자 관계 연결
  //  - 시니어1: 보호자 0,1번 (2명)
  //  - 시니어2: 보호자 2,3,4번 (3명)  → 시니어당 보호자는 최대 3명 정책
  const relationMap = [
    { senior: seniors[0], guardians: [guardians[0], guardians[1]] },
    { senior: seniors[1], guardians: [guardians[2], guardians[3], guardians[4]] },
  ];

  for (const { senior, guardians: gs } of relationMap) {
    for (const g of gs) {
      await GuardianRelation.create({
        userId: senior._id,          // ★ seniorId가 아니라 userId (측정 본인)
        guardianId: g._id,
        guardianName: g.nickname,    // 선택 필드: 보호자 이름
        guardianContact: g.phone,    // 선택 필드: 보호자 연락처
        guardianEmail: g.email,      // 선택 필드: 보호자 이메일
        notifyPermission: true,      // 알림 수신 허용
        relationStatus: 'accepted',  // ★ status가 아니라 relationStatus
      });
    }
  }

  console.log(`👥 사용자 생성 완료: 시니어 ${seniors.length}명 / 보호자 ${guardians.length}명`);

  // 시니어별 연결된 보호자 ID 목록을 함께 반환 (이후 알림 생성에 사용)
  return relationMap.map(({ senior, guardians: gs }) => ({
    senior,
    guardianIds: gs.map((g) => g._id),
  }));
}


// ───────── 4) 한 명의 시니어에 대한 30일치 측정/분석 생성 ─────────
// 하루 측정 횟수를 0~3회로 랜덤 → "여러 번 잰 날 / 안 잰 날"이 섞이도록 합니다.
async function seedMeasurementsForSenior(senior, dayOffsetBase = 0) {
  const DAYS = 30;
  const analysisDocs = [];

  for (let i = DAYS - 1; i >= 0; i--) {
    // 하루 측정 횟수: 0,1,1,2,3 중 랜덤 (가끔 미측정일 포함)
    const timesToday = [0, 1, 1, 2, 3][Math.floor(Math.random() * 5)];

    for (let t = 0; t < timesToday; t++) {
      // 측정 시각: i일 전 날짜로 설정
      const measuredAt = new Date();
      measuredAt.setDate(measuredAt.getDate() - i);
      // 측정 시간대 분산(아침/점심/저녁/야간)
      const hour = [8, 13, 19, 22][t % 4] + Math.floor(Math.random() * 2);
      measuredAt.setHours(hour, Math.floor(Math.random() * 60), 0, 0);

      // 시니어별 추세 차이를 위해 base에 offset 적용 (날이 갈수록 위험도가 조금씩 상승)
      const trend = 25 + (DAYS - 1 - i) * 1.5 + dayOffsetBase;
      const riskScore = jitter(trend, 18);
      const riskLevel = levelFromScore(riskScore);

      const afDetected = Math.random() < riskScore / 150;
      const anomalyDetected = Math.random() < riskScore / 120;
      const arrhythmiaClass = afDetected
        ? 'SVEB'
        : ['N', 'N', 'N', 'VEB'][Math.floor(Math.random() * 4)];

      // 심박수: 위험도가 높을수록 살짝 높아지도록 설정
      const heartRate = jitter(70 + riskScore * 0.2, 12);
      const arrhythmiaCount = arrhythmiaClass === 'N' ? 0 : 1 + Math.floor(Math.random() * 5);

      // ★ 핵심: 이 측정의 심박수에 맞춰 80Hz × 10초짜리 더미 심전도 파형과 R-peak 생성 ★
      const { waveform, rPeaks } = generateDummyEcg(heartRate);

      const measurement = await Measurement.create({
        userId: senior._id,
        fileName: `ecg_${measuredAt.toISOString().slice(0, 19).replace(/[:T]/g, '')}.csv`,
        fileExt: 'CSV',
        fileSize: 50000 + Math.floor(Math.random() * 10000),
        leadType: 'Lead I',
        samplingRate: DUMMY_FS,        // 80Hz 로 맞춤 (더미 파형과 일치)
        ecgWaveformLite: waveform,     // 800개 샘플의 심전도 진폭 배열
        status: 'completed',
        rPeaks: rPeaks,                // R파(심박 정점) 위치 인덱스 배열
        measuredAt,
      });

      // 측정 1건에 대응하는 분석 결과 1건을 준비 (한꺼번에 insertMany 로 저장)
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

// ───────── 5) 시니어의 분석 결과로 일/주/월 리포트 + 알림 생성 ─────────
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

    // 차트용 간단 집계(예시): 위험도별 개수 카운트
    const riskCount = inRange.reduce(
      (acc, a) => ((acc[a.riskLevel] = (acc[a.riskLevel] || 0) + 1), acc),
      {}
    );

    const report = await Report.create({
      userId: senior._id,
      reportType,
      // 최신 Report.js enum 반영: emergencyAlert / fullReport (camelCase)
      reportCategory: maxLevel === 'high' ? 'emergencyAlert' : 'fullReport',
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

      // 보호자용 + 고위험이면 알림 생성 (연결된 보호자 전원에게)
      if (r && reportType === 'guardian' && r.maxRiskLevel === 'high') {
        for (const gId of guardianIds) {
          await Notification.create({
            analysisId: r.analysisIds[r.analysisIds.length - 1],
            userId: senior._id,
            guardianId: gId,
            riskLevel: r.maxRiskLevel,
            channel: 'push',
            message: `${senior.nickname}님의 위험도가 높습니다. 확인이 필요합니다.`,
            sendStatus: 'success',        // 발송 결과: 데모이므로 성공 처리
            sentAt: r.lastAnalysisAt,     // 발송 시각: 해당 리포트의 마지막 분석 시각
          });
        }
      }
    }
  }

  console.log(`   📑 ${senior.nickname}: 리포트 ${reportCount}건 생성`);
}

// ───────── 메인 실행부 ─────────
// 위에서 정의한 함수들을 순서대로 호출합니다.
async function main() {
  console.log('🔌 MongoDB 접속 중...');
  await mongoose.connect(MONGO_URI);
  console.log('✅ MongoDB 접속 완료');

  // 1) 기존 컬렉션 삭제
  await dropAllCollections();
  // 2) 컬렉션/인덱스 재생성
  await createCollectionsAndIndexes();
  // 3) 사용자 + 보호자 관계 생성
  const seniorInfos = await seedUsersAndRelations();

  // 4) + 5) 시니어별로 측정/분석/리포트/알림 생성
  for (let idx = 0; idx < seniorInfos.length; idx++) {
    const { senior, guardianIds } = seniorInfos[idx];
    // 시니어마다 추세를 다르게 하려고 offset 부여 (두 번째 시니어가 조금 더 위험하게)
    const analyses = await seedMeasurementsForSenior(senior, idx * 8);
    await seedReportsAndNotifications(senior, guardianIds, analyses);
  }

  console.log('🎉 데이터베이스 초기화 및 데모 데이터 생성이 모두 완료되었습니다!');
}

// 스크립트 실행 (성공/실패와 관계없이 마지막엔 연결을 끊고 프로세스 종료)
main()
  .catch((err) => {
    console.error('❌ 초기화 중 오류 발생:', err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
    console.log('🔌 MongoDB 연결 종료');
  });
