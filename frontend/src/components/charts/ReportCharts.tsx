// 공통 리포트 차트 컴포넌트 (사용자/보호자 공용)
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, Legend,
  ReferenceLine
} from "recharts";

export const ARRHYTHMIA_COLORS = ["#0E8080", "#0A2647", "#DC2626", "#D97706", "#16A34A"];

export const RISK_COLOR_MAP: Record<string, string> = {
  high: "#DC2626", mid: "#D97706", low: "#16A34A",
  상: "#DC2626", 중: "#D97706", 하: "#16A34A",
};

// ===== 일간 차트들 =====

// 시간대별 심박수 라인 차트
export function HourlyHeartRateChart({ data }: { data: Array<{ time: string; bpm: number }> }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <h3 className="text-[#0A2647] font-bold mb-4" style={{ fontSize: "1.2rem" }}>시간대별 심박수</h3>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="time" tick={{ fontSize: 11, fontWeight: 700 }} />
            <YAxis tick={{ fontSize: 11, fontWeight: 700 }} />
            <Tooltip />
            <Line type="monotone" dataKey="bpm" stroke="#0E8080" strokeWidth={2.5}
              dot={{ r: 4, fill: "#0E8080" }} isAnimationActive={false} name="심박수 (BPM)" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// 위험도 타임라인
export function RiskTimelineChart({ data }: { data: Array<{ time: string; riskLevel: string; bpm: number }> }) {
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    const color = RISK_COLOR_MAP[payload.riskLevel] ?? "#9ca3af";
    return <circle cx={cx} cy={cy} r={7} fill={color} stroke="white" strokeWidth={2} />;
  };

  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <h3 className="text-[#0A2647] font-bold mb-2" style={{ fontSize: "1.2rem" }}>시간대별 위험도</h3>
      <div className="flex gap-3 mb-3">
        {[["#16A34A", "양호"], ["#D97706", "주의"], ["#DC2626", "위험"]].map(([c, l]) => (
          <div key={l} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
            <span className="text-gray-500 font-bold" style={{ fontSize: "0.85rem" }}>{l}</span>
          </div>
        ))}
      </div>
      <div style={{ height: 120 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="time" tick={{ fontSize: 11, fontWeight: 700 }} />
            <YAxis hide />
            <Tooltip formatter={(v, n, p) => [p.payload.riskLevel === "high" ? "위험" : p.payload.riskLevel === "mid" ? "주의" : "양호", "위험도"]} />
            <Line type="monotone" dataKey="bpm" stroke="#e5e7eb" strokeWidth={2}
              dot={<CustomDot />} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// 부정맥 도넛 차트
export function ArrhythmiaDonutChart({ data }: { data: Array<{ type: string; count: number }> }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <h3 className="text-[#0A2647] font-bold mb-4" style={{ fontSize: "1.2rem" }}>부정맥 종류별 분포</h3>
      <div className="flex items-center gap-4">
        <div style={{ width: 150, height: 150 }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="count" nameKey="type" cx="50%" cy="50%" innerRadius={40} outerRadius={65}>
                {data.map((_, i) => <Cell key={i} fill={ARRHYTHMIA_COLORS[i % ARRHYTHMIA_COLORS.length]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
        <div className="flex-1 space-y-2">
          {data.map((d, i) => (
            <div key={d.type} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: ARRHYTHMIA_COLORS[i % ARRHYTHMIA_COLORS.length] }} />
              <span className="text-gray-700 font-bold" style={{ fontSize: "0.9rem" }}>{d.type}</span>
              <span className="text-gray-400 font-bold ml-auto" style={{ fontSize: "0.9rem" }}>{d.count}건</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ===== 주간 차트들 =====

// 요일별 평균 심박수 막대 + 위험도 색상
export function WeeklyHeartRateChart({ data }: { data: Array<{ day: string; avgBpm: number; riskLevel: string }> }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <h3 className="text-[#0A2647] font-bold mb-4" style={{ fontSize: "1.2rem" }}>요일별 평균 심박수</h3>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 13, fontWeight: 700 }} />
            <YAxis tick={{ fontSize: 11, fontWeight: 700 }} />
            <Tooltip />
            <Bar dataKey="avgBpm" radius={[6, 6, 0, 0]} name="평균 심박수 (BPM)">
              {data.map((d, i) => (
                <Cell key={i} fill={RISK_COLOR_MAP[d.riskLevel] ?? "#0E8080"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="flex justify-center gap-4 mt-2">
        {[["#16A34A", "양호"], ["#D97706", "주의"], ["#DC2626", "위험"]].map(([c, l]) => (
          <div key={l} className="flex items-center gap-1">
            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: c }} />
            <span className="text-gray-500 font-bold" style={{ fontSize: "0.85rem" }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 요일별 위험도 분포 누적 영역 차트
export function WeeklyRiskDistributionChart({ data }: { data: Array<{ day: string; low: number; mid: number; high: number }> }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <h3 className="text-[#0A2647] font-bold mb-4" style={{ fontSize: "1.2rem" }}>요일별 위험도 분포</h3>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 13, fontWeight: 700 }} />
            <YAxis tick={{ fontSize: 11, fontWeight: 700 }} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="low" stackId="1" stroke="#16A34A" fill="#16A34A" fillOpacity={0.7} name="양호" />
            <Area type="monotone" dataKey="mid" stackId="1" stroke="#D97706" fill="#D97706" fillOpacity={0.7} name="주의" />
            <Area type="monotone" dataKey="high" stackId="1" stroke="#DC2626" fill="#DC2626" fillOpacity={0.7} name="위험" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// HRV 주간 추이 (RMSSD + SDNN)
export function HRVTrendChart({ data }: { data: Array<{ day: string; rmssd: number; sdnn: number }> }) {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
      <h3 className="text-[#0A2647] font-bold mb-2" style={{ fontSize: "1.2rem" }}>주간 HRV 추이</h3>
      <p className="text-gray-400 font-bold mb-4" style={{ fontSize: "0.85rem" }}>HRV(심박 변이도)가 높을수록 심장이 안정적입니다.</p>
      <div style={{ height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis dataKey="day" tick={{ fontSize: 13, fontWeight: 700 }} />
            <YAxis tick={{ fontSize: 11, fontWeight: 700 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="rmssd" stroke="#0E8080" strokeWidth={2.5}
              dot={{ r: 4 }} isAnimationActive={false} name="RMSSD" />
            <Line type="monotone" dataKey="sdnn" stroke="#0A2647" strokeWidth={2.5}
              dot={{ r: 4 }} isAnimationActive={false} name="SDNN" strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
