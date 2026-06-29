// ============================================================================
// 내 건강 결과(일일 리포트) 페이지  ※ 디자인 리뉴얼 버전
// ----------------------------------------------------------------------------
// [화면 구성]
//   1) 상단 그라데이션 헤더 배너 (인사말 + 안내 문구)
//   2) 오늘의 위험(상) 알림 섹션 (알림 있을 때만)
//   3) 선택된 측정의 "위험도 스코어" 카드 (도넛 게이지 + 등급)
//   4) 최근 측정 목록 (카드형, 클릭해서 선택)
//   5) 일일 AI 리포트 보기 / 리포트 기록 보기 버튼
//   6) 참고용 안내 문구
//
// [중요] 데이터 로직(측정 7건 조회, 선택 인덱스, 리포트 생성/이동)은
//        기존과 100% 동일하다. 바뀐 것은 "보이는 모양(디자인)"뿐이다.
//
// [디자인 토큰]
//   - 색상: COLORS (tokens.ts)  / 그라데이션·그림자: index.css @theme 유틸
//   - 공통 컴포넌트: <Card>, <Button>, <DonutGauge>
// ============================================================================
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, CheckCircle, Info, Clock, Bell, Sparkles, FileText } from "lucide-react";
import api from "../api/authApi";
import { Card, Button, DonutGauge } from "../components/ui";
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

// 위험도별 메타데이터(색/배경/라벨/아이콘). 색은 모두 tokens.ts 에서 가져온다.
const RISK_META = {
  상: { color: COLORS.danger,  bg: COLORS.dangerBg,  border: COLORS.dangerBorder,  label: "위험", icon: AlertTriangle },
  중: { color: COLORS.warning, bg: COLORS.warningBg, border: COLORS.warningBorder, label: "주의", icon: Info },
  하: { color: COLORS.safe,    bg: COLORS.safeBg,    border: COLORS.safeBorder,    label: "양호", icon: CheckCircle },
};

const LEVEL_MAP: Record<string, "상" | "중" | "하"> = { high: "상", mid: "중", low: "하" };
const MAX_LIST = 7;

