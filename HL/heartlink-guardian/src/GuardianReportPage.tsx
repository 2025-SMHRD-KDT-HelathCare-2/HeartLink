import { Download, Share2, Phone, AlertTriangle, Info } from "lucide-react";


interface GuardianReportPageProps {
  memberId?: number;
}

const MEMBER_REPORTS: Record<number, {
  name: string; age: number; riskLevel: "상" | "중" | "하"; riskScore: number;
  date: string; summary: string; recommendedAction: string; clinic: string;
  urgencyNote: string; findings: string[];
}> = {
  1: {
    name: "김할머니", age: 74, riskLevel: "상", riskScore: 78, date: "2026-06-01 09:32",
    summary: "심장이 불규칙하게 뛰는 증상(심방세동)이 감지되어 즉각적인 병원 방문이 필요합니다.",
    recommendedAction: "오늘 중으로 심장내과 응급 진료를 받으시기 바랍니다. 가장 가까운 큰 병원 응급실 방문을 권고합니다.",
    clinic: "심장내과 (응급 진료 권고)",
    urgencyNote: "가슴 통증, 숨 막힘, 정신을 잃을 것 같을 때 즉시 119 신고\n응급 처치 전 함부로 눕히지 마세요",
    findings: [
      "심장이 불규칙하게 뛰는 증상(심방세동) 3회 감지",
      "심장 박동 규칙성 수치(RMSSD): 12ms — 정상보다 낮음 (심장이 불안정하게 뛰고 있음)",
      "심장 박동 수: 분당 112회 — 너무 빠름 (보통은 분당 60~100회)",
      "위험 신호 강도: 82%",
    ],
  },
  2: {
    name: "박할아버지", age: 81, riskLevel: "중", riskScore: 45, date: "2026-05-29 14:15",
    summary: "가벼운 심장 리듬 이상이 감지되었습니다. 3일 안에 병원 방문을 권고합니다.",
    recommendedAction: "3일 안에 내과 또는 심장내과를 방문하여 정밀 검사를 받으세요.",
    clinic: "내과 또는 심장내과",
    urgencyNote: "증상이 심해지면(가슴 통증, 숨 막힘) 즉시 119 신고",
    findings: [
      "심장 박동 규칙성 수치(SDNN): 28ms — 주의가 필요한 범위 (정상: 50ms 이상)",
      "심장 박동 간격이 갑자기 바뀐 패턴 1회 감지",
      "위험 신호 강도: 61%",
    ],
  },
  3: {
    name: "이순자", age: 68, riskLevel: "하", riskScore: 18, date: "2026-05-27 08:45",
    summary: "심장 건강 상태가 좋습니다. 정기적인 측정을 계속하세요.",
    recommendedAction: "정기 검진을 통한 지속적인 모니터링을 권고합니다.",
    clinic: "정기 내과 검진 권고",
    urgencyNote: "현재 응급 상황 없음. 정기 검진 일정 유지",
    findings: [
      "모든 수치 정상 범위",
      "심장 박동 규칙성 수치(RMSSD): 38ms — 정상 (심장이 안정적으로 뛰고 있음)",
      "위험 신호 강도: 35%",
    ],
  },
};

