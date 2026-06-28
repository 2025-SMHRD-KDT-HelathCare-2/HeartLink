// ============================================================================
// 이상 신호 타임라인 (오늘 감지된 시간대별 이상 신호)
// - 리팩터링 포인트:
//   1) 카드/세로 레일/노드/팝업 등 순수 CSS → AnomalyTimeline.module.css
//   2) 심각도(상/중/하) 색 하드코딩(#DC2626 등) → chartTokens 의 RISK_COLOR_MAP
//      ('중' 색이 #F59E0B → COLORS.warning 으로 통일됨)
//   팝업 토글 로직은 100% 동일
// ============================================================================
import { useState } from "react";
import { Info } from "lucide-react";
import { RISK_COLOR_MAP } from "../../styles/chartTokens";
import styles from "./AnomalyTimeline.module.css";

// 심각도(severity) → 위험도 색/라벨 매핑
// severity 키(high/medium/low)를 RISK_COLOR_MAP 키(high/mid/low)로 변환해 색을 일원화
const SEVERITY_TO_RISK: Record<"high" | "medium" | "low", "high" | "mid" | "low"> = {
  high: "high", medium: "mid", low: "low",
};
const SEVERITY_LABELS = { high: "상", medium: "중", low: "하" };

const severityColor = (s: "high" | "medium" | "low") => RISK_COLOR_MAP[SEVERITY_TO_RISK[s]];

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
    <div className={styles.card}>
      <h3 className={`${styles.title} mb-5`}>
        오늘 이상한 신호가 감지된 시간대
      </h3>
      <div className={styles.timeline}>
        <div className={styles.rail} />
        <div className="space-y-5">
          {anomalies.map((a, i) => (
            <div key={i}
              className={`${styles.row} group`}
              onClick={() => setPopup(popup?.time === a.time ? null : a)}>
              {/* 노드 마커 — 색은 심각도에 따라 동적이므로 인라인 주입 */}
              <div
                className={styles.node}
                style={{ backgroundColor: severityColor(a.severity) }}
              />
              <div className="flex-1 flex items-center gap-3 flex-wrap">
                <span className="text-gray-500 font-bold w-14 text-small">{a.time}</span>
                <span className="text-gray-700 font-bold text-small">{a.type}</span>
                <span className="px-3 py-1 rounded-full text-white font-bold"
                  style={{ backgroundColor: severityColor(a.severity), fontSize: "0.95rem" }}>
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
        <div className={styles.popup}>
          <div className="flex items-start gap-3">
            <Info className="w-6 h-6 text-blue-500 flex-shrink-0 mt-0.5" />
            <div>
              <div className="text-blue-700 font-bold text-[1.1rem]">
                {popup.time} — {popup.type}
              </div>
              <div className="text-blue-600 font-bold mt-1 text-small">
                위험 신호 강도: {Math.round(popup.score * 100)}% · 자세한 결과는 '보호자용 리포트'에서 확인하세요.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
