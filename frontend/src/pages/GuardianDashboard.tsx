// frontend/src/pages/GuardianDashboard.tsx
// =============================================================================
// 보호자 대시보드 — 연결된 가족 구성원들의 건강 상태 요약
//
// [이 파일이 하는 일]
//   - 상단에 요약 바(연결 인원 / 미확인 알림 / 위험 단계)를 보여줍니다.
//   - 각 가족 구성원을 카드로 보여주고, 위험도에 따라 색이 달라집니다.
//   - '상세 보기'를 누르면 해당 구성원의 상세 화면으로 이동합니다.
//
// [1단계 리팩터링에서 바뀐 점 — 기능은 그대로, '겉모양 코드'만 정리]
//   1) 위험도 색상(상/중/하)을 이 파일에서 직접 적던 것을
//      → 공통 토큰(tokens.ts)의 COLORS 값을 가져와 한 곳에서 관리하도록 정리
//   2) 색상 하드코딩(#0D9488) → 토큰 클래스(text-primary)
//   3) 글자 크기 인라인 style → 토큰 클래스(text-small 등)
//   ※ 위험도별로 색이 바뀌는 카드 테두리/배경은 '동적 색상'이라
//      인라인 style 이 꼭 필요합니다. 다만 색 값은 토큰에서 가져옵니다.
//   ※ 화면 결과(디자인/동작)는 이전과 똑같습니다.
// =============================================================================

import { Bell, Clock, ArrowRight } from "lucide-react";
import type { Patient } from "../components/layout/GuardianLayout";
import type { AppNotification } from "../api/notificationApi";
import { COLORS } from "../styles/tokens";

// -----------------------------------------------------------------------------
// [위험도 설정] 위험 등급(high/mid/low)별로 색/배경/테두리/표시 문구를 모아둡니다.
//   - 색 값은 공통 토큰(COLORS)에서 가져와, 앱 전체와 동일한 색을 씁니다.
//   - bg(연한 배경)/border(연한 테두리)는 이 카드에서만 쓰는 톤이라 여기 둡니다.
// -----------------------------------------------------------------------------
const RISK_CONFIG = {
  high: { color: COLORS.danger,  bg: COLORS.dangerBg,  border: COLORS.dangerBorder,  label: "위험", kr: "상" },
  mid:  { color: COLORS.warning, bg: COLORS.warningBg, border: COLORS.warningBorder, label: "주의", kr: "중" },
  low:  { color: COLORS.safe,    bg: COLORS.safeBg,    border: COLORS.safeBorder,    label: "양호", kr: "하" },
};
// 위험도가 아직 분석되지 않은 경우 쓰는 기본 회색 설정
const DEFAULT_CFG = { color: "#9CA3AF", bg: "#F9FAFB", border: "#E5E7EB", label: "미분석", kr: "-" };

// -----------------------------------------------------------------------------
// [도우미] 마지막 측정 시각(ISO 문자열)을 사람이 읽기 쉬운 말로 바꿔줍니다.
//   - 예: "방금 전", "오늘 14:30", "어제 09:10", "3일 전 ..."
// -----------------------------------------------------------------------------
function formatLastMeasured(iso: string | null): string {
  if (!iso) return "측정 없음";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3600000); // 경과 시간(시간 단위)
  const timeStr = new Date(iso).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  if (h < 1) return "방금 전";
  if (h < 24) return `오늘 ${timeStr}`;
  if (h < 48) return `어제 ${timeStr}`;
  return `${Math.floor(h / 24)}일 전 ${timeStr}`;
}

interface GuardianDashboardProps {
  patients: Patient[];
  notifications: AppNotification[];
  onSelectMember: (userId: string) => void;
}

