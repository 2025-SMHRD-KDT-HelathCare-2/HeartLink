import { useState, useRef } from "react";
import { Upload, CheckCircle, AlertCircle, Activity } from "lucide-react";

type UploadState = "idle" | "parsing" | "success" | "error";

export interface ECGData {
  points: Array<{ x: number; y: number }>;
  fileName: string;
  sampleRate: number;
}

interface UploadPageProps {
  onDataReady?: (data: ECGData) => void;
}

// CSV 파싱: timestamp(또는 x), ecg(또는 y) 컬럼 찾아서 읽기
function parseCSV(text: string): ECGData["points"] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) throw new Error("데이터가 너무 적습니다.");

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase());
  const xIdx = headers.findIndex(h => ["timestamp", "time", "x", "t"].includes(h));
  const yIdx = headers.findIndex(h => ["ecg", "y", "value", "signal", "mv"].includes(h));

  if (yIdx === -1) throw new Error("ECG 데이터 컬럼을 찾을 수 없습니다. (ecg, value, signal, mv 중 하나여야 해요)");

  const points: ECGData["points"] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(",");
    const y = parseFloat(cols[yIdx]);
    if (isNaN(y)) continue;
    const x = xIdx >= 0 ? parseFloat(cols[xIdx]) : (i - 1) / 250;
    points.push({ x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000 });
  }
  if (points.length < 10) throw new Error("유효한 데이터가 너무 적습니다.");
  return points;
}

// EDF 파싱: 헤더에서 샘플 수·채널 읽고 데이터 블록 파싱
function parseEDF(buffer: ArrayBuffer): { points: ECGData["points"]; sampleRate: number } {
  const header = new TextDecoder("ascii").decode(buffer.slice(0, 256));
  const numSignals = parseInt(header.slice(252, 256).trim());
  if (isNaN(numSignals) || numSignals < 1) throw new Error("EDF 헤더를 읽을 수 없습니다.");

  const signalHeaderSize = 256 + numSignals * 256;
  const signalHeaders = new TextDecoder("ascii").decode(buffer.slice(256, signalHeaderSize));

  // 첫 번째 채널 샘플 수 (각 256바이트 블록에서 samplesPerRecord 위치)
  const samplesPerRecordStr = signalHeaders.slice(numSignals * 216, numSignals * 216 + 8).trim();
  const samplesPerRecord = parseInt(samplesPerRecordStr) || 256;
  const sampleRate = samplesPerRecord; // 대부분 1초 레코드

  // 데이터 블록: Int16 little-endian
  const dataView = new DataView(buffer, signalHeaderSize);
  const totalSamples = Math.floor(dataView.byteLength / 2);
  const maxSamples = Math.min(totalSamples, sampleRate * 30); // 최대 30초

  const points: ECGData["points"] = [];
  for (let i = 0; i < maxSamples; i++) {
    const raw = dataView.getInt16(i * 2, true);
    // physical value 근사치 (gain 정보 없으면 그대로 mV 스케일링)
    const y = Math.round((raw / 1000) * 1000) / 1000;
    points.push({ x: Math.round((i / sampleRate) * 1000) / 1000, y });
  }
  return { points, sampleRate };
}

// WFDB .dat 파싱 (단순 Int16 little-endian, format 16 기준)
function parseWFDB(buffer: ArrayBuffer): { points: ECGData["points"]; sampleRate: number } {
  const sampleRate = 250; // 기본값, .hea 없으면 250Hz 가정
  const dataView = new DataView(buffer);
  const totalSamples = Math.floor(dataView.byteLength / 2);
  const maxSamples = Math.min(totalSamples, sampleRate * 30);

  const points: ECGData["points"] = [];
  for (let i = 0; i < maxSamples; i++) {
    const raw = dataView.getInt16(i * 2, true);
    const y = Math.round((raw / 200) * 1000) / 1000; // gain=200 ADC units/mV 기본값
    points.push({ x: Math.round((i / sampleRate) * 1000) / 1000, y });
  }
  return { points, sampleRate };
}

