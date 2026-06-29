// GuardianReportPage.tsx
// frontend/src/pages/GuardianReportPage.tsx
// =============================================================================
// 보호자 건강 결과 보고서 페이지 (사용자 선택 → 최근 측정 + 위험도 배너)
//
// [이 화면이 하는 일]
//   - 위쪽 탭으로 "리포트를 볼 사용자(환자)"를 고릅니다.
//   - 고른 환자의 최근 측정 3건과 현재 위험도 배너를 보여줍니다.
//   - '일일 AI 리포트 보기'로 리포트를 생성/이동, '기록 보기'로 과거 리포트로 이동.
//
// [디자인 리뉴얼 포인트 — 기능은 그대로, '겉모양'만 업그레이드]
//   1) 페이지 제목 → 청록→블루 그라데이션 헤더 카드(<Card variant="gradient">)
//   2) 사용자 선택 탭 / 측정 기록 목록 / 빈 상태 → 공통 <Card> 로 통일
//   3) 색 값은 모두 공통 토큰(COLORS)에서 가져옴 (하드코딩 색 제거)
//   ※ 위험도별로 색이 바뀌는 배너/막대/배지는 '동적 색상'이라
//      인라인 style 이 꼭 필요합니다. 다만 색 값은 토큰에서 가져옵니다.
//   ※ 데이터 조회/선택/이동 로직은 이전과 100% 동일합니다.
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Info, ChevronLeft, ChevronRight, Clock, FileText, Sparkles } from "lucide-react";
import api from "../api/authApi";
import type { Patient } from "../components/layout/GuardianLayout";
import { toKSTDatetime } from "../utils/formatKST";
// 공통 UI: 버튼 + 카드(겉모양 통일용)
import { Button, Card } from "../components/ui";
import { COLORS } from "../styles/tokens";

interface MeasurementRecord {
  id: string;
  date: string;
  riskLevel: "상" | "중" | "하";
  riskScore: number;
}

const LEVEL_MAP: Record<string, "상" | "중" | "하"> = { high: "상", mid: "중", low: "하" };

// 위험도 색상 → tokens.ts(COLORS)로 일원화
const RISK_CONFIG = {
  상: { color: COLORS.danger,  bg: COLORS.dangerBg,  border: COLORS.dangerBorder,  label: "위험" },
  중: { color: COLORS.warning, bg: COLORS.warningBg, border: COLORS.warningBorder, label: "주의" },
  하: { color: COLORS.safe,    bg: COLORS.safeBg,    border: COLORS.safeBorder,    label: "양호" },
};

interface GuardianReportPageProps {
  patients: Patient[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
}

export function GuardianReportPage({ patients, selectedUserId, onSelectUser }: GuardianReportPageProps) {
  const navigate = useNavigate();

  // 처음 진입 시, 부모가 알려준 selectedUserId 위치를 시작 인덱스로 잡습니다.
  const initialIdx = selectedUserId
    ? Math.max(0, patients.findIndex(p => p.user_id === selectedUserId))
    : 0;
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);
  const [records, setRecords] = useState<MeasurementRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  // 부모가 선택 환자를 바꾸면(예: 다른 화면에서) 인덱스를 맞춰줍니다.
  useEffect(() => {
    if (!selectedUserId) return;
    const idx = patients.findIndex(p => p.user_id === selectedUserId);
    if (idx >= 0) setSelectedIdx(idx);
  }, [selectedUserId, patients]);

