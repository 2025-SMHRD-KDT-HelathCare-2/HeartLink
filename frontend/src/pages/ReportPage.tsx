// ============================================================================
// 내 건강 결과(일일 리포트) 페이지
// - 최근 측정 7건 목록 + 위험도 배너 + 일일 AI 리포트/기록 보기 버튼
// - 리팩터링 포인트:
//   1) 하드코딩 색상(#DC2626 등) → tokens.ts 의 COLORS / RISK_COLOR 로 일원화
//   2) 반복 버튼/배지 → 공통 <Card>, <Button> 사용 (단, 동적 색상 영역은 인라인 유지)
//   3) 인라인 fontSize → 토큰 클래스(text-hero, text-sub 등) 우선, 없으면 임의값 유지
//   기능(데이터 조회, 선택 인덱스, 리포트 생성/네비게이션)은 100% 동일
// ============================================================================
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle, Info, Clock, Bell, Sparkles, FileText } from "lucide-react";
import api from "../api/authApi";
import { Card, Button } from "../components/ui";
import { COLORS } from "../styles/tokens";

type RiskLevel = "high" | "mid" | "low";

interface MeasurementItem {
  id: string;
  analysisId: string | null;
  riskLevel: "상" | "중" | "하";
  riskScore: number;
  date: string;
  status: string;
}

// 위험도별 메타데이터(색/배경/라벨/아이콘).
// 색 값은 더 이상 페이지에 하드코딩하지 않고 tokens.ts(COLORS)에서 가져온다.
const RISK_META = {
  상: { color: COLORS.danger,  bg: COLORS.dangerBg,  border: COLORS.dangerBorder,  label: "위험", icon: AlertTriangle },
  중: { color: COLORS.warning, bg: COLORS.warningBg, border: COLORS.warningBorder, label: "주의", icon: Info },
  하: { color: COLORS.safe,    bg: COLORS.safeBg,    border: COLORS.safeBorder,    label: "양호", icon: CheckCircle },
};

const LEVEL_MAP: Record<string, "상" | "중" | "하"> = { high: "상", mid: "중", low: "하" };
const MAX_LIST = 7;

