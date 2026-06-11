import { useState, useRef } from "react";
import { Upload, CheckCircle, AlertCircle, Activity } from "lucide-react";
import { useNavigate } from "react-router-dom";
import api from "../api/authApi";

export interface ECGResponse {
  ecgPoints: Array<{ x: number; y: number }>;
  rPeaks: number[];
  sampleRate: number;
  fileName: string;
}

type UploadState = "idle" | "uploading" | "success" | "error";

export function UploadPage() {
  const navigate = useNavigate();
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [progress, setProgress] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFile = async (file: File) => {
    const ext = "." + file.name.split(".").pop()?.toLowerCase();
    if (ext !== ".csv") {
      setUploadState("error");
      setErrorMsg("CSV 파일만 업로드할 수 있습니다.");
      return;
    }
    if (file.size > 100 * 1024 * 1024) {
      setUploadState("error");
      setErrorMsg("파일이 너무 큽니다. (최대 100MB)");
      return;
    }

    setFileName(file.name);
    setUploadState("uploading");
    setProgress(0);
    setErrorMsg("");

    // 진행바 애니메이션
    let p = 0;
    const tick = setInterval(() => {
      p = Math.min(p + 15, 80);
      setProgress(p);
    }, 150);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post("/ecg/upload", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      clearInterval(tick);
      setProgress(100);

      setTimeout(() => {
        setUploadState("success");
        // 백엔드 응답 데이터를 들고 visualization 페이지로 이동
        setTimeout(() => {
          navigate("/visualization", { state: { ecgData: res.data } });
        }, 800);
      }, 300);

    } catch (err) {
      clearInterval(tick);
      setUploadState("error");
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

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="font-black text-[#0A2647]" style={{ fontSize: "2rem" }}>심전도 파일 올리기</h1>
        <p className="text-gray-600 mt-2 font-bold" style={{ fontSize: "1.1rem" }}>
          스마트워치에서 받은 파일을 올리면 심전도 그래프를 바로 확인할 수 있어요.
        </p>
      </div>

      {/* 사용 방법 */}
      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-5 mb-6">
        <p className="text-amber-800 font-bold" style={{ fontSize: "1.1rem" }}>📋 어떻게 사용하나요?</p>
        <ol className="mt-3 space-y-2 text-amber-700 font-bold" style={{ fontSize: "1rem" }}>
          <li>1. 스마트워치에서 심전도 파일을 컴퓨터로 옮깁니다.</li>
          <li>2. 아래 버튼을 눌러 CSV 파일을 선택합니다.</li>
          <li>3. 업로드가 완료되면 심전도 그래프가 바로 표시됩니다.</li>
        </ol>
      </div>

      {/* 업로드 영역 */}
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

      {/* 상태 표시 */}
      {uploadState !== "idle" && (
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
          {uploadState === "uploading" && (
            <>
              <div className="flex items-center gap-3 mb-4">
                <div className="w-6 h-6 border-2 border-[#0E8080] border-t-transparent rounded-full animate-spin" />
                <span className="text-gray-700 font-bold" style={{ fontSize: "1.15rem" }}>업로드 중... {Math.round(progress)}%</span>
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
                <p className="text-green-700 font-bold" style={{ fontSize: "1.2rem" }}>완료! 심전도 그래프로 이동합니다.</p>
                <p className="text-gray-600 font-bold mt-1" style={{ fontSize: "1rem" }}>{fileName}</p>
              </div>
            </div>
          )}
          {uploadState === "error" && (
            <div className="flex items-center gap-4">
              <AlertCircle className="w-10 h-10 text-red-500" />
              <div>
                <p className="text-red-700 font-bold" style={{ fontSize: "1.2rem" }}>업로드 실패</p>
                <p className="text-gray-600 font-bold mt-1" style={{ fontSize: "1rem" }}>{errorMsg}</p>
              </div>
            </div>
          )}
        </div>
      )}

      <button
        onClick={() => fileRef.current?.click()}
        disabled={uploadState === "uploading"}
        className="w-full py-5 bg-gradient-to-r from-[#0A2647] to-[#0E8080] text-white rounded-xl hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-3 font-bold"
        style={{ minHeight: 64, fontSize: "1.2rem" }}
      >
        <Upload className="w-6 h-6" />
        {uploadState === "uploading" ? "업로드 중..." : "파일 선택하고 올리기"}
      </button>

      <div className="mt-5 space-y-2 font-bold" style={{ fontSize: "1rem", color: "#6b7280" }}>
        <p>• 올린 파일은 암호화되어 안전하게 보관됩니다.</p>
        <p>• 파일 올리기가 어려우시면 가족·보호자에게 도움을 요청하세요.</p>
      </div>
    </div>
  );
}