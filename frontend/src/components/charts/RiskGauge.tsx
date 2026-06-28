// ============================================================================
// 위험도 점수 반원 게이지
// - 리팩터링 포인트:
//   1) 카드/게이지 영역/점수 블록/배지 등 순수 CSS → RiskGauge.module.css
//   2) 위험도 색 하드코딩(#DC2626/#F59E0B/#16A34A) → chartTokens 의 RISK_COLOR_MAP
//      (Tailwind 배경 클래스 bg-red-600 등도 토큰 색 인라인으로 통일)
//   scoreToLevel 임계값 로직은 100% 동일
// ============================================================================
import {
  RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer
} from "recharts";
import { RISK_COLOR_MAP } from "../../styles/chartTokens";
import styles from "./RiskGauge.module.css";

type RiskLevelEn = "high" | "mid" | "low";

interface RiskGaugeProps {
  score: number;
  riskLevel?: RiskLevelEn;
}

// 색은 RISK_COLOR_MAP 으로 일원화. 라벨만 게이지 전용 텍스트로 유지.
const LEVEL_LABEL: Record<RiskLevelEn, string> = {
  high: "위험도 상",
  mid:  "위험도 중",
  low:  "위험도 하",
};

function scoreToLevel(score: number): RiskLevelEn {
  if (score >= 14) return "high";
  if (score >= 3)  return "mid";
  return "low";
}

export function RiskGauge({ score, riskLevel }: RiskGaugeProps) {
  const level = riskLevel ?? scoreToLevel(score);
  const color = RISK_COLOR_MAP[level]; // high/mid/low 모두 chartTokens 에서 해석
  const label = LEVEL_LABEL[level];

  return (
    <div className={styles.card}>
      <h3 className={`${styles.title} mb-4`}>
        위험도 점수 (0~100점, 높을수록 위험)
      </h3>
      <div className="flex flex-col items-center">
        <div className={styles.plot}>
          <ResponsiveContainer width="100%" height="100%" debounce={1}>
            <RadialBarChart cx="50%" cy="80%" innerRadius="60%" outerRadius="90%"
              startAngle={180} endAngle={0}
              data={[{ value: score, fill: color }]}>
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "#f0f0f0" }} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
        <div className={styles.scoreBlock}>
          {/* 점수 색은 위험도에 따라 동적이므로 인라인 주입 */}
          <div className={styles.scoreValue} style={{ color }}>{score}</div>
          <div className={styles.scoreUnit}>/ 100점</div>
          {/* 배지 배경색도 위험도에 따라 동적 — Tailwind bg-* 클래스 대신 토큰 색 인라인 */}
          <div className={styles.levelBadge} style={{ backgroundColor: color }}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
