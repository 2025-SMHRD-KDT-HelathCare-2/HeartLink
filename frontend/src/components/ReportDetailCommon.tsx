// ReportDetailCommon.tsx
// frontend/src/pages/ReportDetailCommon.tsx
// =============================================================================
// 사용자/보호자 공통 리포트 상세 페이지 (일간/주간 분기)
//
// [이 화면이 하는 일]
//   - 일간/주간 AI 리포트를 보여줍니다. (mode 로 사용자/보호자 구분)
//   - TTS(음성 듣기) 재생/속도 조절, 위험도 게이지, LLM 텍스트, 차트, PDF 저장.
//
// [디자인 리뉴얼 포인트 — 기능은 그대로, '겉모양'만 업그레이드]
//   1) 상단 고정 헤더: 단색(primary) → 청록→블루 그라데이션(GRADIENTS.brand)
//   2) TTS/위험도 게이지/일·주간 통계칸 → 공통 <Card> 로 통일
//   3) PDF 저장 버튼 → 공통 <Button variant="gradient">
//   4) 하드코딩 색(bg-red-50/green-50 등) → 토큰 색(COLORS)으로 교체
//   ※ 위험도별로 색이 바뀌는 게이지/LLM 배너는 '동적 색상'이라 인라인 유지.
//   ※ 조회/폴링/TTS/PDF 로직은 이전과 100% 동일합니다.
// =============================================================================

import { useState, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  ChevronLeft, Volume2, StopCircle, AlertTriangle, Info,
  CalendarDays, BarChart2, Download
} from "lucide-react";
import api from "../api/authApi";
import {
  HourlyHeartRateChart, RiskTimelineChart, ArrhythmiaDonutChart,
  WeeklyHeartRateChart, WeeklyRiskDistributionChart, HRVTrendChart
} from "./charts/ReportCharts";
// 공통 UI: 카드 + 버튼(겉모양 통일용)
import { Card, Button } from "../components/ui";
import { COLORS, GRADIENTS } from "../styles/tokens";
import styles from "./ReportDetailCommon.module.css"; // TTS 슬라이더 스타일 분리

type ReportType = "daily" | "weekly";

interface DailyReportData {
  type: "daily";
  memberName?: string;
  date: string;
  riskScore: number;
  riskLevel: "상" | "중" | "하";
  reportText: string;
  measurementCount: number;
  maxHeartRate: number;
  avgHeartRate: number;
  minHeartRate: number;
  afDetected: boolean;
  hourlyHeartRate: Array<{ time: string; bpm: number; riskLevel?: string }>;
  arrhythmiaByType: Array<{ type: string; count: number }>;
}

interface WeeklyReportData {
  type: "weekly";
  memberName?: string;
  startDate: string;
  endDate: string;
  riskScore: number;
  riskLevel: "상" | "중" | "하";
  reportText: string;
  afDays: number;
  totalArrhythmiaCount: number;
  measurementDays: number;
  dailyStats: Array<{ day: string; avgBpm: number; riskLevel: string; low: number; mid: number; high: number }>;
  hrvTrend: Array<{ day: string; rmssd: number; sdnn: number }>;
}

type ReportData = DailyReportData | WeeklyReportData;

// 위험도 색상은 tokens.ts(COLORS)에서 가져와 일원화
const RISK_CONFIG = {
  상: { color: COLORS.danger,  label: "위험", bg: COLORS.dangerBg,  border: COLORS.dangerBorder },
  중: { color: COLORS.warning, label: "주의", bg: COLORS.warningBg, border: COLORS.warningBorder },
  하: { color: COLORS.safe,    label: "양호", bg: COLORS.safeBg,    border: COLORS.safeBorder },
};

const LEVEL_MAP: Record<string, "상" | "중" | "하"> = { high: "상", mid: "중", low: "하" };

const TTS_SPEEDS = [
  { label: "느리게", idx: 0 },
  { label: "보통", idx: 1 },
  { label: "빠르게", idx: 2 },
];

interface ReportDetailPageProps {
  mode: "user" | "guardian";
  memberId?: string;
}