export function GuardianDashboard({ patients, notifications, onSelectMember }: GuardianDashboardProps) {
  // 위험 단계(high)인 사람 수와, 안 읽은 알림 수를 미리 계산
  const highRiskCount = patients.filter(p => p.risk_level === "high").length;
  const unreadCount = notifications.filter(n => !n.isRead).length;

  // 알림을 '구성원 이름'별로 묶어둡니다. (각 카드에서 자기 알림만 꺼내 쓰기 위해)
  const notifsByNickname = new Map<string, AppNotification[]>();
  for (const n of notifications) {
    const name = n.memberName ?? "";
    notifsByNickname.set(name, [...(notifsByNickname.get(name) ?? []), n]);
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* 페이지 제목 */}
      <div className="mb-8">
        <h1 className="font-bold text-primary text-[1.9rem]">연결된 가족 현황</h1>
        <p className="text-gray-600 mt-2 font-bold text-[1.1rem]">연결된 가족 구성원의 건강 상태를 확인합니다.</p>
      </div>

      {/* 요약 바: 연결 인원 / 미확인 알림 / 위험 단계 */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          { label: "연결 인원",   value: `${patients.length}명`, urgent: false, count: 0 },
          { label: "미확인 알림", value: `${unreadCount}건`,     urgent: true,  count: unreadCount },
          { label: "위험 단계",   value: `${highRiskCount}명`,   urgent: true,  count: highRiskCount },
        ].map(s => {
          // urgent(긴급) 항목인데 0보다 크면 빨간 강조, 아니면 기본
          const isAlert = s.urgent && s.count > 0;
          return (
            <div
              key={s.label}
              className={`bg-white rounded-xl p-5 text-center shadow-sm border ${isAlert ? "border-red-200 bg-red-50" : "border-gray-100"}`}
            >
              <div className={`font-bold text-[1.8rem] ${isAlert ? "text-red-600" : "text-primary"}`}>
                {s.value}
              </div>
              <div className="text-gray-500 mt-1 font-bold text-small">{s.label}</div>
            </div>
          );
        })}
      </div>

      {patients.length === 0 ? (
        // 연결된 가족이 한 명도 없을 때
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400 font-bold text-[1.1rem]">연결된 가족 구성원이 없습니다.</p>
          <p className="text-gray-400 mt-2 font-bold text-tiny">마이페이지에서 사용자를 등록하세요.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {patients.map(patient => {
            // 이 구성원의 위험도 설정과 알림들을 꺼냅니다.
            const cfg = patient.risk_level ? RISK_CONFIG[patient.risk_level] : DEFAULT_CFG;
            const patientNotifs = notifsByNickname.get(patient.nickname) ?? [];
            const unreadNotifs  = patientNotifs.filter(n => !n.isRead);
            // 최근 24시간 안에 온 알림 1개(있으면 '오늘의 알림'으로 표시)
            const todayAlert    = patientNotifs.find(n =>
              Date.now() - new Date(n.createdAt).getTime() < 24 * 3600 * 1000
            );

            return (
              // 카드 테두리 색이 위험도에 따라 달라지므로 '동적 색상' → 인라인 style 필요
              <div
                key={patient.user_id}
                className="w-full text-left bg-white rounded-2xl shadow-sm overflow-hidden"
                style={{ border: `2px solid ${cfg.border}` }}
              >
                <div className="flex">
                  {/* 왼쪽 세로 색 막대 (위험도 색) */}
                  <div className="w-2 shrink-0" style={{ backgroundColor: cfg.color }} />
                  <div className="flex-1 p-6">
                    {/* 상단: 이름/나이 + 위험도 배지 */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-gray-800 font-bold text-[1.4rem]">{patient.nickname}</span>
                          {patient.age != null && (
                            <span className="text-gray-500 font-bold text-small">{patient.age}세</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 text-gray-500 font-bold text-small">
                          <Clock className="w-5 h-5" />
                          최근 측정: {formatLastMeasured(patient.latest_measured_at)}
                        </div>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        {/* 위험도 배지 (색은 위험도별 동적 → 인라인 style) */}
                        <span
                          className="px-4 py-1.5 rounded-full text-white font-bold text-small"
                          style={{ backgroundColor: cfg.color }}
                        >
                          위험도 {cfg.kr} — {cfg.label}
                        </span>
                        {unreadNotifs.length > 0 && (
                          <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-full px-3 py-1.5">
                            <Bell className="w-4 h-4 text-red-500" />
                            <span className="text-red-600 font-bold text-small">미확인 {unreadNotifs.length}건</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 위험도 점수 막대 (점수가 있을 때만) */}
                    {patient.risk_score != null && (
                      <div className="mt-5">
                        <div className="flex items-center justify-between font-bold mb-2 text-small">
                          <span className="text-gray-500">위험도 점수</span>
                          <span style={{ color: cfg.color, fontWeight: 800 }}>{patient.risk_score}점</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-3">
                          {/* 채워지는 길이(width)와 색이 동적 → 인라인 style 필요 */}
                          <div
                            className="h-3 rounded-full transition-all"
                            style={{ width: `${patient.risk_score}%`, backgroundColor: cfg.color }}
                          />
                        </div>
                      </div>
                    )}

                    {/* 오늘의 알림 (최근 24시간 내 알림이 있을 때) */}
                    {todayAlert && (
                      <div
                        className="mt-4 rounded-xl p-3 flex items-start gap-2"
                        style={{ backgroundColor: cfg.bg, border: `1px solid ${cfg.border}` }}
                      >
                        <Bell className="w-5 h-5 shrink-0 mt-0.5" style={{ color: cfg.color }} />
                        <div>
                          <span className="font-bold block text-[0.85rem]" style={{ color: cfg.color }}>오늘의 알림</span>
                          <span className="text-gray-700 font-bold text-tiny">{todayAlert.message}</span>
                        </div>
                      </div>
                    )}

                    {/* 상세 보기 버튼 (색이 위험도별 동적이라 일반 button 유지) */}
                    <div className="mt-4 flex justify-end">
                      <button
                        onClick={() => onSelectMember(patient.user_id)}
                        className="flex items-center gap-2 px-5 py-2.5 rounded-xl font-black transition-all hover:opacity-80 active:scale-95 text-white text-small"
                        style={{ backgroundColor: cfg.color }}
                      >
                        상세 보기
                        <ArrowRight className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <p className="mt-6 text-center text-gray-400 font-bold text-small">최대 3명까지 연결할 수 있습니다.</p>
    </div>
  );
}
