# ❤️ HeartLink

> ECG 심혈관 이상탐지 및 LLM 리포트 서비스

**팀명: HeartLinkers**

<br>

## 📑 목차
1. [프로젝트명](#1-프로젝트명)
2. [서비스 소개](#2-서비스-소개)
3. [프로젝트 기간](#3-프로젝트-기간)
4. [주요 기능](#4-주요-기능)
5. [기술 스택](#5-기술-스택)
6. [시스템 아키텍처](#6-시스템-아키텍처)
7. [유스케이스](#7-유스케이스)
8. [데이터 흐름도](#8-데이터-흐름도)
9. [ER 다이어그램](#9-er-다이어그램)
10. [화면 구성](#10-화면-구성)
11. [팀원 역할](#11-팀원-역할)
12. [트러블슈팅](#12-트러블슈팅)

<br>

## 1. 프로젝트명

**HeartLink** — ECG 심혈관 이상탐지 및 LLM 리포트 서비스

- 팀명: **HeartLinkers**
- 멘토 기업: ㈜뷰노

<br>

## 2. 서비스 소개

초고령사회 진입과 1인 가구 고령자 증가로, 심혈관 이상이 발생해도 즉각적인 보호자 연락이 어려운 사각지대가 확대되고 있습니다.

HeartLink는 웨어러블로 측정한 ECG(심전도) 데이터를 AI로 분석하여 **부정맥·심방세동(AF) 등 심혈관 이상을 조기 탐지**하고, 위험도(상/중/하)에 따라 **보호자에게 자동으로 알림**을 전송합니다. 또한 LLM(Gemini)을 통해 **본인용·보호자용 듀얼 리포트**를 자연어로 생성하여 의학용어 장벽을 해소하며, 본인용 리포트는 음성(TTS)으로도 제공해 시력이 약한 고령자의 접근성을 확보합니다.

리포트는 **일일·주간 두 가지 기간 단위**로 제공합니다. 일일 리포트는 요청 시점에 당일 측정 데이터를 종합해 생성하되, **당일 새 측정이 없으면 캐시를 반환**(`lastAnalysisAt` 기준)해 재생성을 최소화합니다. 주간 리포트는 **스케줄러가 사전 생성**해 두고 조회 시점에 불러옵니다. ECG 원본 데이터는 저장하지 않고 분석 후 즉시 폐기하여 민감 의료정보 노출을 최소화하는, **1인 가구 고령자 특화 심혈관 케어 시스템**입니다.

#### 🔑 차별점
- 보호자(가족) 계정을 **N:M으로 자유롭게 연계**하여 위험도별 자동 알림 분기
- **본인용 + 보호자용 듀얼 LLM 리포트** 생성 (본인용은 TTS 음성 제공)
- **일일(온디맨드·캐싱) + 주간(스케줄링) 리포트**로 효율적 생성
- 대한부정맥학회 가이드라인을 **동적 프롬프트 구성** 방식으로 삽입하여 **LLM 환각 최소화**
- ECG 원본 미저장으로 **개인정보 보호 강화**

<br>

## 3. 프로젝트 기간

**2026-05-26 ~ 2026-07-09**

| 주차 | 기간 | 주요 활동 |
|------|------|-----------|
| 1주차 | 05/26 ~ 06/01 | 요구사항 정의, 멘토링 |
| 2주차 | 06/02 ~ 06/08 | 데이터셋 확보·EDA, 화면 설계 (06/08 기획 발표) |
| 3주차 | 06/09 ~ 06/15 | AI 베이스라인 학습, API 골격 구축 |
| 4주차 | 06/16 ~ 06/22 | AI 모델 성능 개선, LLM 파이프라인 |
| 5주차 | 06/23 ~ 06/29 | 보호자 알림, TTS 모듈, 통합 (06/26 최종 시연) |
| 6주차 | 06/30 ~ 07/09 | 통합 테스트, 시연 영상, 발표 (07/09 발표회) |

<br>

## 4. 주요 기능

| 구분 | 기능 |
|------|------|
| 👤 사용자/보호자 관리 | 회원가입·로그인(JWT), 휴대폰 인증, 아이디/비밀번호 찾기(이메일 인증), 보호자 계정 연계(N:M, 인원 제한 없음) 및 권한 관리, 프로필 입력 |
| 📤 ECG 업로드·전처리 | CSV(단일 리드) 업로드, AI 서버에서 파싱·대역통과 필터(0.5~40Hz)·baseline wander 제거, R-peak 검출, 경량 파형(ecgWaveformLite) 생성 |
| 🧠 AI 분석 | 부정맥 5종 분류(ResNet1D), 심방세동(AF) 이진 분류, HRV 기반 이상 탐지, 위험도 점수화(0~100) |
| 📝 LLM 듀얼 리포트 | 본인용(친절 안내체)·보호자용(위험도 요약+권장 조치) 리포트 생성, 일일(온디맨드·캐싱)·주간(스케줄링) |
| 🔊 음성 안내 | 본인용 리포트 한국어 TTS(mp3) 변환 |
| 🔔 보호자 알림 | 상(긴급)=FCM+SMS 즉시 / 중·하=앱 내 알림·주간 요약 |
| 📊 시각화 대시보드 | ECG 파형+R-peak, HRV 트렌드(일/주), 위험도 게이지, 보호자 통합 모니터링 |
| 📄 리포트 관리 | 과거 리포트 이력 조회 및 PDF 다운로드(프론트엔드 생성) |

<br>

## 5. 기술 스택

#### Frontend
- React 18 (Vite), React Router, Axios
- Recharts (ECG 파형/트렌드), Chart.js (HRV)
- Figma (UI/UX 설계)

#### Backend
- Node.js 20.x + Express.js
- JWT, bcrypt (인증·암호화), Multer (업로드)
- Mongoose (ODM)
- 주간 리포트 스케줄러 (사전 생성)
- Firebase Admin SDK (FCM), SOLAPI (SMS), Nodemailer + Gmail SMTP (이메일 인증)

#### AI / Data
- Python 3.10 + FastAPI
- scipy (전처리), PyTorch (ResNet1D)
- HRV 이상 탐지: 비지도 방식, 의학 기준값으로 검증
- ONNX / ONNX Runtime (경량 추론 배포)

#### API / Infra
- Google Gemini 2.5 Flash API + MCP (Model Context Protocol)
- Google Cloud TTS API, Firebase Cloud Messaging(FCM), SOLAPI(SMS)
- MongoDB 8.x (Atlas), GitHub, Notion

#### 모델 성능 지표
- 부정맥 5종 분류(AAMI EC57): **macro F1-score 0.5**
- 심방세동(AF) 이진 분류: **F1-score 0.85**
- HRV 이상 탐지: 비지도학습으로 F1 개념이 없으며, 의학 기준값으로 검증

<br>

## 6. 시스템 아키텍처

프론트엔드(React) ↔ 백엔드(Node.js/Express) ↔ AI 서버(Python/FastAPI)를 분리하여 확장성을 확보하고, MongoDB와 외부 API(Gemini+MCP, TTS, FCM, SOLAPI, Gmail SMTP)를 연동합니다.

> ※ ECG 파싱·전처리·경량 파형 생성은 AI 서버(FastAPI)가 수행하며, 원본 ECG(CSV)·풀해상도 신호는 저장하지 않고 분석 후 폐기
![시스템 아키텍처](docs/diagrams/architecture.png)
> 
<br>

## 7. 유스케이스

![유스케이스 다이어그램](docs/diagrams/usecase.png)

- **사용자**: 회원가입, 로그인, 휴대폰 인증, 아이디/비밀번호 찾기, 프로필 입력, ECG(CSV) 업로드, 보호자 등록, 일일 리포트 요청, 주간 리포트 조회, 리포트 음성 안내(TTS), 대시보드 조회, 리포트 PDF 다운로드
- **보호자**: 로그인, 등록 요청 수락/거절, 알림 권한 설정, 위험도 알림 수신, 대시보드 조회, 리포트 조회
- **AI 서버**: ECG 파싱·전처리·경량 파형 생성, AI 부정맥·심혈관 이상 분석, 위험도 산정, 분석 결과 저장
- **외부 연동 시스템**: LLM 듀얼 리포트 생성(Gemini), TTS 음성 변환, 보호자 알림 발송(FCM/SOLAPI), 이메일 발송(Gmail SMTP)

> 실선 = 액터-유스케이스 연관 / 점선(include) = 필수 포함 기능 / 점선(extend) = 선택 확장 기능

<br>

## 8. 데이터 흐름도

업로드된 ECG(CSV) 데이터를 중심으로, 업로드 → AI 분석 → 경량 파형/분석 결과 저장 → 리포트·알림 생성까지의 데이터 흐름을 나타냅니다.

![데이터 흐름도](docs/diagrams/flowchart.png)


<br>

## 9. ER 다이어그램

MongoDB **8개 컬렉션**으로 구성됩니다.

![ER 다이어그램](docs/diagrams/erd.png)
| 컬렉션 | 설명 | 주요 관계 |
|--------|------|-----------|
| `users` | 본인/보호자 공용 계정·프로필(소셜 로그인·휴대폰 인증·refreshToken) | 모든 컬렉션의 중심 |
| `guardianRelations` | 사용자-보호자 연계 및 알림 권한 (pending/accepted/rejected) | users N:M (인원 제한 없음) |
| `measurements` | ECG 메타데이터·경량 파형·R-peak·분석상태 (CSV 단독, 원본 비저장) | users 1:N |
| `analysisResults` | 부정맥·AF·HRV·심박수·위험도 분석 결과 | measurements 1:1 |
| `reports` | LLM 듀얼 리포트(일/주)·TTS·차트 데이터·캐싱 | analysisResults N:M |
| `notifications` | 위험도 단계별 보호자 알림 이력 (push/sms/app) | users·guardian 참조 |
| `phoneVerifications` | 휴대폰 인증번호 임시 저장 (signup/findPw/findEmail, TTL) | users 논리 참조 |
| `passwordResetCodes` | 비밀번호 재설정 이메일 인증번호 임시 저장 (bcrypt, TTL) | 독립 |

> ※ `reports`는 PDF를 저장하지 않습니다(PDF는 프론트엔드에서 생성). 한 분석 결과가 일/주 리포트에 함께 포함될 수 있어 논리상 N:M 관계입니다.

<br>

## 10. 화면 구성

| 화면 | 설명 |
|------|------|
| 회원가입 / 로그인 | 이메일·비밀번호·닉네임 입력, JWT 인증, 휴대폰 인증 |
| 아이디/비밀번호 찾기 | 이메일 인증(Nodemailer+Gmail SMTP) 기반 |
| 프로필 입력 | 연령·성별·기저질환 입력 |
| 보호자 등록 | 보호자 정보 입력 및 권한 관리 (N:M, 인원 제한 없음) |
| ECG 업로드 | CSV 파일 업로드 및 실시간 파형 렌더링 |
| 대시보드 | ECG 파형+R-peak, HRV 트렌드(일/주), 위험도 게이지, 이상 탐지 타임라인 |
| 리포트 | 본인용/보호자용 듀얼 리포트(일/주), TTS 재생, PDF 다운로드 |
| 보호자 전용 뷰 | 가족 구성원 통합 모니터링 |

> 🎨 화면 설계: [Figma 링크 추가 예정]

<br>

## 11. 팀원 역할

| 이름 | 역할 | 담당 업무 |
|------|------|-----------|
| **주양덕** | 팀장 / PM / DB / Frontend | 프로젝트 일정·역할 관리, 산출물 총괄, 문서 작업, PPT·발표, MongoDB 스키마 설계 및 인덱스 전략, 프론트 회원가입 구현 |
| **문정인** | Backend | 회원가입·대시보드·ECG 파형/위험도 시각화 연동, AI-Server ECG 분석 연동, LLM 리포트 파이프라인, DB 입출력 통괄 등 서버 간 기능별 연결 구현 |
| **김동건** | Frontend | React + Recharts 기반 보호자/사용자 대시보드, ECG 파형·위험도 시각화 UI, 시니어 친화적 UI 설계, 사용자 화면 구현 |
| **신예은** | AI / Data Modeling | ECG 공개 데이터셋 조사·EDA, ResNet1D 부정맥·AF 분류 모델, HRV 이상 탐지, Gemini+MCP LLM 리포트 파이프라인 |

> Backend(Node.js + Express, JWT 인증, FCM/SOLAPI 알림, Gmail SMTP 이메일 인증) 및 AI 서버 연동은 팀 협업으로 진행

<br>

## 12. 트러블슈팅

작업 중 발생한 이슈와 해결 과정을 기록합니다.

#### 🐛 이슈 #1: [DB] MongoDB Atlas SRV 주소 연결 실패
- **문제**: mongodb+srv:// 형식의 SRV 주소로 Atlas 연결 시 querySrv ENOTFOUND / ENODATA / DNS timeout 등의 오류 발생하며 접속 실패 (비밀번호·IP 허용 설정은 모두 정상)
- **원인**: SRV 주소는 연결 전 DNS에서 SRV 레코드(실제 서버 목록·포트)와 TXT 레코드(replicaSet, authSource, ssl=true 등 옵션)를 조회해야 하는데, 일부 회사·학교·공공기관 네트워크, 국내 ISP, 공유기·방화벽 환경에서 이 특수 DNS 조회가 차단·미응답되어 실제 서버를 찾지 못함 (일반 A 레코드 조회는 정상)
- **해결**: 서버 주소·포트와 연결 옵션이 모두 명시된 non-SRV(Standard) 주소 사용 — mongodb://...shard-00-00...:27017,...shard-00-01...:27017,...shard-00-02...:27017/...?ssl=true&replicaSet=...&authSource=admin. SRV 조회 단계를 건너뛰므로 해당 환경에서도 정상 접속됨
- **참고**: non-SRV는 서버 주소가 고정 기재되어 있어, 추후 Atlas가 클러스터 노드를 변경하면 주소를 수동 갱신해야 할 수 있음. 다만 SRV 조회가 막히는 환경에서는 가장 확실한 해결책

#### 🐛 이슈 #2: reports 유니크 인덱스 중복 키(E11000)
- **문제**: `{userId, reportType, reportPeriod, lastAnalysisAt}` 유니크 인덱스 생성 시 `E11000 duplicate key` 발생
- **원인**: 구버전 리포트 문서의 `reportPeriod/lastAnalysisAt`이 `null`로 중복
- **해결**: `partialFilterExpression`으로 해당 필드가 존재할 때만 유니크를 적용하고, 구버전 데모 데이터 정리(`deleteMany`) 후 인덱스 재생성

> 예시 항목 (개발 진행하며 채워넣으세요)
> - 대용량 모델 가중치(.onnx) Git 용량 초과 → Git LFS / 외부 스토리지 전환
> - Gemini MCP 연동 시 MongoDB 접근 권한·응답 지연 처리
> - FCM + SMS 이중 발송 중복 알림 방지 로직

<br>

---
<div align="center">

**© 2026 HeartLinkers** | ECG × AI × LLM 심혈관 케어 플랫폼

</div>
