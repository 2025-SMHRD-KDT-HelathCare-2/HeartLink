// ============================================================================
// 심전도 파일 업로드 + 실시간 모니터 재생 + 결과(ECG/게이지) 페이지
//  ※ 디자인 리뉴얼 버전 (업로드/폴링/스캔 reveal 로직은 100% 동일)
//
// [디자인 리뉴얼 포인트]
//   1) 상단 제목 → 청록→블루 그라데이션 헤더 배너 (<Card variant="gradient">)
//   2) 안내/드롭존/진행/오류/결과 카드 → 공용 <Card> + shadow-card 로 통일
//   3) 파일 선택 버튼 → 가장 강조되는 gradient 버튼
//   4) 색상은 모두 tokens.ts(COLORS) 사용
// ============================================================================
import { useState, useRef, useMemo, useEffect } from "react";
import { Upload, AlertCircle, Activity, Info } from "lucide-react";
import api from "../api/authApi";
import { useToast } from "../context/ToastContext";
import { ECGChart } from "../components/charts/ECGChart";
import { MonitorChart } from "../components/charts/MonitorChart";
import { RiskGauge } from "../components/charts/RiskGauge";
import { Card, Button } from "../components/ui";
import { COLORS } from "../styles/tokens";
import styles from "./UploadVisualizationPage.module.css";

type Phase = "upload" | "uploading" | "processing" | "error" | "scanning" | "result";

interface ECGResult {
  ecgPoints: number[];
  rPeaks: number[];
  sampleRate: number;
  riskLevel?: "high" | "mid" | "low";
  riskScore?: number | null;
}

const DEFAULT_SAMPLE_RATE = 250;

