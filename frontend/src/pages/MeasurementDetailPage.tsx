// MeasurementDetailPage.tsx
// frontend/src/pages/MeasurementDetailPage.tsx
// =============================================================================
// 측정 상세 페이지 (위험도 배너 + ECG 파형 + 게이지 + 분석 수치)
//
// [이 화면이 하는 일]
//   - 한 번의 측정 결과를 자세히 보여줍니다.
//   - 위험도 배너 → ECG 파형 그래프 → 위험도 게이지 → 분석 수치 순서.
//   - 보호자가 환자 측정을 볼 때는 location.state.patientUserId 로 환자별 경로 조회.
//
// [디자인 리뉴얼 포인트 — 기능은 그대로, '겉모양'만 업그레이드]
//   1) 페이지 제목(뒤로가기 포함) → 청록→블루 그라데이션 헤더 카드
//      (헤더 안에서도 흰색 뒤로가기 버튼을 둬 다른 화면과 톤 일치)
//   2) 파형/분석 수치/안내 박스 → 공통 <Card> 로 통일
//   3) 색 값은 모두 공통 토큰(COLORS)에서 가져옴 (하드코딩 색 제거)
//   ※ 위험도별로 색이 바뀌는 배너/막대는 '동적 색상'이라 인라인 style 유지.
//   ※ 조회/매핑/계산 로직은 이전과 100% 동일합니다.
// =============================================================================

import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ChevronLeft, Activity, Heart, AlertTriangle, Clock } from "lucide-react";
import { toKSTDatetime } from "../utils/formatKST";
import api from "../api/authApi";
import { ECGChart } from "../components/charts/ECGChart";
import { RiskGauge } from "../components/charts/RiskGauge";
// 공통 UI: 카드(겉모양 통일용)
import { Card } from "../components/ui";
import { COLORS } from "../styles/tokens";

interface Analysis {
  riskScore: number;
  riskLevel: "high" | "mid" | "low";
  heartRate: number;
  arrhythmiaClass: string;
  arrhythmiaProb: number;
  afDetected: boolean;
  afProb: number;
  hrvRmssd: number;
  hrvSdnn: number;
  arrhythmiaCount: number;
  analyzedAt: string;
}

interface MeasurementDetail {
  _id: string;
  fileName: string;
  measuredAt: string;
  samplingRate: number;
  ecgWaveformLite: number[];
  rPeaks: number[];
  status: string;
  analysis: Analysis | null;
}

// 위험도 색상 → tokens.ts(COLORS)로 일원화
const RISK_META = {
  high: { label: "위험", color: COLORS.danger,  bg: COLORS.dangerBg,  border: COLORS.dangerBorder },
  mid:  { label: "주의", color: COLORS.warning, bg: COLORS.warningBg, border: COLORS.warningBorder },
  low:  { label: "양호", color: COLORS.safe,    bg: COLORS.safeBg,    border: COLORS.safeBorder },
};

const CLASS_LABEL: Record<string, string> = {
  N: "정상 (N)", SVEB: "상심실성 이소박동 (SVEB)",
  VEB: "심실성 이소박동 (VEB)", F: "융합박동 (F)", Q: "판별불가 (Q)",
};