export function ReportDetailPage({ mode, memberId }: ReportDetailPageProps) {
  const navigate = useNavigate();
  // ── URL 주소에서 직접 값을 꺼냅니다. ──────────────────────────────
  // 사용자 경로:  /report-detail/:type/:id          → type, id 가 채워짐
  // 보호자 경로:  /guardian-report-detail/:userId/:type/:id
  //             → userId, type, id 가 채워짐 (userId 는 아래 memberId 로 사용)
  const params = useParams();
  const reportId = params.id;                                  // 주소의 :id
  const type: ReportType = (params.type as ReportType) ?? "daily"; // 주소의 :type

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  // 리포트 조회 + (생성 중이면) 텍스트 폴링
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const endpoint = mode === "guardian"
          ? (reportId
              ? `/reports/patient/${memberId}/${reportId}`
              : `/reports/guardian/${memberId}?type=${type}`)
          : `/reports/${reportId}`;
        const res = await api.get(endpoint);
        const r = res.data;
        if (!cancelled) {
          setReport({ ...r, riskLevel: LEVEL_MAP[r.riskLevel] ?? "하" });
          if (r.reportStatus === "generating" && mode === "user" && reportId) {
            pollReportText(reportId, r);
          }
        }
      } catch (err) {
        console.error("리포트 조회 실패", err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reportId, type, memberId, mode]);

  const pollReportText = async (id: string, _base: ReportData) => {
    for (let i = 0; i < 20; i++) {
      await new Promise(r => setTimeout(r, 3000));
      try {
        const res = await api.get(`/reports/${id}`);
        const r = res.data;
        if (r.reportStatus === "completed" || r.reportStatus === "failed") {
          setReport(prev => prev ? { ...prev, reportText: r.reportText ?? "" } : prev);
          return;
        }
      } catch { return; }
    }
  };

  const config = report ? RISK_CONFIG[report.riskLevel] : RISK_CONFIG.하;
  const typeLabel = type === "daily" ? "일간" : "주간";

  // ===== TTS 재생 제어 =====
  const stopTTS = () => { audioRef.current?.pause(); setPlaying(false); };
  const playTTS = async (speed: number) => {
    if (mode === "guardian" ? !memberId : !reportId) return;
    try {
      stopTTS(); setTtsLoading(true);
      const ttsUrl = mode === "guardian"
        ? `/reports/guardian/${memberId}/tts`
        : `/reports/${reportId}/tts`;
      const res = await api.get(ttsUrl, { params: { speed }, responseType: "blob" });
      const url = URL.createObjectURL(res.data);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => setPlaying(true);
      audio.onended = () => setPlaying(false);
      audio.onerror = () => setPlaying(false);
      await audio.play();
    } catch (err) { console.error("TTS 재생 실패", err); }
    finally { setTtsLoading(false); }
  };
  const handleTTS = () => { if (playing) stopTTS(); else playTTS(speedIdx); };
  const handleSpeedChange = (idx: number) => { setSpeedIdx(idx); if (playing) playTTS(idx); };
  useEffect(() => () => { audioRef.current?.pause(); }, []);

  // ===== PDF 저장 =====
  const handleSavePdf = async () => {
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import("html2canvas"),
    import("jspdf"),
  ]);

    if (!captureRef.current || !report) return;
    try {
      setGeneratingPdf(true);
      const canvas = await html2canvas(captureRef.current, { scale: 2, backgroundColor: COLORS.appBg });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      const name = mode === "guardian" && report.memberName ? report.memberName : "내";
      pdf.save(`${name}_${typeLabel}리포트_${type === "daily" ? (report as DailyReportData).date : (report as WeeklyReportData).startDate}.pdf`);
    } catch (err) { console.error("PDF 생성 실패", err); }
    finally { setGeneratingPdf(false); }
  };

  // ── 로딩 ──
  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-t-transparent rounded-full animate-spin"
          style={{ borderColor: COLORS.primary, borderTopColor: "transparent" }} />
        <p className="text-gray-500 font-bold text-[1.1rem]">리포트를 불러오고 있어요...</p>
      </div>
    </div>
  );

  // ── 데이터 없음 ──
  if (!report) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <p className="text-gray-500 font-bold">리포트를 불러올 수 없습니다.</p>
    </div>
  );

  const title = mode === "guardian" && report.memberName
    ? `${report.memberName} ${typeLabel} 리포트`
    : `${typeLabel} AI 리포트`;

  // 게이지 높이 (px) — 마커 수직 정렬 기준
  const GAUGE_H = 28;

  return (
    <div className="min-h-screen" style={{ backgroundColor: COLORS.appBg }}>
      {/* ───────────── 상단 고정 헤더 ─────────────
          [리뉴얼] 단색(primary) → 청록→블루 그라데이션 + 부드러운 그림자. */}
      <header
        className="text-white px-5 py-4 flex items-center gap-3 sticky top-0 z-20"
        style={{
          background: GRADIENTS.brand,
          boxShadow: "0 4px 16px rgba(13, 148, 136, 0.25)",
        }}
      >
        <button
          onClick={() => {
            // window.history.state.idx 가 0보다 크면 "앱 안에서 이동해 온" 상태라
            // 안전하게 뒤로 갈 수 있습니다. 0이거나 없으면 외부/직접 진입이므로 홈으로.
            if (window.history.state && window.history.state.idx > 0) {
              navigate(-1);
            } else {
              navigate("/"); // 사용자 홈으로 안전 복귀
            }
          }}
          className="p-2 rounded-xl hover:bg-white/15 transition-colors"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          {type === "daily" ? <CalendarDays className="w-5 h-5" /> : <BarChart2 className="w-5 h-5" />}
          <div>
            <div className="font-black text-sub">{title}</div>
            <div className="text-white/70 font-bold text-tiny">음성으로 들어보세요</div>
          </div>
        </div>
      </header>

      <div ref={captureRef} className="max-w-2xl mx-auto p-5 space-y-5">

        {/* ===== TTS ===== */}
        <Card padding="lg">
          <button onClick={handleTTS} disabled={ttsLoading}
            className="w-full flex items-center justify-center gap-3 py-5 rounded-xl border-2 transition-all font-black mb-4 disabled:opacity-50"
            style={{
              minHeight: 72, fontSize: "1.3rem",
              // 재생 중: 연한 빨강(토큰) / 평소: 청록 테두리(토큰)
              ...(playing
                ? { backgroundColor: COLORS.dangerBg, borderColor: COLORS.danger, color: COLORS.danger }
                : { borderColor: COLORS.primary, color: COLORS.primary }),
            }}>
            {ttsLoading ? "준비 중..." : playing
              ? <><StopCircle className="w-8 h-8" />멈추기</>
              : <><Volume2 className="w-8 h-8" />🔊 {typeLabel} 리포트 듣기</>}
          </button>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 font-bold text-small">읽는 속도</span>
              <span className="font-black text-small" style={{ color: COLORS.primary }}>{TTS_SPEEDS[speedIdx].label}</span>
            </div>
            {/* TTS 슬라이더: thumb 스타일은 CSS Module(styles.ttsSlider)로 분리 */}
            <input type="range" min={0} max={2} step={1} value={speedIdx}
              onChange={e => handleSpeedChange(Number(e.target.value))}
              className={`w-full h-3 rounded-full appearance-none cursor-pointer ${styles.ttsSlider}`} />
            <div className="flex justify-between mt-1 px-1">
              {TTS_SPEEDS.map((s, i) => (
                <span key={s.label} className="font-bold text-tiny"
                  style={{ color: i === speedIdx ? COLORS.primary : "#9CA3AF" }}>
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        </Card>

        {/* ===== 위험도 가로 바 ===== */}
        <Card padding="lg">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sub" style={{ color: COLORS.primary }}>위험도 평가</h3>
            <div className="flex items-baseline gap-2">
              <span style={{ color: config.color, fontSize: "2.2rem", fontWeight: 900, lineHeight: 1 }}>{report.riskScore}</span>
              <span className="text-gray-400 font-bold text-small">/ 100점</span>
            </div>
          </div>

          {/* 게이지 + 마커 */}
          <div className="relative" style={{ height: GAUGE_H }}>
            <div className="flex rounded-full overflow-hidden w-full" style={{ height: GAUGE_H }}>
              <div className="flex-1" style={{ backgroundColor: COLORS.safe }} />
              <div className="flex-1" style={{ backgroundColor: COLORS.warning }} />
              <div className="flex-1" style={{ backgroundColor: COLORS.danger }} />
            </div>
            <div className="absolute top-0 flex items-center justify-center"
              style={{ left: `calc(${report.riskScore}% - ${GAUGE_H / 2}px)`, width: GAUGE_H, height: GAUGE_H }}>
              <div className="rounded-full bg-white shadow-lg"
                style={{ width: GAUGE_H - 6, height: GAUGE_H - 6, border: `4px solid ${config.color}` }} />
            </div>
          </div>

          {/* 점수 레이블 */}
          <div className="relative mt-1" style={{ height: 24 }}>
            <span className="absolute font-black whitespace-nowrap text-tiny"
              style={{ left: `calc(${report.riskScore}% - 16px)`, color: config.color, top: 2 }}>
              ▲ {report.riskScore}점
            </span>
          </div>

          {/* 눈금 */}
          <div className="flex justify-between text-gray-300 font-bold mt-1 px-1" style={{ fontSize: "0.8rem" }}>
            <span>0</span><span>33</span><span>66</span><span>100</span>
          </div>

          <div className="mt-4 text-center">
            <span className="px-5 py-2 rounded-full text-white font-bold inline-block text-body" style={{ backgroundColor: config.color }}>
              위험도 {report.riskLevel} — {config.label}
            </span>
          </div>
        </Card>

        {/* ===== LLM 텍스트 — 동적 색상이므로 인라인 유지(값은 토큰) ===== */}
        <div className="rounded-2xl p-6 border-2" style={{ backgroundColor: config.bg, borderColor: config.border }}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: config.color }} />
            <p className="text-gray-700 leading-relaxed font-bold text-body">{report.reportText}</p>
          </div>
        </div>

        {/* ===== 일간 차트 ===== */}
        {report.type === "daily" && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "최대 심박수", value: `${report.maxHeartRate}`, unit: "BPM", color: COLORS.danger },
                { label: "평균 심박수", value: `${report.avgHeartRate}`, unit: "BPM", color: COLORS.primary },
                { label: "최소 심박수", value: `${report.minHeartRate}`, unit: "BPM", color: COLORS.safe },
              ].map(s => (
                <Card key={s.label} padding="md" className="text-center">
                  <div className="font-black text-sub" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-gray-400 font-bold" style={{ fontSize: "0.75rem" }}>{s.unit}</div>
                  <div className="text-gray-500 font-bold mt-1" style={{ fontSize: "0.8rem" }}>{s.label}</div>
                </Card>
              ))}
            </div>
            {/* AF 감지 배너 — 감지/미감지에 따라 토큰 색 인라인 적용 */}
            <div
              className="rounded-2xl p-4 border-2 flex items-center gap-3"
              style={
                report.afDetected
                  ? { backgroundColor: COLORS.dangerBg, borderColor: COLORS.dangerBorder }
                  : { backgroundColor: COLORS.safeBg, borderColor: COLORS.safeBorder }
              }
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: report.afDetected ? COLORS.danger : COLORS.safe }}
              />
              <span
                className="font-bold text-small"
                style={{ color: report.afDetected ? COLORS.danger : COLORS.safe }}
              >
                심방세동(AF) {report.afDetected ? "감지됨" : "감지 안 됨"} · 오늘 {report.measurementCount}회 측정
              </span>
            </div>
            <HourlyHeartRateChart data={report.hourlyHeartRate} />
            <RiskTimelineChart data={report.hourlyHeartRate as Array<{ time: string; bpm: number; riskLevel: string }>} />
            <ArrhythmiaDonutChart data={report.arrhythmiaByType} />
          </>
        )}

        {/* ===== 주간 차트 ===== */}
        {report.type === "weekly" && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "AF 발생 일수", value: `${report.afDays}일`, color: COLORS.danger },
                { label: "총 부정맥", value: `${report.totalArrhythmiaCount}건`, color: COLORS.warning },
                { label: "측정 일수", value: `${report.measurementDays}일`, color: COLORS.primary },
              ].map(s => (
                <Card key={s.label} padding="md" className="text-center">
                  <div className="font-black text-sub" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-gray-500 font-bold mt-1" style={{ fontSize: "0.8rem" }}>{s.label}</div>
                </Card>
              ))}
            </div>
            <WeeklyHeartRateChart data={report.dailyStats} />
            <WeeklyRiskDistributionChart data={report.dailyStats} />
            <HRVTrendChart data={report.hrvTrend} />
          </>
        )}

        {/* ===== 안내 ===== */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-500 font-bold" style={{ fontSize: "0.95rem" }}>
          <Info className="w-4 h-4 inline mr-2 text-gray-400" />
          이 리포트는 참고용이며 의사의 진단을 대신하지 않습니다.
        </div>
        <p className="text-gray-400 font-bold text-center text-tiny" style={{ whiteSpace: "pre-line" }}>
          {"측정 시점, 횟수, 빈도에 따라\n결과는 달라질 수 있습니다."}
        </p>

        {/* ===== PDF 저장 — 공통 Button(gradient) ===== */}
        <Button
          variant="gradient"
          size="lg"
          fullWidth
          onClick={handleSavePdf}
          disabled={generatingPdf}
          loading={generatingPdf}
          icon={<Download className="w-6 h-6" />}
        >
          {generatingPdf ? "저장 중..." : "PDF 저장"}
        </Button>
      </div>
    </div>
  );
}