const RISK_CONFIG = {
  상: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "위험" },
  중: { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", label: "주의" },
  하: { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", label: "양호" },
};

export function GuardianReportPage({ memberId = 1 }: GuardianReportPageProps) {
  const report = MEMBER_REPORTS[memberId] || MEMBER_REPORTS[1];
  const config = RISK_CONFIG[report.riskLevel];

  return (
    <div className="max-w-2xl mx-auto p-6">

      <div className="mb-8">
        <h1 className="font-bold text-[#0A2647]" style={{ fontSize: "1.9rem" }}>보호자용 건강 결과 보고서</h1>
        <p className="text-gray-600 mt-2 font-bold" style={{ fontSize: "1.1rem" }}>{report.name} · {report.date}</p>
      </div>

      {/* Risk banner */}
      <div className="rounded-2xl p-6 mb-6 border-2" style={{ backgroundColor: config.bg, borderColor: config.border }}>
        <div className="flex items-center gap-5 mb-5">
          <AlertTriangle className="w-10 h-10 flex-shrink-0" style={{ color: config.color }} />
          <div>
            <div style={{ color: config.color, fontSize: "1.7rem", fontWeight: 800 }}>
              위험도 {report.riskLevel} — {config.label}
            </div>
            <div className="text-gray-600 font-bold mt-1" style={{ fontSize: "1rem" }}>
              {report.name} ({report.age}세) · {report.date}
            </div>
          </div>
          <div className="ml-auto text-right">
            <div style={{ color: config.color, fontSize: "2.8rem", fontWeight: 800, lineHeight: 1 }}>{report.riskScore}</div>
            <div className="text-gray-400 font-bold" style={{ fontSize: "1rem" }}>/ 100점</div>
          </div>
        </div>
        <div className="w-full bg-white rounded-full h-4 overflow-hidden">
          <div className="h-4 rounded-full" style={{ width: `${report.riskScore}%`, backgroundColor: config.color }} />
        </div>
        <p className="mt-4 text-gray-700 leading-relaxed font-bold" style={{ fontSize: "1.1rem" }}>{report.summary}</p>
      </div>

      {/* Key findings */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <h3 className="text-[#0A2647] font-bold mb-5" style={{ fontSize: "1.3rem" }}>주요 발견 내용</h3>
        <ul className="space-y-3">
          {report.findings.map((f, i) => (
            <li key={i} className="flex items-start gap-4">
              <span className="w-7 h-7 rounded-full flex items-center justify-center text-white flex-shrink-0 mt-0.5 font-bold" style={{ backgroundColor: config.color, minWidth: 28, fontSize: "0.9rem" }}>
                {i + 1}
              </span>
              <span className="text-gray-700 font-bold" style={{ fontSize: "1.05rem" }}>{f}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Recommended action */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <h3 className="text-[#0A2647] font-bold mb-4" style={{ fontSize: "1.3rem" }}>지금 하셔야 할 일</h3>
        <div className="flex items-start gap-3 p-5 rounded-xl" style={{ backgroundColor: config.bg, border: `1px solid ${config.border}` }}>
          <Info className="w-6 h-6 flex-shrink-0 mt-0.5" style={{ color: config.color }} />
          <div>
            <p className="text-gray-700 leading-relaxed mb-3 font-bold" style={{ fontSize: "1.05rem" }}>{report.recommendedAction}</p>
            <p className="font-bold" style={{ color: config.color, fontSize: "1.05rem" }}>
              권장 진료과: <strong>{report.clinic}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Emergency guidance */}
      <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 mb-6">
        <h3 className="text-red-700 font-bold mb-4 flex items-center gap-2" style={{ fontSize: "1.3rem" }}>
          <AlertTriangle className="w-6 h-6" />
          응급 상황 안내
        </h3>
        <div className="space-y-2">
          {report.urgencyNote.split("\n").map((line, i) => (
            <p key={i} className="text-red-600 flex items-center gap-2 font-bold" style={{ fontSize: "1.05rem" }}>
              <span className="text-red-400">•</span>
              {line}
            </p>
          ))}
        </div>
        <button
          onClick={() => alert("119 응급 신고 시뮬레이션")}
          className="mt-5 w-full flex items-center justify-center gap-3 py-5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-colors font-bold"
          style={{ minHeight: 60, fontSize: "1.3rem" }}
        >
          <Phone className="w-7 h-7" />
          119 응급 신고
        </button>
      </div>

      {/* Action buttons */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <button
          onClick={() => alert(`${report.name} 보호자용 리포트 PDF 저장 시뮬레이션`)}
          className="flex items-center justify-center gap-2 py-5 bg-[#0A2647] text-white rounded-xl hover:bg-[#144272] transition-colors font-bold"
          style={{ minHeight: 60, fontSize: "1.1rem" }}
        >
          <Download className="w-6 h-6" />
          PDF 저장
        </button>
        <button
          onClick={() => alert("병원 공유 기능 시뮬레이션")}
          className="flex items-center justify-center gap-2 py-5 border-2 border-[#0A2647] text-[#0A2647] rounded-xl hover:bg-[#0A2647]/5 transition-colors font-bold"
          style={{ minHeight: 60, fontSize: "1.1rem" }}
        >
          <Share2 className="w-6 h-6" />
          병원에 공유
        </button>
      </div>

      {/* Disclaimer */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-gray-600 leading-relaxed font-bold" style={{ fontSize: "1rem" }}>
        <Info className="w-5 h-5 inline mr-2 text-gray-400" />
        이 서비스는 의료기기가 아니며 의사의 진단을 대신하지 않습니다. 이 리포트는 참고용으로만 사용하시고, 반드시 의료 전문가와 상담하시기 바랍니다.
      </div>
    </div>
  );
}