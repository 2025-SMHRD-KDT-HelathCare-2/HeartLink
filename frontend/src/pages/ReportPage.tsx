import { useState, useRef, useEffect } from "react";
import { ChevronDown, ChevronUp, AlertTriangle, CheckCircle, Info, Clock, Volume2, StopCircle } from "lucide-react";

const RISK_LEVELS = [
  {
    level: "상",
    color: "#DC2626",
    bg: "#FEF2F2",
    border: "#FECACA",
    score: 78,
    label: "위험",
    icon: AlertTriangle,
    date: "2026-06-01 09:32",
    summary: "심장이 불규칙하게 뛰는 증상이 오늘 감지되었습니다.",
    guide: [
      "오늘 안에 가까운 병원에 가보세요.",
      "무리한 움직임은 잠시 멈추고 편하게 쉬어 주세요.",
      "가슴이 아프거나, 숨이 막히면 바로 119에 전화하세요.",
    ],
    ttsText: "오늘 건강 결과입니다. 위험도는 위험 단계로, 78점입니다. 심장이 불규칙하게 뛰는 증상이 오늘 감지되었습니다. 지금 하셔야 할 일을 알려드립니다. 첫째, 오늘 안에 가까운 병원에 가보세요. 둘째, 무리한 움직임은 잠시 멈추고 편하게 쉬어 주세요. 셋째, 가슴이 아프거나 숨이 막히면 바로 119에 전화하세요.",
    detail: "지난 하루 동안 심장이 불규칙하게 뛰는 증상이 세 번 이상 나타났습니다. 심장이 뛰는 간격이 들쭉날쭉하고, 뛰는 속도도 정상보다 빠른 편입니다.",
  },
  {
    level: "중",
    color: "#D97706",
    bg: "#FFFBEB",
    border: "#FDE68A",
    score: 45,
    label: "주의",
    icon: Info,
    date: "2026-05-29 14:15",
    summary: "심장 박동이 약간 불규칙합니다. 조금 신경 써주세요.",
    guide: [
      "3일 안에 가까운 병원에 한 번 들러 보세요.",
      "규칙적으로 생활하시고, 커피나 녹차는 조금 줄여 보세요.",
      "몸 상태가 더 나빠지면 바로 병원을 찾아가세요.",
    ],
    ttsText: "오늘 건강 결과입니다. 위험도는 주의 단계로, 45점입니다. 심장 박동이 약간 불규칙합니다. 지금 하셔야 할 일을 알려드립니다. 첫째, 3일 안에 가까운 병원에 한 번 들러 보세요. 둘째, 규칙적으로 생활하시고 커피나 녹차는 조금 줄여 보세요. 셋째, 몸 상태가 더 나빠지면 바로 병원을 찾아가세요.",
    detail: "심장 박동이 정상과 이상 사이의 경계에 있습니다. 지금 당장 위급하진 않지만, 조금 주의가 필요한 상태입니다.",
  },
  {
    level: "하",
    color: "#16A34A",
    bg: "#F0FDF4",
    border: "#BBF7D0",
    score: 18,
    label: "양호",
    icon: CheckCircle,
    date: "2026-05-27 08:45",
    summary: "심장 건강 상태가 좋습니다. 잘 유지하고 계십니다!",
    guide: [
      "지금처럼 건강하게 지내세요.",
      "정기 검진을 꾸준히 받으세요.",
      "가벼운 산책 등 운동을 이어가세요.",
    ],
    ttsText: "오늘 건강 결과입니다. 위험도는 양호 단계로, 18점입니다. 심장 건강 상태가 좋습니다. 잘 유지하고 계십니다! 지금처럼 건강하게 지내시고, 정기 검진을 꾸준히 받으세요. 가벼운 산책 등 운동도 이어가시면 좋습니다.",
    detail: "모든 측정 수치가 정상 범위 안에 있습니다. 계속해서 정기적으로 측정하시길 권장합니다.",
  },
];

function useTTS() {
  const [playing, setPlaying] = useState(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const speak = (text: string) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "ko-KR";
    u.rate = 0.85;
    u.pitch = 1;
    u.onstart = () => setPlaying(true);
    u.onend = () => setPlaying(false);
    u.onerror = () => setPlaying(false);
    utteranceRef.current = u;
    window.speechSynthesis.speak(u);
  };

  const stop = () => {
    window.speechSynthesis.cancel();
    setPlaying(false);
  };

  useEffect(() => () => { window.speechSynthesis.cancel(); }, []);

  return { playing, speak, stop };
}