  // 선택된 사용자의 최근 측정 3건 조회
  useEffect(() => {
    if (patients.length === 0) return;
    const userId = patients[Math.min(selectedIdx, patients.length - 1)].user_id;
    onSelectUser(userId);
    (async () => {
      try {
        setRecordsLoading(true);
        const res = await api.get(`/measurements/patient/${userId}`);
        const mapped: MeasurementRecord[] = (res.data || [])
          .slice(0, 3)
          .map((m: any) => ({
            id: m._id,
            date: toKSTDatetime(m.measuredAt || ""),
            riskLevel: LEVEL_MAP[m.analysis?.riskLevel] ?? "하",
            riskScore: m.analysis?.riskScore ?? 0,
          }));
        setRecords(mapped);
      } catch (err) {
        console.error("측정 기록 조회 실패", err);
        setRecords([]);
      } finally {
        setRecordsLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patients, selectedIdx]);

  // ── 연결된 사용자가 한 명도 없을 때 ──
  if (patients.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        {/* [리뉴얼] 제목 → 그라데이션 헤더 카드 */}
        <Card variant="gradient" padding="lg" className="mb-6">
          <h1 className="font-black text-white text-[1.8rem]">건강 결과 보고서</h1>
          <p className="text-white/80 mt-1 font-bold text-small">연결된 사용자의 측정 결과를 확인합니다.</p>
        </Card>
        {/* 빈 상태 → 공통 카드 */}
        <Card padding="lg" className="text-center py-12">
          <p className="text-gray-400 font-bold text-[1.1rem]">
            아직 연결된 사용자가 없어요. 마이페이지에서 사용자를 등록해 보세요.
          </p>
        </Card>
      </div>
    );
  }

  const patient = patients[Math.min(selectedIdx, patients.length - 1)];
  const patientRiskLevel = LEVEL_MAP[patient.risk_level ?? "low"] ?? "하";

  const handleGuardianReport = async () => {
    try {
      setGenerating(true);
      const res = await api.post(`/reports/generate-for/${patient.user_id}`);
      const reportId = res.data?._id;
      navigate(`/guardian-report-detail/${patient.user_id}/daily/${reportId}`);
    } catch (err) {
      console.error("보호자 리포트 생성 실패", err);
    } finally {
      setGenerating(false);
    }
  };
  const config = RISK_CONFIG[patientRiskLevel];

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* ───────────── 그라데이션 헤더 카드 ─────────────
          [리뉴얼] 제목을 청록→블루 그라데이션 카드로 교체. */}
      <Card variant="gradient" padding="lg" className="mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
            <FileText className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="font-black text-white text-[1.8rem] leading-tight">건강 결과 보고서</h1>
            <p className="text-white/80 mt-1 font-bold text-small">
              사용자를 선택해 측정 결과와 위험도를 확인하세요.
            </p>
          </div>
        </div>
      </Card>

      {/* ───────────── 사용자 선택 탭 ─────────────
          [리뉴얼] 공통 <Card padding="none"> 로 감싸 모서리/그림자 통일.
          - 활성 탭 하단 강조선 색은 COLORS.primary(동적) → 인라인 유지. */}
      <Card padding="none" className="mb-6 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="text-gray-500 font-bold text-small">리포트를 볼 사용자를 선택하세요</p>
        </div>
        <div className="flex">
          {patients.map((p, i) => {
            const rl = LEVEL_MAP[p.risk_level ?? "low"] ?? "하";
            const c = RISK_CONFIG[rl];
            const active = selectedIdx === i;
            return (
              <button key={p.user_id}
                onClick={() => setSelectedIdx(i)}
                className={`flex-1 flex flex-col items-center gap-1 py-4 transition-all border-b-4 ${
                  active ? "" : "border-transparent hover:bg-gray-50"
                } ${i !== 0 ? "border-l border-gray-100" : ""}`}
                // 활성 탭: 연한 청록 배경 + 청록 하단선 (둘 다 토큰 색)
                style={{
                  minHeight: 80,
                  ...(active
                    ? { borderBottomColor: COLORS.primary, backgroundColor: COLORS.primarySoft }
                    : {}),
                }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-small"
                  style={{ backgroundColor: c.color }}>
                  {p.nickname[0]}
                </div>
                <span className="font-bold text-gray-800 text-small">{p.nickname}</span>
                <span className="px-2 py-0.5 rounded-full text-white font-bold"
                  style={{ backgroundColor: c.color, fontSize: "0.8rem" }}>
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      {/* ───────────── 이전/다음 네비게이션 ───────────── */}
      <div className="flex items-center justify-between mb-6">
        <button onClick={() => setSelectedIdx(i => Math.max(0, i - 1))} disabled={selectedIdx === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 font-bold transition-colors text-small">
          <ChevronLeft className="w-5 h-5" />이전
        </button>
        <span className="text-gray-500 font-bold text-small">
          {selectedIdx + 1} / {patients.length}
        </span>
        <button onClick={() => setSelectedIdx(i => Math.min(patients.length - 1, i + 1))} disabled={selectedIdx === patients.length - 1}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 font-bold transition-colors text-small">
          다음<ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* ───────────── 최근 측정 기록 3건 ─────────────
          [리뉴얼] 공통 <Card padding="none"> 로 통일. */}
      <Card padding="none" className="mb-6 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-400" />
          <p className="text-gray-700 font-bold text-small">최근 측정 기록</p>
        </div>
        {recordsLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
              style={{ borderColor: COLORS.primary, borderTopColor: "transparent" }} />
          </div>
        ) : records.length === 0 ? (
          <p className="text-gray-400 font-bold text-center py-8" style={{ fontSize: "0.95rem" }}>측정 기록이 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {records.map((r, i) => {
              const rc = RISK_CONFIG[r.riskLevel];
              return (
                <button key={r.id}
                  onClick={() => navigate(`/measurement/${r.id}`, { state: { patientUserId: patient.user_id } })}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
                  <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: rc.color }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-full text-white font-bold text-tiny"
                        style={{ backgroundColor: rc.color }}>
                        {rc.label} {r.riskScore}점
                      </span>
                      {/* '최신' 배지: 연한 청록(토큰 색)으로 통일 */}
                      {i === 0 && (
                        <span
                          className="px-2 py-0.5 rounded-full font-bold"
                          style={{ backgroundColor: COLORS.primarySoft, color: COLORS.primary, fontSize: "0.8rem" }}
                        >
                          최신
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-gray-400 mt-1 font-bold text-tiny">
                      <Clock className="w-3 h-3" />{r.date}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </Card>

      {/* ───────────── 위험도 배너 — 동적 색상이므로 인라인 유지 ───────────── */}
      <div className="rounded-2xl p-6 mb-6 border-2" style={{ backgroundColor: config.bg, borderColor: config.border }}>
        <div className="flex items-center gap-4 mb-4">
          <AlertTriangle className="w-10 h-10 flex-shrink-0" style={{ color: config.color }} />
          <div className="flex-1">
            <div style={{ color: config.color, fontSize: "1.8rem", fontWeight: 900 }}>
              위험도 {patientRiskLevel} — {config.label}
            </div>
            <div className="text-gray-600 font-bold mt-1 text-small">
              {patient.nickname}{patient.age != null ? ` (${patient.age}세)` : ""}
              {patient.latest_measured_at && ` · 최근 측정 ${toKSTDatetime(patient.latest_measured_at)}`}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div style={{ color: config.color, fontSize: "2.8rem", fontWeight: 900, lineHeight: 1 }}>{patient.risk_score ?? 0}</div>
            <div className="text-gray-400 font-bold text-small">/ 100점</div>
          </div>
        </div>
        <div className="w-full bg-white rounded-full h-4 overflow-hidden">
          <div className="h-4 rounded-full" style={{ width: `${patient.risk_score ?? 0}%`, backgroundColor: config.color }} />
        </div>
      </div>

      {/* ───────────── 일일 AI 리포트 보기 — 공통 Button(gradient) ─────────────
          [리뉴얼] primary → gradient 로 바꿔 헤더와 같은 청록→블루 톤 강조. */}
      <Button
        variant="gradient"
        size="lg"
        fullWidth
        onClick={handleGuardianReport}
        disabled={generating}
        loading={generating}
        icon={<Sparkles className="w-7 h-7" />}
        className="mb-3"
      >
        {generating ? "리포트 생성 중..." : "일일 AI 리포트 보기"}
      </Button>

      {/* 리포트 기록 보기 — 공통 Button(outline) */}
      <Button
        variant="outline"
        size="md"
        fullWidth
        onClick={() => navigate(`/guardian-report-history/${patient.user_id}`)}
        icon={<FileText className="w-5 h-5" />}
        className="mb-5"
      >
        리포트 기록 보기
      </Button>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-500 font-bold" style={{ fontSize: "0.95rem" }}>
        <Info className="w-4 h-4 inline mr-2 text-gray-400" />
        이 리포트는 참고용이며 의사의 진단을 대신하지 않습니다.
      </div>
    </div>
  );
}