export function UploadVisualizationPage() {
  const { showToast } = useToast();
  const [phase, setPhase] = useState<Phase>("upload");
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [result, setResult] = useState<ECGResult | null>(null);
  const [revealProgress, setRevealProgress] = useState(0); // 0~100, 파형 reveal용
  const fileRef = useRef<HTMLInputElement>(null);

  const sampleRate = result?.sampleRate || DEFAULT_SAMPLE_RATE;

  // ECG 점 배열을 차트가 쓰는 {x(초), y} 형태로 변환
  const chartData = useMemo(() => {
    if (!result?.ecgPoints?.length) return [];
    return result.ecgPoints.map((y, i) => ({
      x: Math.round((i / sampleRate) * 1000) / 1000,
      y,
    }));
  }, [result, sampleRate]);

  // R-peak 가 인덱스로 오면 초 단위로 환산
  const rPeaks = useMemo(() => {
    if (!result?.rPeaks?.length) return [];
    const maxIdx = result.ecgPoints?.length || 0;
    const looksLikeIndex = result.rPeaks.every(v => Number.isInteger(v) && v <= maxIdx);
    if (looksLikeIndex) {
      return result.rPeaks.map(idx => Math.round((idx / sampleRate) * 1000) / 1000);
    }
    return result.rPeaks;
  }, [result, sampleRate]);

  // 결과 준비 시 모니터처럼 왼쪽→오른쪽 스캔 (최대 10초 캡) — 기존 로직 동일
  useEffect(() => {
    if (phase !== "scanning") return;
    if (!chartData.length) {
      setPhase("result");
      return;
    }
    setRevealProgress(0);

    const MAX_DURATION = 10000;
    const naturalDuration = Math.min(Math.max(chartData.length * 4, 2000), MAX_DURATION);

    let raf: number;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const p = Math.min((elapsed / naturalDuration) * 100, 100);
      setRevealProgress(p);
      if (p < 100 && elapsed < MAX_DURATION) {
        raf = requestAnimationFrame(tick);
      } else {
        setRevealProgress(100);
        setTimeout(() => setPhase("result"), 300);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, chartData.length]);

  // 측정 분석 결과 폴링 — 기존 로직 동일
  const pollMeasurement = async (measurementId: string) => {
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const res = await api.get(`/measurements/${measurementId}`);
      const data = res.data;

      if (data.status === "processing" && data.ecgWaveformLite?.length) {
        setResult({
          ecgPoints: data.ecgWaveformLite,
          rPeaks: data.rPeaks ?? [],
          sampleRate: data.samplingRate ?? 250,
          riskLevel: undefined,
          riskScore: null,
        });
        setPhase("scanning");
      }

      if (data.status === "completed") return data;
      if (data.status === "failed") throw new Error("분석에 실패했습니다.");
      setProgress(prev => Math.min(prev + 2, 95));
    }
    throw new Error("분석이 너무 오래 걸립니다. 잠시 후 다시 확인해 주세요.");
  };

  // 파일 처리(검증 → 업로드 → 폴링 → 결과) — 기존 로직 동일
  const handleFile = async (file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (ext !== ".csv") {
      setPhase("error");
      setErrorMsg("CSV 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setPhase("error");
      setErrorMsg("파일이 너무 큽니다. (최대 100MB)");
      return;
    }

    setFileName(file.name);
    setPhase("uploading");
    setProgress(0);
    setErrorMsg("");

    try {
      const formData = new FormData();
      formData.append("ecg_file", file);
      formData.append("device_type", "apple_watch");

      const res = await api.post("/measurements", formData, {
        headers: { "Content-Type": undefined }, // 멀티파트 boundary 는 브라우저가 자동 설정
      });

      const { measurementId } = res.data;
      setPhase("processing");
      setProgress(20);

      const data = await pollMeasurement(measurementId);

      const riskLevel = (data.analysis?.riskLevel as "high" | "mid" | "low") ?? "low";
      const riskScore = data.analysis?.riskScore ?? null;

      setResult({
        ecgPoints: data.ecgWaveformLite ?? [],
        rPeaks: data.rPeaks ?? [],
        sampleRate: data.samplingRate ?? 250,
        riskLevel,
        riskScore,
      });
      setPhase(prev => prev === "scanning" ? "scanning" : "scanning");

      if (riskLevel === "high") {
        showToast({
          level: "상",
          title: "위험 신호가 감지되었어요",
          message: "심장이 불규칙하게 뛰는 증상이 있어요. 내 건강 결과를 확인해 주세요.",
        });
      }
    } catch (err) {
      setPhase("error");
      const message = err instanceof Error ? err.message : "업로드 중 오류가 발생했습니다.";
      setErrorMsg(message);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const showUploadCard = phase !== "scanning" && phase !== "result";
  const busy = phase === "uploading" || phase === "processing";

  return (
    <div className="max-w-3xl mx-auto p-6">

      {/* ───────── 상단 그라데이션 헤더 배너 ───────── */}
      <Card variant="gradient" padding="lg" className="mb-6">
        <h1 className="font-black leading-tight" style={{ fontSize: "2rem" }}>심전도 파일 올리기</h1>
        <p className="mt-2 font-bold text-body opacity-90">
          스마트워치에서 받은 파일을 올리면 심전도 그래프를 확인할 수 있어요.
        </p>
      </Card>

      {/* 업로드 영역 - 결과 나오면 페이드 아웃 */}
      <div
        className={`transition-all duration-700 ${showUploadCard ? "opacity-100 max-h-[1200px]" : "opacity-0 max-h-0 overflow-hidden pointer-events-none"}`}
      >
        {/* 사용 안내 (주의 색 카드) */}
        <div
          className="border-2 rounded-2xl p-5 mb-6"
          style={{ backgroundColor: COLORS.warningBg, borderColor: COLORS.warningBorder }}
        >
          <p className="font-bold text-[1.1rem]" style={{ color: COLORS.warning }}>📋 어떻게 사용하나요?</p>
          <ol className="mt-3 space-y-2 font-bold text-small" style={{ color: COLORS.warning }}>
            <li>1. 스마트워치에서 심전도 파일을 컴퓨터로 옮깁니다.</li>
            <li>2. 아래 버튼을 눌러 CSV 파일을 선택합니다.</li>
            <li>3. 분석이 끝나면 심전도 그래프가 표시됩니다.</li>
          </ol>
        </div>

        {/* 드롭존 카드 */}
        <Card padding="lg" className="mb-6">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all"
            style={dragging
              ? { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft }
              : { borderColor: COLORS.border }}
            onMouseEnter={e => { if (!dragging) e.currentTarget.style.borderColor = COLORS.primary; }}
            onMouseLeave={e => { if (!dragging) e.currentTarget.style.borderColor = COLORS.border; }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              className="hidden"
            />
            {/* 업로드 아이콘을 옅은 청록 원 안에 넣어 포인트 */}
            <div
              className="w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4"
              style={{ backgroundColor: COLORS.primarySoft }}
            >
              <Upload className="w-10 h-10" style={{ color: COLORS.primary }} />
            </div>
            <p className="text-gray-700 mb-3 font-bold text-sub">
              파일을 여기에 끌어다 놓거나<br />탭하여 선택하세요
            </p>
            <p className="text-gray-500 font-bold text-small">지원 형식: CSV · 최대 100MB</p>
          </div>

          <div className="mt-5 flex justify-center">
            <div
              className="rounded-xl p-4 text-center w-40"
              style={{ backgroundColor: COLORS.infoBg }}
            >
              <Activity className="w-6 h-6 mx-auto mb-1" style={{ color: COLORS.info }} />
              <div className="font-bold text-small" style={{ color: COLORS.info }}>CSV</div>
              <div className="font-bold text-tiny" style={{ color: COLORS.accent }}>심전도 데이터</div>
            </div>
          </div>
        </Card>

        {/* 진행 상태 카드 */}
        {busy && (
          <Card padding="lg" className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: COLORS.primary, borderTopColor: "transparent" }} />
              <span className="text-gray-700 font-bold text-body">
                {phase === "uploading" ? "업로드 중..." : "분석 중... 잠시만 기다려 주세요"} {Math.round(progress)}%
              </span>
            </div>
            <div className="w-full rounded-full h-4" style={{ backgroundColor: COLORS.subtleBg }}>
              <div className="h-4 rounded-full transition-all"
                style={{ width: `${progress}%`, backgroundColor: COLORS.primary }} />
            </div>
            <p className="text-gray-500 mt-3 font-bold text-small">파일명: {fileName}</p>
          </Card>
        )}

        {/* 오류 카드 */}
        {phase === "error" && (
          <Card padding="lg" className="mb-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="w-10 h-10" style={{ color: COLORS.danger }} />
              <div>
                <p className="font-bold text-sub" style={{ color: COLORS.danger }}>업로드 실패</p>
                <p className="text-gray-600 font-bold mt-1 text-small">{errorMsg}</p>
              </div>
            </div>
          </Card>
        )}

        {/* 파일 선택 버튼 — 가장 강조되는 그라데이션 버튼 */}
        <Button
          variant="gradient"
          size="lg"
          fullWidth
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          loading={busy}
          icon={!busy ? <Upload className="w-6 h-6" /> : undefined}
        >
          {busy ? "처리 중..." : "파일 선택하고 올리기"}
        </Button>

        <div className="mt-5 space-y-2 font-bold text-small text-gray-500">
          <p>• 파일 올리기가 어려우시면 가족·보호자에게 도움을 요청하세요.</p>
        </div>
      </div>

      {/* 스캐닝 - 병원 모니터처럼 실시간으로 왼쪽→오른쪽 그려짐 */}
      {phase === "scanning" && chartData.length > 0 && (
        <div className={styles.fadein}>
          <MonitorChart data={chartData} revealPercent={revealProgress} />
        </div>
      )}

      {/* 결과 - 페이드 인 + 전체 그래프 */}
      {phase === "result" && result && (
        <div className={`${styles.fadein} space-y-6`}>
          <div className="font-bold mb-2 text-[1.1rem]" style={{ color: COLORS.primary }}>
            ✅ {(result.ecgPoints?.length ?? 0).toLocaleString()}개 샘플 · {sampleRate}Hz · 분석 완료
          </div>

          {chartData.length > 0 && (
            <ECGChart
              data={chartData}
              rPeaks={rPeaks}
              zoom={1}
              onZoomIn={() => { }}
              onZoomOut={() => { }}
              revealPercent={revealProgress}
              sampleRate={sampleRate}
            />
          )}
          {result.riskScore != null && (
            <RiskGauge score={result.riskScore} riskLevel={result.riskLevel} />
          )}

          {/* 다른 파일 올리기 — 보조 동작이라 outline */}
          <Button
            variant="outline"
            size="md"
            fullWidth
            onClick={() => {
              setPhase("upload");
              setResult(null);
              setFileName(null);
              setProgress(0);
            }}
          >
            다른 파일 올리기
          </Button>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-gray-500 font-bold text-small">
            <Info className="w-5 h-5 inline mr-2 text-gray-400" />
            이 서비스는 의료기기가 아니며 의사의 진단을 대신하지 않습니다.
          </div>
        </div>
      )}
    </div>
  );
}
