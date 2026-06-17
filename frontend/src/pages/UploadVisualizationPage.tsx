import { useState, useRef, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Upload, AlertCircle, Activity, Info, Heart } from "lucide-react";
import api from "../api/authApi";
import { useToast } from "../context/ToastContext";
import { ECGChart } from "../components/charts/ECGChart";
import { RiskGauge } from "../components/charts/RiskGauge";

type Phase = "upload" | "uploading" | "processing" | "error" | "result";

interface ECGResult {
  ecgPoints: number[];
  rPeaks: number[];
  sampleRate: number;
  riskLevel?: "상" | "중" | "하";
  riskScore?: number | null;
}

const DEFAULT_SAMPLE_RATE = 250;

export function UploadVisualizationPage() {
  const navigate = useNavigate();
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

  const chartData = useMemo(() => {
    if (!result?.ecgPoints?.length) return [];
    return result.ecgPoints.map((y, i) => ({
      x: Math.round((i / sampleRate) * 1000) / 1000,
      y,
    }));
  }, [result, sampleRate]);

  const rPeaks = useMemo(() => {
    if (!result?.rPeaks?.length) return [];
    const maxIdx = result.ecgPoints?.length || 0;
    const looksLikeIndex = result.rPeaks.every(v => Number.isInteger(v) && v <= maxIdx);
    if (looksLikeIndex) {
      return result.rPeaks.map(idx => Math.round((idx / sampleRate) * 1000) / 1000);
    }
    return result.rPeaks;
  }, [result, sampleRate]);

  // 결과가 준비되면 reveal 애니메이션 시작 (왼쪽 → 오른쪽 물결)
  useEffect(() => {
    if (phase !== "result") return;
    if (!chartData.length) return;
    setRevealProgress(5);
    let raf: number;
    const duration = 1400; // 1.4초에 걸쳐 전체 reveal
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = now - start;
      const p = Math.min((elapsed / duration) * 100, 100);
      setRevealProgress(p);
      if (p < 100) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase, chartData.length]);

  const pollMeasurement = async (measurementId: string) => {
    const maxAttempts = 30;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(r => setTimeout(r, 2000));
      const res = await api.get(`/measurements/${measurementId}`);
      const data = res.data;
      if (data.status === "completed") return data;
      if (data.status === "failed") throw new Error("분석에 실패했습니다.");
      setProgress(prev => Math.min(prev + 2, 95));
    }
    throw new Error("분석이 너무 오래 걸립니다. 잠시 후 다시 확인해 주세요.");
  };

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

      const res = await api.post("/measurements", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      const { measurementId } = res.data;
      setPhase("processing");
      setProgress(20);

      const data = await pollMeasurement(measurementId);

      const riskLevelMap: Record<string, "상" | "중" | "하"> = { high: "상", mid: "중", low: "하" };
      const riskLevel = riskLevelMap[data.analysis?.riskLevel] ?? "하";
      const riskScore = data.analysis?.riskScore ?? null;

      setResult({
        ecgPoints: data.ecgWaveformLite ?? [],
        rPeaks: data.rPeaks ?? [],
        sampleRate: data.samplingRate ?? 250,
        riskLevel,
        riskScore,
      });
      setPhase("result");

      // 위험도 '상'이면 토스트로 알림 (보호자에게는 백엔드가 별도 발송)
      if (riskLevel === "상") {
        showToast({
          level: "상",
          title: "위험 신호가 감지되었어요",
          message: "심장이 불규칙하게 뛰는 증상이 있어요. 내 건강 결과를 확인해 주세요.",
        });
      }
      // 중/하는 사용자에게 토스트 없음 (보호자에게만 백엔드가 알림)

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

  const showUploadCard = phase !== "result";

  return (
    <div className="max-w-3xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="font-black text-[#0A2647]" style={{ fontSize: "2rem" }}>심전도 파일 올리기</h1>
        <p className="text-gray-600 mt-2 font-bold" style={{ fontSize: "1.1rem" }}>
          스마트워치에서 받은 파일을 올리면 심전도 그래프를 확인할 수 있어요.
        </p>
      </div>

      {/* 업로드 카드 - 결과 나오면 페이드 아웃 */}
      <div
        className={`transition-all duration-700 ${
          showUploadCard ? "opacity-100 max-h-[1000px]" : "opacity-0 max-h-0 overflow-hidden pointer-events-none"
        }`}
      >
        <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 mb-6">
          <p className="text-amber-800 font-bold" style={{ fontSize: "1.1rem" }}>📋 어떻게 사용하나요?</p>
          <ol className="mt-3 space-y-2 text-amber-700 font-bold" style={{ fontSize: "1rem" }}>
            <li>1. 스마트워치에서 심전도 파일을 컴퓨터로 옮깁니다.</li>
            <li>2. 아래 버튼을 눌러 CSV 파일을 선택합니다.</li>
            <li>3. 분석이 끝나면 심전도 그래프가 표시됩니다.</li>
          </ol>
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
              dragging ? "border-[#0E8080] bg-[#0E8080]/5" : "border-gray-300 hover:border-[#0E8080] hover:bg-gray-50"
            }`}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
              className="hidden"
            />
            <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />
            <p className="text-gray-700 mb-3 font-bold" style={{ fontSize: "1.3rem" }}>
              파일을 여기에 끌어다 놓거나<br />탭하여 선택하세요
            </p>
            <p className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>
              지원 형식: CSV · 최대 100MB
            </p>
          </div>

          <div className="mt-5 flex justify-center">
            <div className="bg-blue-50 rounded-xl p-4 text-center w-40">
              <Activity className="w-6 h-6 mx-auto text-blue-500 mb-1" />
              <div className="text-blue-700 font-bold" style={{ fontSize: "1rem" }}>CSV</div>
              <div className="text-blue-500 font-bold" style={{ fontSize: "0.9rem" }}>심전도 데이터</div>
            </div>
          </div>
        </div>

        {/* 진행 상태 */}
        {(phase === "uploading" || phase === "processing") && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-6 h-6 border-2 border-[#0E8080] border-t-transparent rounded-full animate-spin" />
              <span className="text-gray-700 font-bold" style={{ fontSize: "1.15rem" }}>
                {phase === "uploading" ? "업로드 중..." : "분석 중... 잠시만 기다려 주세요"} {Math.round(progress)}%
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-4">
              <div className="h-4 bg-gradient-to-r from-[#0E8080] to-[#0A2647] rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
            <p className="text-gray-500 mt-3 font-bold" style={{ fontSize: "1rem" }}>파일명: {fileName}</p>
          </div>
        )}

        {phase === "error" && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center gap-4">
              <AlertCircle className="w-10 h-10 text-red-500" />
              <div>
                <p className="text-red-700 font-bold" style={{ fontSize: "1.2rem" }}>업로드 실패</p>
                <p className="text-gray-600 font-bold mt-1" style={{ fontSize: "1rem" }}>{errorMsg}</p>
              </div>
            </div>
          </div>
        )}

        <button
          onClick={() => fileRef.current?.click()}
          disabled={phase === "uploading" || phase === "processing"}
          className="w-full py-5 bg-gradient-to-r from-[#0A2647] to-[#0E8080] text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-3 font-bold"
          style={{ minHeight: 64, fontSize: "1.2rem" }}
        >
          <Upload className="w-6 h-6" />
          {phase === "uploading" || phase === "processing" ? "처리 중..." : "파일 선택하고 올리기"}
        </button>

        <div className="mt-5 space-y-2 font-bold" style={{ fontSize: "1rem", color: "#6b7280" }}>
          <p>• 올린 파일은 암호화되어 안전하게 보관됩니다.</p>
          <p>• 파일 올리기가 어려우시면 가족·보호자에게 도움을 요청하세요.</p>
        </div>
      </div>

      {/* 결과 - 페이드 인 + 물결 reveal */}
      {phase === "result" && result && (
        <div className="animate-fadein space-y-6">
          <div className="text-[#0E8080] font-bold mb-2" style={{ fontSize: "1.1rem" }}>
            ✅ {(result.ecgPoints?.length ?? 0).toLocaleString()}개 샘플 · {sampleRate}Hz · 분석 완료
          </div>

          {chartData.length > 0 && (
            <ECGChart
              data={chartData}
              rPeaks={rPeaks}
              zoom={1}
              onZoomIn={() => {}}
              onZoomOut={() => {}}
              revealPercent={revealProgress}
            />
          )}
          {result.riskScore != null && <RiskGauge score={result.riskScore} />}

          {result.riskLevel === "상" && (
            <button
              onClick={() => navigate("/")}
              className="w-full py-5 bg-gradient-to-r from-[#DC2626] to-[#B91C1C] text-white rounded-xl hover:opacity-90 transition-all font-black flex items-center justify-center gap-2 shadow-lg"
              style={{ minHeight: 64, fontSize: "1.2rem" }}
            >
              <Heart className="w-6 h-6 fill-current" />
              내 건강 결과 자세히 보기
            </button>
          )}

          <button
            onClick={() => {
              setPhase("upload");
              setResult(null);
              setFileName(null);
              setProgress(0);
            }}
            className="w-full py-4 border-2 border-[#0A2647] text-[#0A2647] rounded-xl hover:bg-[#0A2647]/5 transition-all font-bold"
            style={{ minHeight: 56, fontSize: "1.1rem" }}
          >
            다른 파일 올리기
          </button>

          <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-gray-500 font-bold" style={{ fontSize: "1rem" }}>
            <Info className="w-5 h-5 inline mr-2 text-gray-400" />
            이 서비스는 의료기기가 아니며 의사의 진단을 대신하지 않습니다.
          </div>
        </div>
      )}

      <style>{`
        @keyframes fadein {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadein {
          animation: fadein 0.6s ease-out;
        }
      `}</style>
    </div>
  );
}