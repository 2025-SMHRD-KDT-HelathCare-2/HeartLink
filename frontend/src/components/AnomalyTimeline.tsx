import { useState } from "react";
import { Info } from "lucide-react";

const SEVERITY_COLORS = { high: "#DC2626", medium: "#F59E0B", low: "#16A34A" };
const SEVERITY_LABELS = { high: "상", medium: "중", low: "하" };

export interface Anomaly {
  time: string;
  type: string;
  severity: "high" | "medium" | "low";
  score: number;
}

interface AnomalyTimelineProps {
  anomalies: Anomaly[];
}

export function AnomalyTimeline({ anomalies }: AnomalyTimelineProps) {
  const [popup, setPopup] = useState<Anomaly | null>(null);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-[#0A2647] font-bold mb-5" style={{ fontSize: "1.3rem" }}>
        오늘 이상한 신호가 감지된 시간대
      </h3>
      <div className="relative">
        <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200" />
        <div className="space-y-5">
          {anomalies.map((a, i) => (
            <div key={i}
              className="flex items-center gap-4 cursor-pointer group"
              onClick={() => setPopup(popup?.time === a.time ? null : a)}>
              <div
                className="w-5 h-5 rounded-full border-2 border-white shadow flex-shrink-0 z-10 group-hover:scale-110 transition-transform"
                style={{ backgroundColor: SEVERITY_COLORS[a.severity], marginLeft: 16 }}
              />
              <div className="flex-1 flex items-center gap-3 flex-wrap">
                <span className="text-gray-500 font-bold w-14" style={{ fontSize: "1rem" }}>{a.time}</span>
                <span className="text-gray-700 font-bold" style={{ fontSize: "1.05rem" }}>{a.type}</span>
                <span className="px-3 py-1 rounded-full text-white font-bold"
                  style={{ backgroundColor: SEVERITY_COLORS[a.severity], fontSize: "0.95rem" }}>
                  {SEVERITY_LABELS[a.severity]}
                </span>
                <span className="text-gray-400 font-bold ml-auto" style={{ fontSize: "0.95rem" }}>
                  위험 신호 강도 {Math.round(a.score * 100)}%
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {popup && (
        <div className="mt-5 p-5 bg-blue-50 border border-blue-200 rounded-xl">
          <div className="flex items-start gap-3">
            <Info className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-blue-700 font-bold" style={{ fontSize: "1.1rem" }}>
                {popup.time} — {popup.type}
              </div>
              <div className="text-blue-600 font-bold mt-1" style={{ fontSize: "1rem" }}>
                위험 신호 강도: {Math.round(popup.score * 100)}% · 자세한 결과는 '보호자용 리포트'에서 확인하세요.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
