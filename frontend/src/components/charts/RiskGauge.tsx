import {
  RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer
} from "recharts";

type RiskLevelEn = "high" | "mid" | "low";

interface RiskGaugeProps {
  score: number;
  riskLevel?: RiskLevelEn;
}

const LEVEL_COLOR: Record<RiskLevelEn, string> = {
  high: "#DC2626",
  mid:  "#F59E0B",
  low:  "#16A34A",
};
const LEVEL_LABEL: Record<RiskLevelEn, string> = {
  high: "위험도 상",
  mid:  "위험도 중",
  low:  "위험도 하",
};
const LEVEL_BG: Record<RiskLevelEn, string> = {
  high: "bg-red-600",
  mid:  "bg-amber-500",
  low:  "bg-green-600",
};

function scoreToLevel(score: number): RiskLevelEn {
  if (score >= 14) return "high";
  if (score >= 3)  return "mid";
  return "low";
}

export function RiskGauge({ score, riskLevel }: RiskGaugeProps) {
  const level   = riskLevel ?? scoreToLevel(score);
  const color   = LEVEL_COLOR[level];
  const label   = LEVEL_LABEL[level];
  const bgColor = LEVEL_BG[level];

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-[#0D9488] font-bold mb-4" style={{ fontSize: "1.3rem" }}>
        위험도 점수 (0~100점, 높을수록 위험)
      </h3>
      <div className="flex flex-col items-center">
        <div style={{ height: 200, width: "100%", maxWidth: 320, margin: "0 auto" }}>
          <ResponsiveContainer width="100%" height="100%" debounce={1}>
            <RadialBarChart cx="50%" cy="80%" innerRadius="60%" outerRadius="90%"
              startAngle={180} endAngle={0}
              data={[{ value: score, fill: color }]}>
              <PolarAngleAxis type="number" domain={[0, 100]} angleAxisId={0} tick={false} />
              <RadialBar dataKey="value" cornerRadius={10} background={{ fill: "#f0f0f0" }} />
            </RadialBarChart>
          </ResponsiveContainer>
        </div>
        <div className="text-center -mt-8">
          <div style={{ fontSize: "2.2rem", fontWeight: 800, color }}>{score}</div>
          <div className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>/ 100점</div>
          <div className={`mt-2 px-4 py-1.5 rounded-full text-white font-bold ${bgColor}`}
            style={{ fontSize: "1rem" }}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}
