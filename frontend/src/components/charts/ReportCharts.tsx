// ============================================================================
// 공통 리포트 차트 컴포넌트 (사용자/보호자 공용)
// - 리팩터링 포인트:
//   1) 카드 컨테이너/제목/범례 등 순수 CSS → ReportCharts.module.css
//   2) Recharts 색/축 폰트 → chartTokens.ts(RISK_COLOR_MAP, ARRHYTHMIA_COLORS,
//      RISK_LEGEND, CHART_AXIS, COLORS)
//   기존 export(ARRHYTHMIA_COLORS, RISK_COLOR_MAP)는 호환을 위해 re-export 유지
// ============================================================================
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, PieChart, Pie, Cell, AreaChart, Area, Legend
} from "recharts";
import { COLORS } from "../../styles/tokens";
import {
  RISK_COLOR_MAP, ARRHYTHMIA_COLORS, RISK_LEGEND, CHART_AXIS,
} from "../../styles/chartTokens";
import styles from "./ReportCharts.module.css";

// 기존에 이 파일에서 import 하던 코드와의 호환을 위해 re-export
export { ARRHYTHMIA_COLORS, RISK_COLOR_MAP };

// 위험도 범례(양호/주의/위험) 공통 렌더러
function RiskLegend({ center = false }: { center?: boolean }) {
  return (
    <div className={styles.legendRow} style={center ? { justifyContent: "center" } : undefined}>
      {RISK_LEGEND.map(({ color, label }) => (
        <div key={label} className={styles.legendItem}>
          <div className={styles.legendDot} style={{ backgroundColor: color }} />
          <span className={styles.legendLabel}>{label}</span>
        </div>
      ))}
    </div>
  );
}

// ===== 일간 차트들 =====

// 시간대별 심박수 라인 차트
export function HourlyHeartRateChart({ data }: { data: Array<{ time: string; bpm: number }> }) {
  return (
    <div className={styles.card}>
      <h3 className={`${styles.title} mb-4`}>시간대별 심박수</h3>
      <div className={styles.plot}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS.gridStroke} />
            <XAxis dataKey="time" tick={CHART_AXIS.tick} />
            <YAxis tick={CHART_AXIS.tick} />
            <Tooltip />
            <Line type="monotone" dataKey="bpm" stroke={COLORS.primary} strokeWidth={2.5}
              dot={{ r: 4, fill: COLORS.primary }} isAnimationActive={false} name="심박수 (BPM)" />
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
    <div className={styles.card}>
      <h3 className={`${styles.title} mb-2`}>시간대별 위험도</h3>
      <div className="mb-3">
        <RiskLegend />
      </div>
      <div className={styles.plotSm}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 15, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS.gridStroke} />
            <XAxis dataKey="time" tick={CHART_AXIS.tick} />
            <YAxis hide />
            <Tooltip formatter={(_v, _n, p) => [p.payload.riskLevel === "high" ? "위험" : p.payload.riskLevel === "mid" ? "주의" : "양호", "위험도"]} />
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
    <div className={styles.card}>
      <h3 className={`${styles.title} mb-4`}>부정맥 종류별 분포</h3>
      <div className="flex items-center gap-4">
        <div className={styles.plotDonut}>
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
    <div className={styles.card}>
      <h3 className={`${styles.title} mb-4`}>요일별 평균 심박수</h3>
      <div className={styles.plot}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS.gridStroke} />
            <XAxis dataKey="day" tick={CHART_AXIS.tickLg} />
            <YAxis tick={CHART_AXIS.tick} />
            <Tooltip />
            <Bar dataKey="avgBpm" radius={[6, 6, 0, 0]} name="평균 심박수 (BPM)">
              {data.map((d, i) => (
                <Cell key={i} fill={RISK_COLOR_MAP[d.riskLevel] ?? COLORS.primary} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-2">
        <RiskLegend center />
      </div>
    </div>
  );
}

// 요일별 위험도 분포 누적 영역 차트
export function WeeklyRiskDistributionChart({ data }: { data: Array<{ day: string; low: number; mid: number; high: number }> }) {
  return (
    <div className={styles.card}>
      <h3 className={`${styles.title} mb-4`}>요일별 위험도 분포</h3>
      <div className={styles.plot}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS.gridStroke} />
            <XAxis dataKey="day" tick={CHART_AXIS.tickLg} />
            <YAxis tick={CHART_AXIS.tick} />
            <Tooltip />
            <Legend />
            <Area type="monotone" dataKey="low" stackId="1" stroke={COLORS.safe} fill={COLORS.safe} fillOpacity={0.7} name="양호" />
            <Area type="monotone" dataKey="mid" stackId="1" stroke={COLORS.warning} fill={COLORS.warning} fillOpacity={0.7} name="주의" />
            <Area type="monotone" dataKey="high" stackId="1" stroke={COLORS.danger} fill={COLORS.danger} fillOpacity={0.7} name="위험" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// HRV 주간 추이 (RMSSD + SDNN)
export function HRVTrendChart({ data }: { data: Array<{ day: string; rmssd: number; sdnn: number }> }) {
  return (
    <div className={styles.card}>
      <h3 className={`${styles.title} mb-2`}>주간 HRV 추이</h3>
      <p className={`${styles.subtitle} mb-4`}>HRV(심박 변이도)가 높을수록 심장이 안정적입니다.</p>
      <div className={styles.plot}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_AXIS.gridStroke} />
            <XAxis dataKey="day" tick={CHART_AXIS.tickLg} />
            <YAxis tick={CHART_AXIS.tick} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="rmssd" stroke={COLORS.primary} strokeWidth={2.5}
              dot={{ r: 4 }} isAnimationActive={false} name="RMSSD" />
            <Line type="monotone" dataKey="sdnn" stroke={COLORS.primary} strokeWidth={2.5}
              dot={{ r: 4 }} isAnimationActive={false} name="SDNN" strokeDasharray="5 5" />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