// ISO 문자열을 "YYYY-MM-DD HH:mm" 형태로 변환
function formatDate(iso: string) {
  if (!iso) return "";
  const d = new Date(iso);
  return `${iso.slice(0, 10)} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

interface DailyAlert { id: string; message: string; time: string; }

// ----------------------------------------------------------------------------
// 오늘의 위험(상) 알림 섹션 — 알림이 없으면 아무것도 렌더링하지 않는다.
// (로직은 기존과 동일, 카드 모양만 살짝 다듬음)
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
        // 동적 위험 색상이라 배경/테두리는 인라인 style 유지(값은 토큰에서)
        <div key={a.id}
          className="border-2 rounded-2xl p-5 flex items-start gap-3 mb-3 shadow-card"
          style={{ backgroundColor: danger.bg, borderColor: danger.border }}>
          <AlertTriangle className="w-7 h-7 flex-shrink-0 mt-0.5" style={{ color: danger.color }} />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-3 py-1 rounded-full text-white font-bold text-tiny"
                style={{ backgroundColor: danger.color }}>위험</span>
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

  // 완료된 측정만 최근 7건까지 매핑 (기존 로직 동일)
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

  // 선택된 측정으로 일일 리포트 생성 후 상세 페이지로 이동 (기존 로직 동일)
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
      navigate(`/report-detail/daily/${reportId}`);
    } catch (err) {
      console.error("리포트 생성 실패", err);
    } finally {
      setGenerating(false);
    }
  };

  // ── 로딩 화면 ──
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

      {/* ──────────────────────────────────────────────────────────────
          1) 상단 그라데이션 헤더 배너
             - 이미지의 "Good morning, John" 같은 인사말 영역
             - Card variant="gradient" 로 청록→블루 배경 + 흰 글씨
        ────────────────────────────────────────────────────────────── */}
      <Card variant="gradient" padding="lg" className="mb-6">
        <h1 className="font-black text-hero leading-tight">내 건강 결과</h1>
        <p className="mt-1 font-bold text-body opacity-90">
          인공지능이 분석한 오늘 심장 상태예요.
        </p>
      </Card>

      {/* 2) 오늘의 위험 알림 (있을 때만) */}
      <DailyAlertSection />

      {/* ──────────────────────────────────────────────────────────────
          3) 선택된 측정의 위험도 스코어 카드 (도넛 게이지)
             - 왼쪽: 점수 도넛 게이지 / 오른쪽: 등급·라벨·아이콘
             - 게이지 색은 위험 등급에 따라 동적으로 바뀜
        ────────────────────────────────────────────────────────────── */}
      {item && (
        <Card padding="lg" className="mb-6 flex items-center gap-6">
          {/* 점수 도넛 게이지 (값/색은 선택된 측정 기준) */}
          <DonutGauge
            value={item.riskScore}
            max={100}
            size={130}
            stroke={14}
            color={meta.color}
            label="점"
          />

          {/* 등급/라벨/상태 아이콘 */}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="rounded-full flex items-center justify-center shrink-0"
                style={{ backgroundColor: meta.color, width: 44, height: 44 }}>
                <RiskIcon className="text-white" style={{ width: 26, height: 26 }} />
              </div>
              <div>
                <div className="font-black text-title leading-none" style={{ color: meta.color }}>
                  위험도 {item.riskLevel}
                </div>
                <div className="font-bold text-body" style={{ color: meta.color }}>
                  {meta.label}
                </div>
              </div>
            </div>

            {/* 점수 진행 막대 */}
            <div className="w-full rounded-full overflow-hidden mt-3"
              style={{ height: 14, backgroundColor: COLORS.subtleBg }}>
              <div className="rounded-full h-full transition-all"
                style={{ width: `${item.riskScore}%`, backgroundColor: meta.color }} />
            </div>
            <p className="text-gray-400 font-bold text-tiny mt-2">100점 만점 기준</p>
          </div>
        </Card>
      )}

      {/* ──────────────────────────────────────────────────────────────
          4) 최근 측정 목록 (카드형)
             - 항목 클릭 시 selectedIdx 변경 → 위 스코어 카드가 갱신됨
             - 선택된 항목은 옅은 청록 배경으로 표시
        ────────────────────────────────────────────────────────────── */}
      {hasData && (
        <Card padding="none" className="mb-6 overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h3 className="text-gray-800 font-black text-sub">최근 측정 목록</h3>
          </div>
          {measurements.map((m, i) => {
            const mm = RISK_META[m.riskLevel];
            const selected = selectedIdx === i;
            return (
              <button key={m.id} onClick={() => setSelectedIdx(i)}
                className="w-full flex items-center gap-4 p-5 text-left transition-colors border-b border-gray-50 last:border-0"
                style={{
                  minHeight: 80,
                  backgroundColor: selected ? COLORS.primarySoft : "transparent",
                }}>
                {/* 왼쪽 색 막대 (위험 등급 색) */}
                <div className="w-3 h-14 rounded-full shrink-0" style={{ backgroundColor: mm.color }} />
                <div className="flex-1">
                  <div className="flex items-center gap-3 flex-wrap mb-1">
                    {/* 등급 알약 뱃지 */}
                    <span className="px-4 py-1.5 rounded-full text-white font-black text-small"
                      style={{ backgroundColor: mm.color }}>
                      위험도 {m.riskLevel} · {mm.label}
                    </span>
                    <span className="text-gray-600 font-black text-body">{m.riskScore}점</span>
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

      {/* ──────────────────────────────────────────────────────────────
          5) 액션 버튼들
             - 일일 AI 리포트 보기: 가장 강조 → gradient 버튼
             - 리포트 기록 보기: 보조 → outline 버튼
        ────────────────────────────────────────────────────────────── */}
      <Button
        variant="gradient"
        size="lg"
        fullWidth
        onClick={handleDailyReport}
        disabled={!hasData || !item?.analysisId || generating}
        loading={generating}
        icon={!generating ? <Sparkles className="w-6 h-6" /> : undefined}
        className="mb-3"
      >
        {generating ? "리포트 생성 중..." : "일일 AI 리포트 보기"}
      </Button>

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

      {/* 6) 참고용 안내 문구 */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-gray-500 leading-relaxed font-bold text-small">
        <Info className="w-5 h-5 inline mr-2 text-gray-400" />
        이 리포트는 참고용이며 의사의 진단을 대신하지 않습니다.
      </div>
    </div>
  );
}
