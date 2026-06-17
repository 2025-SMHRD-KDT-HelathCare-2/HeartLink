import { useState, useRef, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  ChevronLeft, Volume2, StopCircle, AlertTriangle, Info
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";
import api from "../api/authApi";

// ===== 백엔드 응답 구조 =====
interface ReportData {
  date: string;
  riskScore: number;
  riskLevel: "상" | "중" | "하";
  reportText: string;
  ecgPoints: number[];
  rPeaks: number[];
}

const RISK_CONFIG = {
  상: { color: "#DC2626", label: "위험", bg: "#FEF2F2", border: "#FECACA" },
  중: { color: "#D97706", label: "주의", bg: "#FFFBEB", border: "#FDE68A" },
  하: { color: "#16A34A", label: "양호", bg: "#F0FDF4", border: "#BBF7D0" },
};

const WEEKDAYS = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
const LEVEL_MAP: Record<string, "상" | "중" | "하"> = { high: "상", mid: "중", low: "하" };

const TTS_SPEEDS = [
  { label: "느리게", idx: 0 },
  { label: "보통", idx: 1 },
  { label: "빠르게", idx: 2 },
];

export function UserReportDetailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const analysisId = (location.state as any)?.analysisId;

  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [speedIdx, setSpeedIdx] = useState(1); // 0:느리게 1:보통 2:빠르게
  const [playing, setPlaying] = useState(false);
  const [ttsLoading, setTtsLoading] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // ===== 리포트 데이터 조회 =====
  useEffect(() => {
    (async () => {
      try {
        if (!analysisId) {
          setLoading(false);
          return;
        }
        const res = await api.get(`/reports/${analysisId}`);
        const r = res.data;
        setReport({
          date: (r.createdAt || "").slice(0, 10),
          riskScore: r.riskScore ?? 0,
          riskLevel: LEVEL_MAP[r.riskLevel] ?? "하",
          reportText: r.reportTextUser ?? "",
          ecgPoints: r.ecgWaveformLite ?? [],
          rPeaks: r.rPeaks ?? [],
        });
      } catch (err) {
        console.error("리포트 조회 실패", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [analysisId]);

  const config = report ? RISK_CONFIG[report.riskLevel] : RISK_CONFIG.하;

  const weekday = useMemo(() => {
    if (!report) return "";
    const d = new Date(report.date);
    return `${report.date.replaceAll("-", ". ")} ${WEEKDAYS[d.getDay()]}`;
  }, [report]);

  const ecgChartData = useMemo(() => {
    if (!report) return [];
    return report.ecgPoints.map((y, i) => ({ x: Math.round((i / 250) * 100) / 100, y }));
  }, [report]);

  // ===== 백엔드 TTS 연동 =====
  const stopTTS = () => {
    audioRef.current?.pause();
    setPlaying(false);
  };

  const playTTS = async (speed: number) => {
    if (!analysisId) return;
    try {
      stopTTS();
      setTtsLoading(true);
      const res = await api.get(`/reports/${analysisId}/tts`, {
        params: { speed },
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data);
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onplay = () => setPlaying(true);
      audio.onended = () => setPlaying(false);
      audio.onerror = () => setPlaying(false);
      await audio.play();
    } catch (err) {
      console.error("TTS 재생 실패", err);
    } finally {
      setTtsLoading(false);
    }
  };

  const handleTTS = () => {
    if (playing) stopTTS();
    else playTTS(speedIdx);
  };

  const handleSpeedChange = (idx: number) => {
    setSpeedIdx(idx);
    if (playing) playTTS(idx);
  };

  useEffect(() => () => { audioRef.current?.pause(); }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-[#0E8080] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-500 font-bold" style={{ fontSize: "1.1rem" }}>리포트를 불러오고 있어요...</p>
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <p className="text-gray-500 font-bold">리포트를 불러올 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F4F7FA]">
      <header className="bg-[#0A2647] text-white px-5 py-4 flex items-center gap-3 sticky top-0 z-20 shadow-lg">
        <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-white/10 transition-colors">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div>
          <div className="font-black" style={{ fontSize: "1.3rem" }}>최근 AI 리포트</div>
          <div className="text-white/60 font-bold" style={{ fontSize: "0.9rem" }}>음성으로 들어보세요</div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto p-5 space-y-5">

        {/* 1. TTS 듣기 + 속도 조절 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <button
            onClick={handleTTS}
            disabled={ttsLoading}
            className={`w-full flex items-center justify-center gap-3 py-5 rounded-xl border-2 transition-all font-black mb-4 disabled:opacity-50 ${
              playing ? "bg-red-50 border-red-400 text-red-600" : "bg-white border-[#0A2647] text-[#0A2647] hover:bg-[#0A2647] hover:text-white"
            }`}
            style={{ minHeight: 72, fontSize: "1.3rem" }}
          >
            {ttsLoading ? "준비 중..." : playing ? <><StopCircle className="w-8 h-8" />멈추기</> : <><Volume2 className="w-8 h-8" />🔊 최근 AI리포트 듣기</>}
          </button>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>읽는 속도</span>
              <span className="text-[#0E8080] font-black" style={{ fontSize: "1.05rem" }}>
                {TTS_SPEEDS[speedIdx].label}
              </span>
            </div>
            <input
              type="range" min={0} max={2} step={1} value={speedIdx}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              className="w-full h-3 rounded-full appearance-none cursor-pointer tts-slider"
              style={{ background: "#e5e7eb" }}
            />
            <div className="flex justify-between mt-1 px-1">
              {TTS_SPEEDS.map((s, i) => (
                <span key={s.label}
                  className={`font-bold ${i === speedIdx ? "text-[#0E8080]" : "text-gray-400"}`}
                  style={{ fontSize: "0.9rem" }}>
                  {s.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* 2. 요일 */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 text-center">
          <p className="text-[#0A2647] font-black" style={{ fontSize: "1.5rem" }}>{weekday}</p>
        </div>

        {/* 3. 차트 (ECG 파형) */}
        {ecgChartData.length > 0 && (
          <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
            <h3 className="text-[#0A2647] font-bold mb-4" style={{ fontSize: "1.2rem" }}>심장 뛰는 모양</h3>
            <div style={{ height: 160, minHeight: 160, width: "100%" }}>
              <ResponsiveContainer width="100%" height={160} minWidth={0}>
                <LineChart data={ecgChartData} margin={{ top: 5, right: 10, left: -30, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="x" tick={{ fontSize: 11, fontWeight: 700 }} />
                  <YAxis tick={{ fontSize: 11, fontWeight: 700 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="y" stroke="#0E8080" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* 4. 위험도 평가 (가로 바) */}
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[#0A2647] font-bold" style={{ fontSize: "1.2rem" }}>위험도 평가</h3>
            <div className="flex items-baseline gap-2">
              <span style={{ color: config.color, fontSize: "2.2rem", fontWeight: 900, lineHeight: 1 }}>{report.riskScore}</span>
              <span className="text-gray-400 font-bold" style={{ fontSize: "1rem" }}>/ 100점</span>
            </div>
          </div>

          <div className="relative mb-3">
            <div className="flex h-7 rounded-full overflow-hidden">
              <div className="flex-1 flex items-center justify-center text-white font-bold" style={{ backgroundColor: "#16A34A", fontSize: "0.85rem" }}>양호</div>
              <div className="flex-1 flex items-center justify-center text-white font-bold" style={{ backgroundColor: "#D97706", fontSize: "0.85rem" }}>주의</div>
              <div className="flex-1 flex items-center justify-center text-white font-bold" style={{ backgroundColor: "#DC2626", fontSize: "0.85rem" }}>위험</div>
            </div>
            <div className="absolute -top-1 transition-all" style={{ left: `calc(${report.riskScore}% - 10px)` }}>
              <div className="w-5 h-5 bg-white border-4 rounded-full shadow-md" style={{ borderColor: config.color }} />
            </div>
            <div className="absolute -bottom-7 font-black whitespace-nowrap"
              style={{ left: `calc(${report.riskScore}% - 16px)`, color: config.color, fontSize: "0.9rem" }}>
              ▲ {report.riskScore}점
            </div>
          </div>

          <div className="flex justify-between text-gray-300 font-bold mt-8 px-1" style={{ fontSize: "0.8rem" }}>
            <span>0</span><span>33</span><span>66</span><span>100</span>
          </div>

          <div className="mt-4 text-center">
            <span className="px-5 py-2 rounded-full text-white font-bold inline-block"
              style={{ backgroundColor: config.color, fontSize: "1.15rem" }}>
              위험도 {report.riskLevel} — {config.label}
            </span>
          </div>
        </div>

        {/* 5. 텍스트 (LLM 요약) */}
        <div className="rounded-2xl p-6 border-2" style={{ backgroundColor: config.bg, borderColor: config.border }}>
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: config.color }} />
            <p className="text-gray-700 leading-relaxed font-bold" style={{ fontSize: "1.15rem" }}>{report.reportText}</p>
          </div>
        </div>

        {/* 안내 */}
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-500 font-bold" style={{ fontSize: "0.95rem" }}>
          <Info className="w-4 h-4 inline mr-2 text-gray-400" />
          이 리포트는 참고용이며 의사의 진단을 대신하지 않습니다.
        </div>
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