export function MeasurementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const patientUserId = (location.state as any)?.patientUserId as string | undefined;
  const [data, setData] = useState<MeasurementDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const url = patientUserId
          ? `/measurements/patient/${patientUserId}/${id}`
          : `/measurements/${id}`;
        const res = await api.get(url);
        setData(res.data);
      } catch {
        setError("측정 데이터를 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    })();
  }, [id, patientUserId]);

  // 기본 샘플링 레이트 250Hz
  const sampleRate = data?.samplingRate || 250;

  const chartData = useMemo(() => {
    if (!data?.ecgWaveformLite?.length) return [];
    return data.ecgWaveformLite.map((y, i) => ({
      x: Math.round((i / sampleRate) * 1000) / 1000,
      y,
    }));
  }, [data, sampleRate]);

  const rPeakTimes = useMemo(() => {
    if (!data?.rPeaks?.length) return [];
    const maxIdx = data.ecgWaveformLite?.length || 0;
    const looksLikeIndex = data.rPeaks.every(v => Number.isInteger(v) && v <= maxIdx);
    if (looksLikeIndex) {
      return data.rPeaks.map(idx => Math.round((idx / sampleRate) * 1000) / 1000);
    }
    return data.rPeaks;
  }, [data, sampleRate]);

  // ── 로딩 ──
  if (loading) {
    return (
      <div className="max-w-3xl mx-auto p-6 flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: COLORS.primary, borderTopColor: "transparent" }} />
      </div>
    );
  }

  // ── 에러/데이터 없음 ──
  if (error || !data) {
    return (
      <div className="max-w-3xl mx-auto p-6">
        <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 font-bold mb-6">
          <ChevronLeft className="w-5 h-5" />뒤로가기
        </button>
        <Card padding="lg" className="text-center py-10">
          <p className="font-bold" style={{ color: COLORS.danger }}>{error || "데이터가 없습니다."}</p>
        </Card>
      </div>
    );
  }

  const analysis = data.analysis;
  const riskLevel = (analysis?.riskLevel ?? "low") as "high" | "mid" | "low";
  const meta = RISK_META[riskLevel];
  const measuredDate = toKSTDatetime(data.measuredAt ?? "");

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      {/* ───────────── 그라데이션 헤더 카드 ─────────────
          [리뉴얼] 제목/시간/뒤로가기를 청록→블루 그라데이션 카드로 묶음.
          - 뒤로가기 버튼은 흰색 반투명으로 헤더 위에서 잘 보이게. */}
      <Card variant="gradient" padding="lg">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/80 hover:text-white font-bold mb-3 text-small transition-colors"
        >
          <ChevronLeft className="w-5 h-5" />지난 기록으로
        </button>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center shrink-0">
            <Activity className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="font-black text-white text-[1.8rem] leading-tight">측정 상세</h1>
            <div className="flex items-center gap-2 text-white/80 font-bold mt-1 text-small">
              <Clock className="w-4 h-4" />{measuredDate}
            </div>
          </div>
        </div>
      </Card>

      {/* ───────────── 위험도 배너 — 동적 색상이므로 인라인 유지(값은 토큰) ───────────── */}
      {analysis && (
        <div className="rounded-2xl p-6 border-2" style={{ backgroundColor: meta.bg, borderColor: meta.border }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-8 h-8" style={{ color: meta.color }} />
              <div>
                <div style={{ color: meta.color, fontSize: "1.6rem", fontWeight: 900 }}>
                  위험도 {riskLevel === "high" ? "상" : riskLevel === "mid" ? "중" : "하"} — {meta.label}
                </div>
                <div className="text-gray-500 font-bold mt-0.5" style={{ fontSize: "0.95rem" }}>
                  {data.fileName}
                </div>
              </div>
            </div>
            <div className="text-right">
              <div style={{ color: meta.color, fontSize: "2.8rem", fontWeight: 900, lineHeight: 1 }}>
                {analysis.riskScore ?? 0}
              </div>
              <div className="text-gray-400 font-bold" style={{ fontSize: "0.95rem" }}>/ 100점</div>
            </div>
          </div>
          <div className="w-full bg-white/70 rounded-full h-3 mt-4 overflow-hidden">
            <div className="h-3 rounded-full transition-all"
              style={{ width: `${analysis.riskScore ?? 0}%`, backgroundColor: meta.color }} />
          </div>
        </div>
      )}

      {/* ───────────── ECG 파형 ───────────── */}
      {chartData.length > 0 ? (
        <div>
          <div className="text-gray-500 font-bold mb-2" style={{ fontSize: "0.95rem" }}>
            {chartData.length.toLocaleString()}개 샘플 · {sampleRate}Hz
          </div>
          <ECGChart data={chartData} rPeaks={rPeakTimes} zoom={1} sampleRate={sampleRate} />
        </div>
      ) : (
        // 파형 없음 → 공통 카드 빈 상태
        <Card padding="lg" className="text-center py-8">
          <Activity className="w-10 h-10 mx-auto text-gray-300 mb-2" />
          <p className="text-gray-400 font-bold text-small">파형 데이터가 없습니다.</p>
        </Card>
      )}

      {/* ───────────── 위험도 게이지 ───────────── */}
      {analysis?.riskScore != null && (
        <RiskGauge score={analysis.riskScore} riskLevel={riskLevel} />
      )}

      {/* ───────────── 분석 수치 — 공통 카드 ───────────── */}
      {analysis && (
        <Card padding="lg">
          <div className="flex items-center gap-2 mb-5">
            <Heart className="w-5 h-5 text-primary" />
            <h3 className="text-primary font-bold text-sub">분석 수치</h3>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="심박수" value={`${analysis.heartRate ?? 0} bpm`} />
            <StatCard label="부정맥 분류" value={CLASS_LABEL[analysis.arrhythmiaClass] ?? analysis.arrhythmiaClass ?? "—"} small />
            <StatCard label="부정맥 발생 횟수" value={`${analysis.arrhythmiaCount ?? 0}회`} />
            <StatCard
              label="심방세동 (AF)"
              value={analysis.afDetected ? `감지됨 (${(analysis.afProb * 100).toFixed(1)}%)` : "미감지"}
              highlight={analysis.afDetected}
            />
          </div>
        </Card>
      )}

      {/* ───────────── 안내 박스 ───────────── */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-500 font-bold" style={{ fontSize: "0.95rem" }}>
        이 결과는 참고용이며 의사의 진단을 대신하지 않습니다.
      </div>
    </div>
  );
}

// 분석 수치 카드 — highlight 시 위험(빨강), 평소엔 primary
function StatCard({ label, value, small, highlight }: {
  label: string; value: string; small?: boolean; highlight?: boolean;
}) {
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-gray-500 font-bold mb-1" style={{ fontSize: "0.9rem" }}>{label}</p>
      <p className="font-black"
        style={{ fontSize: small ? "0.9rem" : "1.15rem", color: highlight ? COLORS.danger : COLORS.primary }}>
        {value}
      </p>
    </div>
  );
}
