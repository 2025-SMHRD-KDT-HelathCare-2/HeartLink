import { useState } from "react";
import { Download, Share2, Phone, AlertTriangle, Info, ChevronLeft, ChevronRight } from "lucide-react";

const MEMBERS = [
  { id: 1, name: "김할머니", age: 74, relation: "어머니" },
  { id: 2, name: "박할아버지", age: 81, relation: "아버지" },
  { id: 3, name: "이순자", age: 68, relation: "이모" },
];

const MEMBER_REPORTS: Record<number, {
  name: string; age: number; riskLevel: "상" | "중" | "하"; riskScore: number;
  date: string; summary: string; action: string; emergency: string;
  findings: string[];
}> = {
  1: {
    name: "김할머니", age: 74, riskLevel: "상", riskScore: 78, date: "2026-06-01 09:32",
    summary: "심장이 불규칙하게 뛰는 증상이 감지되어 즉각적인 병원 방문이 필요합니다.",
    action: "오늘 중으로 심장내과 응급 진료를 받으세요.",
    emergency: "가슴 통증·숨 막힘·의식 저하 시 즉시 119",
    findings: [
      "심장 불규칙 박동 3회 감지",
      "심장 박동수 분당 112회 — 정상(60~100회)보다 빠름",
      "위험 신호 강도 82%",
    ],
  },
  2: {
    name: "박할아버지", age: 81, riskLevel: "중", riskScore: 45, date: "2026-05-29 14:15",
    summary: "가벼운 심장 리듬 이상이 감지되었습니다. 3일 안에 병원 방문을 권고합니다.",
    action: "3일 안에 내과 또는 심장내과를 방문하세요.",
    emergency: "증상 악화(가슴 통증·숨 막힘) 시 즉시 119",
    findings: [
      "심장 박동 리듬 이상 1회 감지",
      "위험 신호 강도 61%",
    ],
  },
  3: {
    name: "이순자", age: 68, riskLevel: "하", riskScore: 18, date: "2026-05-27 08:45",
    summary: "심장 건강 상태가 좋습니다. 정기 측정을 유지하세요.",
    action: "정기 검진을 통한 지속적인 모니터링을 권고합니다.",
    emergency: "현재 응급 상황 없음",
    findings: [
      "모든 수치 정상 범위",
      "위험 신호 강도 35%",
    ],
  },
};

