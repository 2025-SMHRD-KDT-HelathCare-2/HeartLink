// 사용자/보호자 공통 리포트 상세 페이지 (일간/주간 분기)
import { useState, useRef, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ChevronLeft, Volume2, StopCircle, AlertTriangle, Info,
  CalendarDays, BarChart2, Download
} from "lucide-react";
import api from "../api/authApi";
import jsPDF from "jspdf";
import html2canvas from "html2canvas-pro";
import {
  HourlyHeartRateChart, RiskTimelineChart, ArrhythmiaDonutChart,
  WeeklyHeartRateChart, WeeklyRiskDistributionChart, HRVTrendChart
} from "../components/charts/ReportCharts";

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

const RISK_CONFIG = {
  상: { color: "#DC2626", label: "위험", bg: "#FEF2F2", border: "#FECACA" },
  중: { color: "#D97706", label: "주의", bg: "#FFFBEB", border: "#FDE68A" },
  하: { color: "#16A34A", label: "양호", bg: "#F0FDF4", border: "#BBF7D0" },
};

const LEVEL_MAP: Record<string, "상" | "중" | "하"> = { high: "상", mid: "중", low: "하" };

const TTS_SPEEDS = [
  { label: "느리게", idx: 0 },
  { label: "보통", idx: 1 },
  { label: "빠르게", idx: 2 },
];

const DUMMY_DAILY: DailyReportData = {
  type: "daily",
  date: new Date().toISOString().slice(0, 10),
  riskScore: 72,
  riskLevel: "상",
  reportText: "오늘 심장이 평소보다 불규칙하게 뛰었어요. 오전에 불규칙한 박동이 감지되었습니다. 오늘은 무리하지 마시고 충분히 쉬어 주세요.",
  measurementCount: 3,
  maxHeartRate: 118,
  avgHeartRate: 88,
  minHeartRate: 62,
  afDetected: true,
  hourlyHeartRate: [
    { time: "06:00", bpm: 68, riskLevel: "low" },
    { time: "08:00", bpm: 92, riskLevel: "mid" },
    { time: "10:00", bpm: 118, riskLevel: "high" },
    { time: "12:00", bpm: 85, riskLevel: "mid" },
    { time: "14:00", bpm: 78, riskLevel: "low" },
    { time: "16:00", bpm: 82, riskLevel: "mid" },
    { time: "18:00", bpm: 95, riskLevel: "mid" },
    { time: "20:00", bpm: 72, riskLevel: "low" },
    { time: "22:00", bpm: 65, riskLevel: "low" },
  ],
  arrhythmiaByType: [
    { type: "N (정상)", count: 420 },
    { type: "SVEB", count: 12 },
    { type: "VEB", count: 8 },
    { type: "F", count: 3 },
    { type: "Q", count: 1 },
  ],
};

const DUMMY_WEEKLY: WeeklyReportData = {
  type: "weekly",
  startDate: "2026-06-10",
  endDate: "2026-06-16",
  riskScore: 55,
  riskLevel: "중",
  reportText: "이번 주 심장 상태를 분석했어요. 화요일과 목요일에 심장 박동이 다소 빨랐고, 금요일에 가장 안정적이었습니다. 꾸준한 측정을 유지해 주세요.",
  afDays: 2,
  totalArrhythmiaCount: 24,
  measurementDays: 5,
  dailyStats: [
    { day: "월", avgBpm: 75, riskLevel: "low", low: 70, mid: 20, high: 10 },
    { day: "화", avgBpm: 95, riskLevel: "high", low: 30, mid: 40, high: 30 },
    { day: "수", avgBpm: 82, riskLevel: "mid", low: 50, mid: 35, high: 15 },
    { day: "목", avgBpm: 88, riskLevel: "mid", low: 45, mid: 40, high: 15 },
    { day: "금", avgBpm: 70, riskLevel: "low", low: 80, mid: 15, high: 5 },
    { day: "토", avgBpm: 78, riskLevel: "low", low: 65, mid: 25, high: 10 },
    { day: "일", avgBpm: 85, riskLevel: "mid", low: 40, mid: 45, high: 15 },
  ],
  hrvTrend: [
    { day: "월", rmssd: 42, sdnn: 55 },
    { day: "화", rmssd: 28, sdnn: 38 },
    { day: "수", rmssd: 35, sdnn: 45 },
    { day: "목", rmssd: 32, sdnn: 42 },
    { day: "금", rmssd: 48, sdnn: 62 },
    { day: "토", rmssd: 40, sdnn: 52 },
    { day: "일", rmssd: 38, sdnn: 50 },
  ],
};

interface ReportDetailPageProps {
  mode: "user" | "guardian";
  memberId?: string;
}