function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${iso.slice(0, 10)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface DailyAlert { id: string; message: string; time: string; }

// ----------------------------------------------------------------------------
// 오늘의 위험(상) 알림 섹션 — 알림이 없으면 아무것도 렌더링하지 않는다.
// ----------------------------------------------------------------------------
function DailyAlertSection() {
  const [alerts, setAlerts] = useState<DailyAlert[]>([]);
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/notifications");
        const today = new Date().toISOString().slice(0, 10);
        const todays = (res.data || []).filter((n: any) =>
          n.level === "상" && (n.createdAt || "").slice(0, 10) === today
        );
        setAlerts(todays.map((n: any) => ({
          id: n._id, message: n.message, time: (n.createdAt || "").slice(11, 16),
        })));
      } catch { /* 알림 없으면 무시 */ }
    })();
  }, []);

  if (alerts.length === 0) return null;
  const danger = RISK_META.상; // 알림은 항상 '위험' 색상 기준
  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Bell className="w-6 h-6" style={{ color: danger.color }} />
        <h3 className="font-black text-sub" style={{ color: danger.color }}>오늘의 알림</h3>
      </div>
      {alerts.map(a => (
        // 동적 위험 색상이므로 배경/테두리는 인라인 style 유지(값은 토큰에서)
        <div key={a.id} className="border-2 rounded-2xl p-5 flex items-start gap-3 mb-3"
          style={{ backgroundColor: danger.bg, borderColor: danger.border }}>
          <AlertTriangle className="w-7 h-7 flex-shrink-0 mt-0.5" style={{ color: danger.color }} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-3 py-1 rounded-full text-white font-bold text-tiny" style={{ backgroundColor: danger.color }}>위험</span>
              <span className="text-gray-400 font-bold ml-auto text-tiny">{a.time}</span>
            </div>
            <p className="text-gray-700 font-bold leading-relaxed text-small">{a.message}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export function ReportPage() {
  const navigate = useNavigate();
  const [measurements, setMeasurements] = useState<MeasurementItem[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  // 완료된 측정만 최근 7건까지 매핑
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/measurements");
        const mapped: MeasurementItem[] = (res.data || [])
          .filter((m: any) => m.status === "completed")
          .map((m: any) => ({
            id: m._id,
            analysisId: m.analysis?._id ?? null,
            riskLevel: LEVEL_MAP[m.analysis?.riskLevel as RiskLevel] ?? "하",
            riskScore: m.analysis?.riskScore ?? 0,
            date: formatDate(m.measuredAt),
            status: m.status,
          }))
          .slice(0, MAX_LIST);
        setMeasurements(mapped);
      } catch (err) {
        console.error("측정 목록 조회 실패", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // 선택된 측정으로 일일 리포트 생성 후 상세 페이지로 이동
  const handleDailyReport = async () => {
    const item = measurements[Math.min(selectedIdx, measurements.length - 1)];
    if (!item?.analysisId) return;
    try {
      setGenerating(true);
      const res = await api.post("/reports/generate", {
        type: "daily",
        analysisId: item.analysisId,
        measurementId: item.id,
      });
      const reportId = res.data?._id;
      navigate("/report-detail", { state: { reportId, type: "daily" } });
    } catch (err) {
      console.error("리포트 생성 실패", err);
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-5 flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: COLORS.primary, borderTopColor: "transparent" }} />
      </div>
    );
  }

  const hasData = measurements.length > 0;
  const item = hasData ? measurements[Math.min(selectedIdx, measurements.length - 1)] : null;
  const meta = item ? RISK_META[item.riskLevel] : RISK_META["하"];
  const RiskIcon = meta.icon;

  return (
    <div className="max-w-2xl mx-auto p-5">
      <div className="mb-7">
        <h1 className="font-black text-primary text-hero">내 건강 결과</h1>
        <p className="text-gray-500 mt-1 font-bold text-body">인공지능이 분석한 오늘 심장 상태예요.</p>
      </div>

      <DailyAlertSection />

      {/* 측정 결과 목록 (최근 7개) */}
      {hasData && (
        <Card padding="none" className="mb-6 border-2 border-gray-100 overflow-hidden">
          <div className="p-5 border-b-2 border-gray-100">
            <h3 className="text-gray-800 font-black text-sub">최근 측정 목록</h3>
          </div>
          {measurements.map((m, i) => {
            const mm = RISK_META[m.riskLevel];
            return (
              <button key={m.id} onClick={() => setSelectedIdx(i)}
                className={`w-full flex items-center gap-4 p-5 text-left transition-colors border-b-2 border-gray-50 last:border-0 ${selectedIdx === i ? "bg-blue-50" : "hover:bg-gray-50"}`}
                style={{ minHeight: 80 }}>
                <div className="w-4 h-16 rounded-full shrink-0" style={{ backgroundColor: mm.color }} />
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    <span className="px-4 py-2 rounded-full text-white font-black text-body" style={{ backgroundColor: mm.color }}>
                      위험도 {m.riskLevel} — {mm.label}
                    </span>
                    <span className="text-gray-600 font-black text-[1.1rem]">{m.riskScore}점</span>
                  </div>
                  <p className="text-gray-500 mt-1 flex items-center gap-1 font-bold text-small">
                    <Clock className="w-4 h-4" />{m.date}
                  </p>
                </div>
              </button>
            );
          })}
        </Card>
      )}

      {/* 위험도 배너 — 동적 색상이므로 배경/테두리는 인라인 유지 */}
      {item && (
        <div className="rounded-2xl p-7 mb-5 border-4" style={{ backgroundColor: meta.bg, borderColor: meta.color }}>
          <div className="flex items-center gap-5 mb-5">
            <div className="rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: meta.color, width: 88, height: 88 }}>
              <RiskIcon className="text-white" style={{ width: 48, height: 48 }} />
            </div>
            <div className="flex-1">
              <div style={{ color: meta.color, fontSize: "2.2rem", fontWeight: 900, lineHeight: 1.1 }}>위험도 {item.riskLevel}</div>
              <div style={{ color: meta.color, fontSize: "1.6rem", fontWeight: 800 }}>{meta.label}</div>
            </div>
            <div className="text-right shrink-0">
              <div style={{ color: meta.color, fontSize: "3.5rem", fontWeight: 900, lineHeight: 1 }}>{item.riskScore}</div>
              <div className="text-gray-500 font-bold text-[1.1rem]">/ 100점</div>
            </div>
          </div>
          <div className="w-full bg-white/80 rounded-full mb-5 overflow-hidden" style={{ height: 20 }}>
            <div className="rounded-full h-full transition-all" style={{ width: `${item.riskScore}%`, backgroundColor: meta.color }} />
          </div>
        </div>
      )}

      {/* 일일 AI 리포트 보기 — 공통 Button(primary) 사용 */}
      <Button
        variant="primary"
        size="lg"
        fullWidth
        onClick={handleDailyReport}
        disabled={!hasData || !item?.analysisId || generating}
        icon={<Sparkles className="w-6 h-6" />}
        className="mb-3 shadow-lg"
      >
        {generating ? "리포트 생성 중..." : "일일 AI 리포트 보기"}
      </Button>

      {/* 리포트 기록 보기 — 공통 Button(outline) 사용 */}
      <Button
        variant="outline"
        size="md"
        fullWidth
        onClick={() => navigate("/report-history-list")}
        icon={<FileText className="w-5 h-5" />}
        className="mb-5"
      >
        리포트 기록 보기
      </Button>

      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-5 text-gray-500 leading-relaxed font-bold text-small">
        <Info className="w-5 h-5 inline mr-2 text-gray-400" />
        이 리포트는 참고용이며 의사의 진단을 대신하지 않습니다.
      </div>
    </div>
  );
}