const RISK_CONFIG = {
  상: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "위험" },
  중: { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", label: "주의" },
  하: { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", label: "양호" },
};

interface GuardianReportPageProps {
  memberId?: number;
}

export function GuardianReportPage({ memberId = 1 }: GuardianReportPageProps) {
  const [selectedId, setSelectedId] = useState(memberId);
  const report = MEMBER_REPORTS[selectedId] || MEMBER_REPORTS[1];
  const config = RISK_CONFIG[report.riskLevel];

  return (
    <div className="max-w-2xl mx-auto p-6">

      <div className="mb-6">
        <h1 className="font-bold text-[#0A2647]" style={{ fontSize: "1.9rem" }}>건강 결과 보고서</h1>
      </div>

      {/* 가족 선택 탭 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>리포트를 볼 가족을 선택하세요</p>
        </div>
        <div className="flex">
          {MEMBERS.map((m, i) => {
            const r = MEMBER_REPORTS[m.id];
            const c = RISK_CONFIG[r.riskLevel];
            const active = selectedId === m.id;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`flex-1 flex flex-col items-center gap-1 py-4 transition-all border-b-4 ${
                  active ? "border-[#0A2647] bg-blue-50" : "border-transparent hover:bg-gray-50"
                } ${i !== 0 ? "border-l border-gray-100" : ""}`}
                style={{ minHeight: 80 }}
              >
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: c.color, fontSize: "1rem" }}>
                  {m.name[0]}
                </div>
                <span className="font-bold text-gray-800" style={{ fontSize: "1rem" }}>{m.name}</span>
                <span className="px-2 py-0.5 rounded-full text-white font-bold"
                  style={{ backgroundColor: c.color, fontSize: "0.8rem" }}>
                  {c.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 이전/다음 네비게이션 */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => {
            const idx = MEMBERS.findIndex(m => m.id === selectedId);
            if (idx > 0) setSelectedId(MEMBERS[idx - 1].id);
          }}
          disabled={MEMBERS.findIndex(m => m.id === selectedId) === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 font-bold transition-colors"
          style={{ fontSize: "1rem" }}
        >
          <ChevronLeft className="w-5 h-5" />
          이전
        </button>
        <span className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>
          {MEMBERS.findIndex(m => m.id === selectedId) + 1} / {MEMBERS.length}
        </span>
        <button
          onClick={() => {
            const idx = MEMBERS.findIndex(m => m.id === selectedId);
            if (idx < MEMBERS.length - 1) setSelectedId(MEMBERS[idx + 1].id);
          }}
          disabled={MEMBERS.findIndex(m => m.id === selectedId) === MEMBERS.length - 1}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 font-bold transition-colors"
          style={{ fontSize: "1rem" }}
        >
          다음
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 위험도 배너 */}
      <div className="rounded-2xl p-6 mb-6 border-2" style={{ backgroundColor: config.bg, borderColor: config.border }}>
        <div className="flex items-center gap-4 mb-4">
          <AlertTriangle className="w-10 h-10 flex-shrink-0" style={{ color: config.color }} />
          <div className="flex-1">
            <div style={{ color: config.color, fontSize: "1.8rem", fontWeight: 900 }}>
              위험도 {report.riskLevel} — {config.label}
            </div>
            <div className="text-gray-600 font-bold mt-1" style={{ fontSize: "1rem" }}>
              {report.name} ({report.age}세) · {report.date}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div style={{ color: config.color, fontSize: "2.8rem", fontWeight: 900, lineHeight: 1 }}>{report.riskScore}</div>
            <div className="text-gray-400 font-bold" style={{ fontSize: "1rem" }}>/ 100점</div>
          </div>
        </div>
        <div className="w-full bg-white rounded-full h-4 overflow-hidden mb-4">
          <div className="h-4 rounded-full" style={{ width: `${report.riskScore}%`, backgroundColor: config.color }} />
        </div>
        <p className="text-gray-700 font-bold leading-relaxed" style={{ fontSize: "1.1rem" }}>{report.summary}</p>
      </div>

      {/* 주요 발견 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <h3 className="text-[#0A2647] font-bold mb-4" style={{ fontSize: "1.3rem" }}>주요 발견</h3>
        <ul className="space-y-3">
          {report.findings.map((f, i) => (
            <li key={i} className="flex items-start gap-3">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0 font-bold"
                style={{ backgroundColor: config.color, fontSize: "0.9rem" }}>
                {i + 1}
              </span>
              <span className="text-gray-700 font-bold" style={{ fontSize: "1.05rem" }}>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* 권고 행동 */}
      <div className="rounded-2xl p-5 mb-6 border-2" style={{ backgroundColor: config.bg, borderColor: config.border }}>
        <div className="flex items-start gap-3">
          <Info className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: config.color }} />
          <p className="font-bold" style={{ color: config.color, fontSize: "1.1rem" }}>{report.action}</p>
        </div>
      </div>

      {/* 응급 버튼 */}
      <button
        onClick={() => alert("119 응급 신고 시뮬레이션")}
        className="w-full flex items-center justify-center gap-3 py-5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-bold mb-6"
        style={{ minHeight: 68, fontSize: "1.3rem" }}
      >
        <Phone className="w-7 h-7" />
        119 응급 신고
      </button>

      {/* 저장·공유 */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => alert(`${report.name} 리포트 PDF 저장`)}
          className="flex items-center justify-center gap-2 py-4 bg-[#0A2647] text-white rounded-xl hover:bg-[#144272] transition-colors font-bold"
          style={{ minHeight: 60, fontSize: "1.1rem" }}
        >
          <Download className="w-6 h-6" />
          PDF 저장
        </button>
        <button
          onClick={() => alert("병원 공유")}
          className="flex items-center justify-center gap-2 py-4 border-2 border-[#0A2647] text-[#0A2647] rounded-xl hover:bg-[#0A2647]/5 transition-colors font-bold"
          style={{ minHeight: 60, fontSize: "1.1rem" }}
        >
          <Share2 className="w-6 h-6" />
          병원에 공유
        </button>
      </div>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-500 font-bold" style={{ fontSize: "0.95rem" }}>
        <Info className="w-4 h-4 inline mr-2 text-gray-400" />
        이 리포트는 참고용이며 의사의 진단을 대신하지 않습니다.
      </div>
    </div>
  );
}