export function ReportDetailPage({ mode, memberId }: ReportDetailPageProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const reportId = (location.state as any)?.reportId;
  const type: ReportType = (location.state as any)?.type ?? "daily";

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [speedIdx, setSpeedIdx] = useState(1);
  const [playing, setPlaying] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const captureRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const endpoint = mode === "guardian"
          ? `/reports/guardian/${memberId}?type=${type}`
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

  const pollReportText = async (id: string, base: ReportData) => {
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

  const handleSavePdf = async () => {
    if (!captureRef.current || !report) return;
    try {
      setGeneratingPdf(true);
      const canvas = await html2canvas(captureRef.current, { scale: 2, backgroundColor: "#F4F7FA" });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ unit: "px", format: [canvas.width, canvas.height] });
      pdf.addImage(imgData, "PNG", 0, 0, canvas.width, canvas.height);
      const name = mode === "guardian" && report.memberName ? report.memberName : "내";
      pdf.save(`${name}_${typeLabel}리포트_${type === "daily" ? (report as DailyReportData).date : (report as WeeklyReportData).startDate}.pdf`);
    } catch (err) { console.error("PDF 생성 실패", err); }
    finally { setGeneratingPdf(false); }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-4">
        <div className="w-10 h-10 border-4 border-[#0E8080] border-t-transparent rounded-full animate-spin" />
        <p className="text-gray-500 font-bold" style={{ fontSize: "1.1rem" }}>리포트를 불러오고 있어요...</p>
      </div>
    </div>
  );

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
    <div className="min-h-screen bg-[#F4F7FA]">
      <header className="bg-[#0A2647] text-white px-5 py-4 flex items-center gap-3 sticky top-0 z-20 shadow-lg">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex items-center gap-2">
          {type === "daily" ? <CalendarDays className="w-5 h-5" /> : <BarChart2 className="w-5 h-5" />}
          <div>
            <div className="font-black" style={{ fontSize: "1.3rem" }}>{title}</div>
            <div className="text-white/60 font-bold" style={{ fontSize: "0.9rem" }}>음성으로 들어보세요</div>
          </div>
        </div>
      </header>

      <div ref={captureRef} className="max-w-2xl mx-auto p-5 space-y-5">

        {/* TTS */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <button onClick={handleTTS} disabled={ttsLoading}
            className={`w-full flex items-center justify-center gap-3 py-5 rounded-xl border-2 transition-all font-black mb-4 disabled:opacity-50 ${
              playing ? "bg-red-50 border-red-400 text-red-600" : "bg-white border-[#0A2647] text-[#0A2647] hover:bg-[#0A2647] hover:text-white"
            }`} style={{ minHeight: 72, fontSize: "1.3rem" }}>
            {ttsLoading ? "준비 중..." : playing
              ? <><StopCircle className="w-8 h-8" />멈추기</>
              : <><Volume2 className="w-8 h-8" />🔊 {typeLabel} 리포트 듣기</>}
          </button>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>읽는 속도</span>
              <span className="text-[#0E8080] font-black" style={{ fontSize: "1.05rem" }}>{TTS_SPEEDS[speedIdx].label}</span>
            </div>
            <input type="range" min={0} max={2} step={1} value={speedIdx}
              onChange={e => handleSpeedChange(Number(e.target.value))}
              className="w-full h-3 rounded-full appearance-none cursor-pointer tts-slider"
              style={{ background: "#e5e7eb" }} />
            <div className="flex justify-between mt-1 px-1">
              {TTS_SPEEDS.map((s, i) => (
                <span key={s.label} className={`font-bold ${i === speedIdx ? "text-[#0E8080]" : "text-gray-400"}`} style={{ fontSize: "0.9rem" }}>
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 위험도 가로 바 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#0A2647] font-bold" style={{ fontSize: "1.2rem" }}>위험도 평가</h3>
            <div className="flex items-baseline gap-2">
              <span style={{ color: config.color, fontSize: "2.2rem", fontWeight: 900, lineHeight: 1 }}>{report.riskScore}</span>
              <span className="text-gray-400 font-bold" style={{ fontSize: "1rem" }}>/ 100점</span>
            </div>
          </div>

          {/* 게이지 + 마커 */}
          <div className="relative" style={{ height: GAUGE_H }}>
            {/* 색상 바 (글자 없음) */}
            <div className="flex rounded-full overflow-hidden w-full" style={{ height: GAUGE_H }}>
              <div className="flex-1" style={{ backgroundColor: "#16A34A" }} />
              <div className="flex-1" style={{ backgroundColor: "#D97706" }} />
              <div className="flex-1" style={{ backgroundColor: "#DC2626" }} />
            </div>
            {/* 마커: 게이지 높이에 딱 맞게 */}
            <div
              className="absolute top-0 flex items-center justify-center"
              style={{
                left: `calc(${report.riskScore}% - ${GAUGE_H / 2}px)`,
                width: GAUGE_H,
                height: GAUGE_H,
              }}
            >
              <div
                className="rounded-full bg-white shadow-lg"
                style={{
                  width: GAUGE_H - 6,
                  height: GAUGE_H - 6,
                  border: `4px solid ${config.color}`,
                }}
              />
            </div>
          </div>

          {/* 점수 레이블 */}
          <div className="relative mt-1" style={{ height: 24 }}>
            <span
              className="absolute font-black whitespace-nowrap"
              style={{
                left: `calc(${report.riskScore}% - 16px)`,
                color: config.color,
                fontSize: "0.9rem",
                top: 2,
              }}
            >
              ▲ {report.riskScore}점
            </span>
          </div>

          {/* 눈금 */}
          <div className="flex justify-between text-gray-300 font-bold mt-1 px-1" style={{ fontSize: "0.8rem" }}>
            <span>0</span><span>33</span><span>66</span><span>100</span>
          </div>

          <div className="mt-4 text-center">
            <span className="px-5 py-2 rounded-full text-white font-bold inline-block" style={{ backgroundColor: config.color, fontSize: "1.15rem" }}>
              위험도 {report.riskLevel} — {config.label}
            </span>
          </div>
        </div>

        {/* LLM 텍스트 */}
        <div className="rounded-2xl p-6 border-2" style={{ backgroundColor: config.bg, borderColor: config.border }}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: config.color }} />
            <p className="text-gray-700 leading-relaxed font-bold" style={{ fontSize: "1.15rem" }}>{report.reportText}</p>
          </div>
        </div>

        {/* 일간 차트 */}
        {report.type === "daily" && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "최대 심박수", value: `${report.maxHeartRate}`, unit: "BPM", color: "#DC2626" },
                { label: "평균 심박수", value: `${report.avgHeartRate}`, unit: "BPM", color: "#0A2647" },
                { label: "최소 심박수", value: `${report.minHeartRate}`, unit: "BPM", color: "#16A34A" },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="font-black" style={{ color: s.color, fontSize: "1.3rem" }}>{s.value}</div>
                  <div className="text-gray-400 font-bold" style={{ fontSize: "0.75rem" }}>{s.unit}</div>
                  <div className="text-gray-500 font-bold mt-1" style={{ fontSize: "0.8rem" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <div className={`rounded-2xl p-4 border-2 flex items-center gap-3 ${report.afDetected ? "bg-red-50 border-red-200" : "bg-green-50 border-green-200"}`}>
              <div className={`w-3 h-3 rounded-full flex-shrink-0 ${report.afDetected ? "bg-red-500" : "bg-green-500"}`} />
              <span className={`font-bold ${report.afDetected ? "text-red-700" : "text-green-700"}`} style={{ fontSize: "1.05rem" }}>
                심방세동(AF) {report.afDetected ? "감지됨" : "감지 안 됨"} · 오늘 {report.measurementCount}회 측정
              </span>
            </div>
            <HourlyHeartRateChart data={report.hourlyHeartRate} />
            <RiskTimelineChart data={report.hourlyHeartRate as Array<{ time: string; bpm: number; riskLevel: string }>} />
            <ArrhythmiaDonutChart data={report.arrhythmiaByType} />
          </>
        )}

        {/* 주간 차트 */}
        {report.type === "weekly" && (
          <>
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: "AF 발생 일수", value: `${report.afDays}일`, color: "#DC2626" },
                { label: "총 부정맥", value: `${report.totalArrhythmiaCount}건`, color: "#D97706" },
                { label: "측정 일수", value: `${report.measurementDays}일`, color: "#0A2647" },
              ].map(s => (
                <div key={s.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
                  <div className="font-black" style={{ color: s.color, fontSize: "1.3rem" }}>{s.value}</div>
                  <div className="text-gray-500 font-bold mt-1" style={{ fontSize: "0.8rem" }}>{s.label}</div>
                </div>
              ))}
            </div>
            <WeeklyHeartRateChart data={report.dailyStats} />
            <WeeklyRiskDistributionChart data={report.dailyStats} />
            <HRVTrendChart data={report.hrvTrend} />
          </>
        )}

        {/* 안내 */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-500 font-bold" style={{ fontSize: "0.95rem" }}>
          <Info className="w-4 h-4 inline mr-2 text-gray-400" />
          이 리포트는 참고용이며 의사의 진단을 대신하지 않습니다.
        </div>
        <p className="text-gray-400 font-bold text-center" style={{ fontSize: "0.9rem", whiteSpace: "pre-line" }}>
          {"측정 시점, 횟수, 빈도에 따라\n결과는 달라질 수 있습니다."}
        </p>

        {/* PDF 저장 */}
        <button onClick={handleSavePdf} disabled={generatingPdf}
          className="w-full flex items-center justify-center gap-2 py-5 bg-[#0A2647] text-white rounded-xl hover:bg-[#144272] transition-colors font-black disabled:opacity-50"
          style={{ minHeight: 64, fontSize: "1.2rem" }}>
          <Download className="w-6 h-6" />{generatingPdf ? "저장 중..." : "PDF 저장"}
        </button>
      </div>

      <style>{`
        .tts-slider::-webkit-slider-thumb {
          appearance: none; width: 28px; height: 28px; border-radius: 50%;
          background: #0A2647; border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2); cursor: pointer;
        }
        .tts-slider::-moz-range-thumb {
          width: 28px; height: 28px; border-radius: 50%;
          background: #0A2647; border: 3px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.2); cursor: pointer;
        }
      `}</style>
    </div>
  );
}