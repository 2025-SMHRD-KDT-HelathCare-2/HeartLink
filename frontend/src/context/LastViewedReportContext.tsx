import { createContext, useContext, useState } from "react";
import type { ReactNode } from "react";
export interface ViewedReportData {
  memberName: string;
  date: string;
  riskScore: number;
  riskLevel: "상" | "중" | "하";
  heartRate: number;
  arrhythmiaCount: number;
  reportText: string;
}

interface LastViewedReportContextType {
  lastReport: ViewedReportData | null;
  setLastReport: (report: ViewedReportData) => void;
}

const LastViewedReportContext = createContext<LastViewedReportContextType | null>(null);

export function useLastViewedReport() {
  const ctx = useContext(LastViewedReportContext);
  if (!ctx) throw new Error("useLastViewedReport must be used within LastViewedReportProvider");
  return ctx;
}

export function LastViewedReportProvider({ children }: { children: ReactNode }) {
  const [lastReport, setLastReport] = useState<ViewedReportData | null>(null);
  return (
    <LastViewedReportContext.Provider value={{ lastReport, setLastReport }}>
      {children}
    </LastViewedReportContext.Provider>
  );
}
