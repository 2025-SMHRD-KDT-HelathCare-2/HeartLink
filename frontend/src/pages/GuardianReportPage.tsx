import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Download, Share2, AlertTriangle, ChevronLeft, ChevronRight, Clock, FileText, Sparkles, Loader2 } from "lucide-react";
import api from "../api/authApi";
import type { Patient } from "../components/layout/GuardianLayout";

interface Analysis {
  riskScore: number;
  riskLevel: "high" | "mid" | "low";
  arrhythmiaClass?: string;
  arrhythmiaProb?: number;
  afDetected?: boolean;
  afProb?: number;
  hrvRmssd?: number;
  anomalyDetected?: boolean;
}

interface Measurement {
  _id: string;
  measuredAt: string;
  status: string;
  analysis: Analysis | null;
}

const RISK_CONFIG = {
  high: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "위험", kr: "상" },
  mid:  { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", label: "주의", kr: "중" },
  low:  { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", label: "양호", kr: "하" },
};
const DEFAULT_CFG = { color: "#9CA3AF", bg: "#F9FAFB", border: "#E5E7EB", label: "미분석", kr: "-" };

const ARRHYTHMIA_LABEL: Record<string, string> = {
  N: "정상 박동", SVEB: "심실 상부 이소성 박동", VEB: "심실 이소성 박동",
  F: "융합 박동", Q: "분류 불가",
};

function buildFindings(a: Analysis): string[] {
  const list: string[] = [];
  if (a.arrhythmiaClass && a.arrhythmiaClass !== "N") {
    list.push(`부정맥 감지: ${ARRHYTHMIA_LABEL[a.arrhythmiaClass] ?? a.arrhythmiaClass}${a.arrhythmiaProb ? ` (확률 ${Math.round(a.arrhythmiaProb * 100)}%)` : ""}`);
  }
  if (a.afDetected) {
    list.push(`심방세동(AF) 감지${a.afProb ? ` — 확률 ${Math.round(a.afProb * 100)}%` : ""}`);
  }
  if (a.hrvRmssd !== undefined) {
    list.push(`심박 변이도 RMSSD: ${a.hrvRmssd.toFixed(1)} ms`);
  }
  if (a.anomalyDetected) {
    list.push("이상 신호 감지됨");
  }
  if (list.length === 0) list.push("모든 주요 수치 정상 범위");
  return list;
}

interface GuardianReportPageProps {
  patients: Patient[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
}

export function GuardianReportPage({ patients, selectedUserId, onSelectUser }: GuardianReportPageProps) {
  const navigate = useNavigate();
  const [measurements, setMeasurements]   = useState<Measurement[]>([]);
  const [loading, setLoading]             = useState(false);
  const [error, setError]                 = useState("");
  const [selectedMeasIdx, setSelectedMeasIdx] = useState(0);

  const currentPatient = patients.find(p => p.user_id === selectedUserId) ?? patients[0] ?? null;
  const patientIdx     = patients.findIndex(p => p.user_id === selectedUserId);

  useEffect(() => {
    if (!selectedUserId) return;
    setLoading(true);
    setError("");
    setSelectedMeasIdx(0);
    api.get(`/measurements/patient/${selectedUserId}`)
      .then(r => setMeasurements(r.data.filter((m: Measurement) => m.status === "completed")))
      .catch(e => setError(e instanceof Error ? e.message : "불러오기 실패"))
      .finally(() => setLoading(false));
  }, [selectedUserId]);

  const displayed = measurements[selectedMeasIdx] ?? null;
  const analysis  = displayed?.analysis ?? null;
  const cfg       = analysis ? RISK_CONFIG[analysis.riskLevel] : DEFAULT_CFG;

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="font-bold text-[#0A2647]" style={{ fontSize: "1.9rem" }}>건강 결과 보고서</h1>
      </div>

      {/* 환자 선택 탭 */}
      {patients.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <p className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>리포트를 볼 가족을 선택하세요</p>
          </div>
          <div className="flex">
            {patients.map((p, i) => {
              const pc = p.risk_level ? RISK_CONFIG[p.risk_level] : DEFAULT_CFG;
              const active = p.user_id === selectedUserId;
              return (
                <button key={p.user_id}
                  onClick={() => onSelectUser(p.user_id)}
                  className={`flex-1 flex flex-col items-center gap-1 py-4 transition-all border-b-4 ${
                    active ? "border-[#0A2647] bg-blue-50" : "border-transparent hover:bg-gray-50"
                  } ${i !== 0 ? "border-l border-gray-100" : ""}`}
                  style={{ minHeight: 80 }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: pc.color, fontSize: "1rem" }}>
                    {p.nickname[0]}
                  </div>
                  <span className="font-bold text-gray-800" style={{ fontSize: "1rem" }}>{p.nickname}</span>
                  <span className="px-2 py-0.5 rounded-full text-white font-bold"
                    style={{ backgroundColor: pc.color, fontSize: "0.8rem" }}>
                    {pc.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 환자 이전/다음 네비게이션 */}
      <div className="flex items-center justify-between mb-6">
        <button
          onClick={() => patientIdx > 0 && onSelectUser(patients[patientIdx - 1].user_id)}
          disabled={patientIdx <= 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 font-bold transition-colors"
          style={{ fontSize: "1rem" }}>
          <ChevronLeft className="w-5 h-5" />이전
        </button>
        <span className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>
          {patientIdx + 1} / {patients.length}
        </span>
        <button
          onClick={() => patientIdx < patients.length - 1 && onSelectUser(patients[patientIdx + 1].user_id)}
          disabled={patientIdx >= patients.length - 1}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 font-bold transition-colors"
          style={{ fontSize: "1rem" }}>
          다음<ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-3 py-20 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="font-bold" style={{ fontSize: "1.1rem" }}>불러오는 중...</span>
        </div>
      ) : error ? (
        <div className="text-center py-20 text-red-400 font-bold">{error}</div>
      ) : measurements.length === 0 ? (
        <div className="text-center py-20 text-gray-400 font-bold" style={{ fontSize: "1.1rem" }}>
          아직 측정 기록이 없습니다.
        </div>
      ) : (
        <>
          {/* 이전 측정 목록 */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
            <div className="p-4 border-b border-gray-100 flex items-center gap-2">
              <FileText className="w-5 h-5 text-gray-400" />
              <p className="text-gray-700 font-bold" style={{ fontSize: "1rem" }}>
                최근 측정 기록 ({measurements.length}건)
              </p>
            </div>
            <div className="divide-y divide-gray-50">
              {measurements.slice(0, 5).map((m, i) => {
                const mc = m.analysis ? RISK_CONFIG[m.analysis.riskLevel] : DEFAULT_CFG;
                const isSelected = selectedMeasIdx === i;
                return (
                  <button key={m._id} onClick={() => setSelectedMeasIdx(i)}
                    className={`w-full flex items-center gap-4 px-5 py-4 text-left transition-colors ${isSelected ? "bg-blue-50" : "hover:bg-gray-50"}`}>
                    <div className="w-2 h-10 rounded-full shrink-0" style={{ backgroundColor: mc.color }} />
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-3 py-1 rounded-full text-white font-bold"
                          style={{ backgroundColor: mc.color, fontSize: "0.9rem" }}>
                          {mc.label} {m.analysis?.riskScore ?? "?"}점
                        </span>
                        {i === 0 && <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full font-bold" style={{ fontSize: "0.8rem" }}>최신</span>}
                      </div>
                      <div className="flex items-center gap-1 text-gray-400 mt-1 font-bold" style={{ fontSize: "0.9rem" }}>
                        <Clock className="w-3 h-3" />
                        {new Date(m.measuredAt).toLocaleString("ko-KR")}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 위험도 배너 */}
          {displayed && (
            <>
              <div className="rounded-2xl p-6 mb-6 border-2" style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}>
                <div className="flex items-center gap-4 mb-4">
                  <AlertTriangle className="w-10 h-10 shrink-0" style={{ color: cfg.color }} />
                  <div className="flex-1">
                    <div style={{ color: cfg.color, fontSize: "1.8rem", fontWeight: 900 }}>
                      위험도 {cfg.kr} — {cfg.label}
                    </div>
                    <div className="text-gray-600 font-bold mt-1" style={{ fontSize: "1rem" }}>
                      {currentPatient?.nickname}{currentPatient?.age ? ` (${currentPatient.age}세)` : ""} · {new Date(displayed.measuredAt).toLocaleString("ko-KR")}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div style={{ color: cfg.color, fontSize: "2.8rem", fontWeight: 900, lineHeight: 1 }}>
                      {analysis?.riskScore ?? "—"}
                    </div>
                    <div className="text-gray-400 font-bold" style={{ fontSize: "1rem" }}>/ 100점</div>
                  </div>
                </div>
                <div className="w-full bg-white rounded-full h-4 overflow-hidden">
                  <div className="h-4 rounded-full" style={{ width: `${analysis?.riskScore ?? 0}%`, backgroundColor: cfg.color }} />
                </div>
              </div>

              {/* 주요 발견 */}
              {analysis && (
                <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
                  <h3 className="text-[#0A2647] font-bold mb-4" style={{ fontSize: "1.3rem" }}>주요 발견</h3>
                  <ul className="space-y-3">
                    {buildFindings(analysis).map((f, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="w-7 h-7 rounded-full flex items-center justify-center text-white shrink-0 font-bold"
                          style={{ backgroundColor: cfg.color, fontSize: "0.9rem" }}>
                          {i + 1}
                        </span>
                        <span className="text-gray-700 font-bold" style={{ fontSize: "1.05rem" }}>{f}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* AI 상세 리포트 */}
              <button
                onClick={() => navigate(`/guardian-report-detail/${selectedUserId}`)}
                className="w-full flex items-center justify-center gap-3 py-5 bg-linear-to-r from-[#0A2647] to-[#0E8080] text-white rounded-2xl hover:opacity-90 transition-all font-black mb-6 shadow-lg"
                style={{ minHeight: 68, fontSize: "1.2rem" }}
              >
                <Sparkles className="w-7 h-7" />
                AI 상세 리포트 보기
              </button>

              <div className="grid grid-cols-2 gap-4 mb-6">
                <button onClick={() => alert("PDF 저장 준비 중")}
                  className="flex items-center justify-center gap-2 py-4 bg-[#0A2647] text-white rounded-xl hover:bg-[#144272] transition-colors font-bold"
                  style={{ minHeight: 60, fontSize: "1.1rem" }}>
                  <Download className="w-6 h-6" />PDF 저장
                </button>
                <button onClick={() => alert("병원 공유 준비 중")}
                  className="flex items-center justify-center gap-2 py-4 border-2 border-[#0A2647] text-[#0A2647] rounded-xl hover:bg-[#0A2647]/5 transition-colors font-bold"
                  style={{ minHeight: 60, fontSize: "1.1rem" }}>
                  <Share2 className="w-6 h-6" />병원 공유
                </button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