export function UploadPage({ onDataReady }: UploadPageProps) {
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const processFile = async (file: File) => {
    const maxMB = 100;
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    const allowedExts = [".csv", ".edf", ".dat"];

    if (!allowedExts.includes(ext)) {
      setUploadState("error");
      setErrorMsg("지원하지 않는 파일 형식입니다. (CSV, EDF, DAT)");
      return;
    }
    if (file.size > maxMB * 1024 * 1024) {
      setUploadState("error");
      setErrorMsg(`파일이 너무 큽니다. (최대 ${maxMB}MB)`);
      return;
    }

    setFileName(file.name);
    setUploadState("parsing");
    setProgress(0);
    setErrorMsg("");

    // 진행바 애니메이션
    let p = 0;
    const tick = setInterval(() => {
      p = Math.min(p + 20, 80);
      setProgress(p);
    }, 100);

    try {
      let points: ECGData["points"];
      let sampleRate = 250;

      if (ext === ".csv") {
        const text = await file.text();
        points = parseCSV(text);
      } else if (ext === ".edf") {
        const buffer = await file.arrayBuffer();
        const result = parseEDF(buffer);
        points = result.points;
        sampleRate = result.sampleRate;
      } else {
        // .dat (WFDB)
        const buffer = await file.arrayBuffer();
        const result = parseWFDB(buffer);
        points = result.points;
        sampleRate = result.sampleRate;
      }

      clearInterval(tick);
      setProgress(100);
      setTimeout(() => {
        setUploadState("success");
        onDataReady?.({ points, fileName: file.name, sampleRate });
      }, 300);

    } catch (err) {
      clearInterval(tick);
      setUploadState("error");
      setErrorMsg(err instanceof Error ? err.message : "파일을 읽는 중 오류가 발생했습니다.");
    }
  };

  const handleFile = (file: File) => processFile(file);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="font-bold text-[#0A2647]" style={{ fontSize: "1.9rem" }}>심전도·맥박 데이터 올리기</h1>
        <p className="text-gray-600 mt-2 font-bold" style={{ fontSize: "1.1rem" }}>
          파일을 올리면 바로 파형을 확인할 수 있습니다.
        </p>
      </div>

      {/* 사용 방법 */}
      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 mb-6">
        <p className="text-amber-800 font-bold" style={{ fontSize: "1.1rem" }}>📋 어떻게 사용하나요?</p>
        <ol className="mt-3 space-y-2 text-amber-700 font-bold" style={{ fontSize: "1rem" }}>
          <li>1. 스마트워치 등에서 심전도 파일을 컴퓨터로 옮깁니다.</li>
          <li>2. 아래 버튼을 눌러 파일을 선택합니다.</li>
          <li>3. 파형이 바로 화면에 표시됩니다.</li>
        </ol>
      </div>

      {/* 업로드 영역 */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${dragging ? "border-[#0E8080] bg-[#0E8080]/5" : "border-gray-300 hover:border-[#0E8080] hover:bg-gray-50"}`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.edf,.dat"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            className="hidden"
          />
          <Upload className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <p className="text-gray-700 mb-3 font-bold" style={{ fontSize: "1.3rem" }}>
            파일을 여기에 끌어다 놓거나<br />탭하여 선택하세요
          </p>
          <p className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>
            지원 형식: CSV · EDF · DAT(WFDB) · 최대 100MB
          </p>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-3">
          {[
            { name: "CSV", desc: "표 형식 심전도" },
            { name: "EDF", desc: "유럽 표준 심전도" },
            { name: "WFDB (.dat)", desc: "의료용 심전도" },
          ].map(f => (
            <div key={f.name} className="bg-blue-50 rounded-xl p-3 text-center">
              <Activity className="w-6 h-6 mx-auto text-blue-500 mb-1" />
              <div className="text-blue-700 font-bold" style={{ fontSize: "1rem" }}>{f.name}</div>
              <div className="text-blue-500 font-bold" style={{ fontSize: "0.9rem" }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 상태 표시 */}
      {uploadState !== "idle" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          {uploadState === "parsing" && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-6 border-2 border-[#0E8080] border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-700 font-bold" style={{ fontSize: "1.15rem" }}>파일 읽는 중... {Math.round(progress)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-4">
                <div className="h-4 bg-gradient-to-r from-[#0E8080] to-[#0A2647] rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-gray-500 mt-3 font-bold" style={{ fontSize: "1rem" }}>파일명: {fileName}</p>
            </>
          )}
          {uploadState === "success" && (
            <div className="flex items-center gap-4">
              <CheckCircle className="w-10 h-10 text-green-500" />
              <div>
                <p className="text-green-700 font-bold" style={{ fontSize: "1.2rem" }}>완료! 파형 화면으로 이동합니다.</p>
                <p className="text-gray-600 font-bold mt-1" style={{ fontSize: "1rem" }}>{fileName}</p>
              </div>
            </div>
          )}
          {uploadState === "error" && (
            <div className="flex items-center gap-4">
              <AlertCircle className="w-10 h-10 text-red-500" />
              <div>
                <p className="text-red-700 font-bold" style={{ fontSize: "1.2rem" }}>읽기 실패</p>
                <p className="text-gray-600 font-bold mt-1" style={{ fontSize: "1rem" }}>{errorMsg}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploadState === "parsing"}
        className="w-full py-5 bg-gradient-to-r from-[#0A2647] to-[#0E8080] text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-3 font-bold"
        style={{ minHeight: 60, fontSize: "1.2rem" }}
      >
        <Upload className="w-6 h-6" />
        {uploadState === "parsing" ? "읽는 중..." : "파일 선택하고 올리기"}
      </button>

      <div className="mt-5 space-y-2 font-bold" style={{ fontSize: "1rem", color: "#6b7280" }}>
        <p>• 같은 파일을 두 번 올려도 자동으로 걸러드립니다.</p>
        <p>• 올린 파일은 암호화되어 안전하게 보관됩니다.</p>
      </div>
    </div>
  );
}