export function ReportPage() {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const { playing, speak, stop } = useTTS();
  const report = RISK_LEVELS[selectedIdx];
  const RiskIcon = report.icon;

  return (
    <div className="max-w-2xl mx-auto p-5">
      <div className="mb-7">
        <h1 className="font-black text-[#0A2647]" style={{ fontSize: "2.2rem" }}>내 건강 결과</h1>
        <p className="text-gray-500 mt-1 font-bold" style={{ fontSize: "1.15rem" }}>인공지능이 분석한 오늘 심장 상태예요.</p>
      </div>

      {/* 리포트 목록 */}
      <div className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 mb-6 overflow-hidden">
        <div className="p-5 border-b-2 border-gray-100">
          <h3 className="text-gray-800 font-black" style={{ fontSize: "1.25rem" }}>최근 결과 목록</h3>
        </div>
        {RISK_LEVELS.map((r, i) => (
          <button
            key={i}
            onClick={() => { setSelectedIdx(i); setExpanded(false); stop(); }}
            className={`w-full flex items-center gap-4 p-5 text-left transition-colors border-b-2 border-gray-50 last:border-0 ${selectedIdx === i ? "bg-blue-50" : "hover:bg-gray-50"}`}
            style={{ minHeight: 80 }}
          >
            <div className="w-4 h-16 rounded-full flex-shrink-0" style={{ backgroundColor: r.color }} />
            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <span className="px-4 py-2 rounded-full text-white font-black" style={{ backgroundColor: r.color, fontSize: "1.15rem" }}>
                  위험도 {r.level} — {r.label}
                </span>
                <span className="text-gray-600 font-black" style={{ fontSize: "1.1rem" }}>{r.score}점</span>
              </div>
              <p className="text-gray-500 mt-1 flex items-center gap-1 font-bold" style={{ fontSize: "1rem" }}>
                <Clock className="w-4 h-4" />{r.date}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* 위험도 배너 */}
      <div className="rounded-2xl p-7 mb-5 border-4" style={{ backgroundColor: report.bg, borderColor: report.color }}>
        <div className="flex items-center gap-5 mb-5">
          <div className="rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: report.color, width: 88, height: 88 }}>
            <RiskIcon className="text-white" style={{ width: 48, height: 48 }} />
          </div>
          <div className="flex-1">
            <div style={{ color: report.color, fontSize: "2.2rem", fontWeight: 900, lineHeight: 1.1 }}>
              위험도 {report.level}
            </div>
            <div style={{ color: report.color, fontSize: "1.6rem", fontWeight: 800 }}>{report.label}</div>
          </div>
          <div className="text-right flex-shrink-0">
            <div style={{ color: report.color, fontSize: "3.5rem", fontWeight: 900, lineHeight: 1 }}>{report.score}</div>
            <div className="text-gray-500 font-bold" style={{ fontSize: "1.1rem" }}>/ 100점</div>
          </div>
        </div>
        <div className="w-full bg-white/80 rounded-full mb-5 overflow-hidden" style={{ height: 20 }}>
          <div className="rounded-full h-full transition-all" style={{ width: `${report.score}%`, backgroundColor: report.color }} />
        </div>
        <p className="text-gray-800 leading-relaxed font-black" style={{ fontSize: "1.4rem" }}>{report.summary}</p>
      </div>

      {/* 리포트 듣기 버튼 */}
      <button
        onClick={() => playing ? stop() : speak(report.ttsText)}
        className={`w-full flex items-center justify-center gap-3 py-6 rounded-2xl border-4 transition-all font-black mb-6 ${
          playing
            ? "bg-red-50 border-red-500 text-red-600"
            : "bg-white border-[#0A2647] text-[#0A2647] hover:bg-[#0A2647] hover:text-white"
        }`}
        style={{ minHeight: 80, fontSize: "1.4rem" }}
      >
        {playing ? (
          <><StopCircle style={{ width: 34, height: 34 }} />듣는 중... (멈추려면 누르세요)</>
        ) : (
          <><Volume2 style={{ width: 34, height: 34 }} />🔊 리포트 듣기</>
        )}
      </button>

      {/* 지금 하셔야 할 일 */}
      <div className="bg-white rounded-2xl p-7 shadow-sm border-2 border-gray-100 mb-6">
        <h3 className="text-[#0A2647] font-black mb-6" style={{ fontSize: "1.6rem" }}>지금 하셔야 할 일</h3>
        <ul className="space-y-5">
          {report.guide.map((g, i) => (
            <li key={i} className="flex items-start gap-4">
              <span className="rounded-full flex items-center justify-center text-white font-black flex-shrink-0" style={{ backgroundColor: report.color, minWidth: 48, width: 48, height: 48, fontSize: "1.2rem" }}>
                {i + 1}
              </span>
              <span className="text-gray-800 leading-relaxed font-black" style={{ fontSize: "1.3rem" }}>{g}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 더 자세히 보기 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-center gap-2 py-5 text-[#0E8080] hover:text-[#0A2647] transition-colors bg-white rounded-2xl border-2 border-gray-200 mb-5 font-bold"
        style={{ minHeight: 68, fontSize: "1.2rem" }}
      >
        {expanded ? <ChevronUp style={{ width: 28, height: 28 }} /> : <ChevronDown style={{ width: 28, height: 28 }} />}
        {expanded ? "간략히 보기" : "더 자세히 보기"}
      </button>

      {expanded && (
        <div className="bg-white rounded-2xl p-7 shadow-sm border-2 border-gray-100 mb-6">
          <h3 className="text-[#0A2647] font-black mb-4" style={{ fontSize: "1.4rem" }}>상세 내용</h3>
          <p className="text-gray-700 leading-relaxed font-bold" style={{ fontSize: "1.2rem" }}>{report.detail}</p>
        </div>
      )}

      <div className="bg-gray-50 border-2 border-gray-200 rounded-xl p-5 text-gray-500 leading-relaxed font-bold" style={{ fontSize: "1rem" }}>
        <Info className="w-5 h-5 inline mr-2 text-gray-400" />
        이 결과는 참고용이에요. 이상이 있으면 꼭 병원을 방문하세요.
      </div>
    </div>
  );
}