import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Info, ChevronLeft, ChevronRight, Clock, FileText, Sparkles } from "lucide-react";
import api from "../api/authApi";
import type { Patient } from "../components/layout/GuardianLayout";
import { toKSTDatetime } from "../utils/formatKST";

interface MeasurementRecord {
  id: string;
  date: string;
  riskLevel: "상" | "중" | "하";
  riskScore: number;
}

const LEVEL_MAP: Record<string, "상" | "중" | "하"> = { high: "상", mid: "중", low: "하" };

const RISK_CONFIG = {
  상: { color: "#DC2626", bg: "#FEF2F2", border: "#FECACA", label: "위험" },
  중: { color: "#D97706", bg: "#FFFBEB", border: "#FDE68A", label: "주의" },
  하: { color: "#16A34A", bg: "#F0FDF4", border: "#BBF7D0", label: "양호" },
};

interface GuardianReportPageProps {
  patients: Patient[];
  selectedUserId: string | null;
  onSelectUser: (userId: string) => void;
}

export function GuardianReportPage({ patients, selectedUserId, onSelectUser }: GuardianReportPageProps) {
  const navigate = useNavigate();

  const initialIdx = selectedUserId
    ? Math.max(0, patients.findIndex(p => p.user_id === selectedUserId))
    : 0;
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);
  const [records, setRecords] = useState<MeasurementRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);

  useEffect(() => {
    if (!selectedUserId) return;
    const idx = patients.findIndex(p => p.user_id === selectedUserId);
    if (idx >= 0) setSelectedIdx(idx);
  }, [selectedUserId, patients]);

  useEffect(() => {
    if (patients.length === 0) return;
    const userId = patients[Math.min(selectedIdx, patients.length - 1)].user_id;
    onSelectUser(userId);
    (async () => {
      try {
        setRecordsLoading(true);
        const res = await api.get(`/measurements/patient/${userId}`);
        const mapped: MeasurementRecord[] = (res.data || [])
          .slice(0, 3)
          .map((m: any) => ({
            id: m._id,
            date: toKSTDatetime(m.measuredAt || ""),
            riskLevel: LEVEL_MAP[m.analysis?.riskLevel] ?? "하",
            riskScore: m.analysis?.riskScore ?? 0,
          }));
        setRecords(mapped);
      } catch (err) {
        console.error("측정 기록 조회 실패", err);
        setRecords([]);
      } finally {
        setRecordsLoading(false);
      }
    })();
  }, [patients, selectedIdx]);

  if (patients.length === 0) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="font-bold text-[#0A2647] mb-6" style={{ fontSize: "1.9rem" }}>건강 결과 보고서</h1>
        <div className="bg-white rounded-2xl p-12 shadow-sm border border-gray-100 text-center">
          <p className="text-gray-400 font-bold" style={{ fontSize: "1.1rem" }}>아직 연결된 사용자가 없어요. 마이페이지에서 사용자를 등록해 보세요.</p>
        </div>
      </div>
    );
  }

  const patient = patients[Math.min(selectedIdx, patients.length - 1)];
  const patientRiskLevel = LEVEL_MAP[patient.risk_level ?? "low"] ?? "하";
  const config = RISK_CONFIG[patientRiskLevel];

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="font-bold text-[#0A2647]" style={{ fontSize: "1.9rem" }}>건강 결과 보고서</h1>
      </div>

      {/* 사용자 선택 탭 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <p className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>리포트를 볼 사용자를 선택하세요</p>
        </div>
        <div className="flex">
          {patients.map((p, i) => {
            const rl = LEVEL_MAP[p.risk_level ?? "low"] ?? "하";
            const c = RISK_CONFIG[rl];
            const active = selectedIdx === i;
            return (
              <button key={p.user_id}
                onClick={() => setSelectedIdx(i)}
                className={`flex-1 flex flex-col items-center gap-1 py-4 transition-all border-b-4 ${
                  active ? "border-[#0A2647] bg-blue-50" : "border-transparent hover:bg-gray-50"
                } ${i !== 0 ? "border-l border-gray-100" : ""}`}
                style={{ minHeight: 80 }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ backgroundColor: c.color, fontSize: "1rem" }}>
                  {p.nickname[0]}
                </div>
                <span className="font-bold text-gray-800" style={{ fontSize: "1rem" }}>{p.nickname}</span>
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
        <button onClick={() => setSelectedIdx(i => Math.max(0, i - 1))} disabled={selectedIdx === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 font-bold transition-colors"
          style={{ fontSize: "1rem" }}>
          <ChevronLeft className="w-5 h-5" />이전
        </button>
        <span className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>
          {selectedIdx + 1} / {patients.length}
        </span>
        <button onClick={() => setSelectedIdx(i => Math.min(patients.length - 1, i + 1))} disabled={selectedIdx === patients.length - 1}
          className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-30 font-bold transition-colors"
          style={{ fontSize: "1rem" }}>
          다음<ChevronRight className="w-5 h-5" />
        </button>
      </div>

      {/* 최근 측정 기록 3건 */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex items-center gap-2">
          <FileText className="w-5 h-5 text-gray-400" />
          <p className="text-gray-700 font-bold" style={{ fontSize: "1rem" }}>최근 측정 기록</p>
        </div>
        {recordsLoading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-[#0E8080] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : records.length === 0 ? (
          <p className="text-gray-400 font-bold text-center py-8" style={{ fontSize: "0.95rem" }}>측정 기록이 없습니다.</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {records.map((r, i) => {
              const rc = RISK_CONFIG[r.riskLevel];
              return (
                <button key={r.id}
                  onClick={() => navigate(`/measurement/${r.id}`, { state: { patientUserId: patient.user_id } })}
                  className="w-full flex items-center gap-4 px-5 py-4 hover:bg-gray-50 transition-colors text-left">
                  <div className="w-2 h-10 rounded-full flex-shrink-0" style={{ backgroundColor: rc.color }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="px-3 py-1 rounded-full text-white font-bold"
                        style={{ backgroundColor: rc.color, fontSize: "0.9rem" }}>
                        {rc.label} {r.riskScore}점
                      </span>
                      {i === 0 && <span className="px-2 py-0.5 bg-blue-100 text-blue-600 rounded-full font-bold" style={{ fontSize: "0.8rem" }}>최신</span>}
                    </div>
                    <div className="flex items-center gap-1 text-gray-400 mt-1 font-bold" style={{ fontSize: "0.9rem" }}>
                      <Clock className="w-3 h-3" />{r.date}
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 위험도 배너 */}
      <div className="rounded-2xl p-6 mb-6 border-2" style={{ backgroundColor: config.bg, borderColor: config.border }}>
        <div className="flex items-center gap-4 mb-4">
          <AlertTriangle className="w-10 h-10 flex-shrink-0" style={{ color: config.color }} />
          <div className="flex-1">
            <div style={{ color: config.color, fontSize: "1.8rem", fontWeight: 900 }}>
              위험도 {patientRiskLevel} — {config.label}
            </div>
            <div className="text-gray-600 font-bold mt-1" style={{ fontSize: "1rem" }}>
              {patient.nickname}{patient.age != null ? ` (${patient.age}세)` : ""}
              {patient.latest_measured_at && ` · 최근 측정 ${toKSTDatetime(patient.latest_measured_at)}`}
            </div>
          </div>
          <div className="text-right flex-shrink-0">
            <div style={{ color: config.color, fontSize: "2.8rem", fontWeight: 900, lineHeight: 1 }}>{patient.risk_score ?? 0}</div>
            <div className="text-gray-400 font-bold" style={{ fontSize: "1rem" }}>/ 100점</div>
          </div>
        </div>
        <div className="w-full bg-white rounded-full h-4 overflow-hidden">
          <div className="h-4 rounded-full" style={{ width: `${patient.risk_score ?? 0}%`, backgroundColor: config.color }} />
        </div>
      </div>

      {/* 일일 AI 리포트 보기 */}
      <button
        onClick={() => navigate(`/guardian-report-detail/${patient.user_id}`, { state: { type: "daily" } })}
        className="w-full flex items-center justify-center gap-3 py-5 bg-gradient-to-r from-[#0A2647] to-[#0E8080] text-white rounded-2xl hover:opacity-90 transition-all font-black mb-3 shadow-lg"
        style={{ minHeight: 68, fontSize: "1.2rem" }}
      >
        <Sparkles className="w-7 h-7" />
        일일 AI 리포트 보기
      </button>

      {/* 리포트 기록 보기 */}
      <button
        onClick={() => navigate(`/guardian-report-history/${patient.user_id}`)}
        className="w-full flex items-center justify-center gap-3 py-4 border-2 border-[#0A2647] text-[#0A2647] rounded-2xl hover:bg-[#0A2647]/5 transition-all font-bold mb-5"
        style={{ minHeight: 56, fontSize: "1.1rem" }}
      >
        <FileText className="w-5 h-5" />
        리포트 기록 보기
      </button>

      <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-gray-500 font-bold" style={{ fontSize: "0.95rem" }}>
        <Info className="w-4 h-4 inline mr-2 text-gray-400" />
        이 리포트는 참고용이며 의사의 진단을 대신하지 않습니다.
      </div>
    </div>
  );
}