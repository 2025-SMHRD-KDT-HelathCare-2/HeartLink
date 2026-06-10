import {
  RadialBarChart, RadialBar, PolarAngleAxis, ResponsiveContainer
} from "recharts";

interface RiskGaugeProps {
  score: number;
}

export function RiskGauge({ score }: RiskGaugeProps) {
  const color = score >= 70 ? "#DC2626" : score >= 40 ? "#F59E0B" : "#16A34A";
  const label = score >= 70 ? "위험도 상" : score >= 40 ? "위험도 중" : "위험도 하";
  const bgColor = score >= 70 ? "bg-red-600" : score >= 40 ? "bg-amber-500" : "bg-green-600";

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
      <h3 className="text-[#0A2647] font-bold mb-4" style={{ fontSize: "1.3rem" }}>
        위험도 점수 (0~100점, 높을수록 위험)
      </h3>
      <div className="flex flex-col items-center">
        <div style={{ height: 200, width: "100%", maxWidth: 320, margin: "0 auto" }}>
          <ResponsiveContainer width="100%" height="100%">
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
