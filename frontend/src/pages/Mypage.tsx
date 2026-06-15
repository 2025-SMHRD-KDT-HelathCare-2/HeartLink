import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Save, Check, UserPlus, ChevronLeft, User, Pill, Heart } from "lucide-react";
import api from "../api/authApi";

type Tab = "profile" | "guardian";

const DISEASES = ["고혈압", "당뇨", "부정맥", "심부전", "협심증", "뇌졸중", "고지혈증", "심방세동"];
const MEDICATIONS = ["아스피린", "와파린", "메트포르민", "리시노프릴", "암로디핀", "심바스타틴", "메트로프롤롤", "디곡신"];

export function MyPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");

  const [diseases, setDiseases] = useState<string[]>([]);
  const [medSearch, setMedSearch] = useState("");
  const [medications, setMedications] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [profileLoading, setProfileLoading] = useState(true);

  const [guardianEmail, setGuardianEmail] = useState("");
  const [guardianError, setGuardianError] = useState("");
  const [guardianSent, setGuardianSent] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    api.get("/auth/me")
      .then(res => {
        setDiseases(res.data.medical_history ?? []);
        setMedications(res.data.medications ?? []);
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, []);

  const toggleDisease = (d: string) =>
    setDiseases(prev =>
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d]
    );

  const addMed = (med: string) => {
    if (!medications.includes(med))
      setMedications(prev => [...prev, med]);
    setMedSearch("");
  };

  const filteredMeds = MEDICATIONS.filter(
    m => m.includes(medSearch) && !medications.includes(m)
  );

  const handleSaveProfile = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    setSaveError("");
    try {
      await api.patch("/auth/me", { medical_history: diseases, medications });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "저장 중 오류가 발생했습니다.");
    }
  };

  const handleGuardianRequest = async (e: { preventDefault(): void }) => {
    e.preventDefault();
    if (!guardianEmail.trim()) { setGuardianError("보호자 이메일을 입력해 주세요."); return; }
    setGuardianError("");
    setSending(true);
    setGuardianSent(false);
    try {
      await api.post("/guardians", { guardian_email: guardianEmail.trim() });
      setGuardianSent(true);
      setGuardianEmail("");
    } catch (err) {
      setGuardianError(err instanceof Error ? err.message : "요청 중 오류가 발생했습니다.");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto p-5">
      <div className="flex items-center gap-3 mb-7">
        <button
          onClick={() => navigate(-1)}
          className="p-2 rounded-xl hover:bg-gray-100 transition-colors"
        >
          <ChevronLeft className="w-6 h-6 text-gray-600" />
        </button>
        <div>
          <h1 className="font-black text-[#0A2647]" style={{ fontSize: "2rem" }}>마이페이지</h1>
          <p className="text-gray-500 font-bold" style={{ fontSize: "1rem" }}>
            {(user as any)?.nickname || (user as any)?.email || "사용자"}
          </p>
        </div>
      </div>

      <div className="flex bg-gray-100 rounded-xl p-1 mb-6">
        <button
          onClick={() => setTab("profile")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-bold ${tab === "profile" ? "bg-white shadow text-[#0A2647]" : "text-gray-500"}`}
          style={{ minHeight: 52, fontSize: "1.05rem" }}
        >
          <Heart className="w-5 h-5" />
          건강 정보 수정
        </button>
        <button
          onClick={() => setTab("guardian")}
          className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg transition-all font-bold ${tab === "guardian" ? "bg-white shadow text-[#0A2647]" : "text-gray-500"}`}
          style={{ minHeight: 52, fontSize: "1.05rem" }}
        >
          <UserPlus className="w-5 h-5" />
          보호자 등록
        </button>
      </div>

      {tab === "profile" && (
        profileLoading ? (
          <div className="text-center py-16 text-gray-400 font-bold" style={{ fontSize: "1.1rem" }}>불러오는 중...</div>
        ) : (
          <form onSubmit={handleSaveProfile} className="space-y-6">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-[#0A2647] font-black mb-2" style={{ fontSize: "1.3rem" }}>기저질환</h3>
              <p className="text-gray-500 mb-4 font-bold" style={{ fontSize: "1rem" }}>앓고 계신 질환을 모두 선택해 주세요.</p>
              <div className="flex flex-wrap gap-3">
                {DISEASES.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => toggleDisease(d)}
                    className={`px-4 py-3 rounded-xl border-2 transition-all font-bold ${diseases.includes(d) ? "border-[#0E8080] bg-[#0E8080]/10 text-[#0E8080]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                    style={{ minHeight: 52, fontSize: "1rem" }}
                  >
                    {diseases.includes(d) && <span className="mr-1">✓</span>}
                    {d}
                  </button>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-[#0A2647] font-black mb-2" style={{ fontSize: "1.3rem" }}>복용 중인 약</h3>
              <p className="text-gray-500 mb-4 font-bold" style={{ fontSize: "1rem" }}>약 이름을 검색해서 추가하세요.</p>
              <div className="relative">
                <Pill className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="약 이름 검색"
                  value={medSearch}
                  onChange={e => setMedSearch(e.target.value)}
                  className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E8080] bg-gray-50 font-bold"
                  style={{ fontSize: "1.05rem" }}
                />
                {medSearch && filteredMeds.length > 0 && (
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 z-10">
                    {filteredMeds.map(med => (
                      <button
                        key={med}
                        type="button"
                        onClick={() => addMed(med)}
                        className="w-full text-left px-4 py-4 hover:bg-gray-50 font-bold"
                        style={{ fontSize: "1.05rem" }}
                      >
                        {med}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {medications.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-4">
                  {medications.map(med => (
                    <span key={med} className="inline-flex items-center gap-1 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-bold" style={{ fontSize: "1rem" }}>
                      {med}
                      <button
                        type="button"
                        onClick={() => setMedications(prev => prev.filter(m => m !== med))}
                        className="hover:text-red-500 ml-1 text-lg"
                      >×</button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {saveError && (
              <p className="text-red-500 font-bold text-center" style={{ fontSize: "1rem" }}>{saveError}</p>
            )}

            <button
              type="submit"
              className="w-full py-5 bg-gradient-to-r from-[#0A2647] to-[#0E8080] text-white rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 font-black"
              style={{ minHeight: 64, fontSize: "1.2rem" }}
            >
              {saved ? <><Check className="w-6 h-6" />저장 완료!</> : <><Save className="w-6 h-6" />저장하기</>}
            </button>
          </form>
        )
      )}

      {tab === "guardian" && (
        <div className="space-y-6">
          <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-5">
            <p className="text-blue-800 font-bold leading-relaxed" style={{ fontSize: "1.05rem" }}>
              💡 보호자로 등록할 가족의 <strong>HeartLink 아이디(이메일)</strong>를 입력하면 등록 요청이 전송됩니다.<br />
              보호자가 요청을 수락하면 내 건강 상태를 확인할 수 있어요.
            </p>
          </div>

          <form onSubmit={handleGuardianRequest}>
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="text-[#0A2647] font-black mb-5" style={{ fontSize: "1.3rem" }}>보호자 등록 요청</h3>

              <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>보호자 아이디 (이메일)</label>
              <div className="relative mb-4">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="email"
                  placeholder="보호자의 이메일 주소"
                  value={guardianEmail}
                  onChange={e => { setGuardianEmail(e.target.value); setGuardianError(""); setGuardianSent(false); }}
                  className="w-full pl-12 pr-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0A2647] bg-gray-50 font-bold"
                  style={{ minHeight: 56, fontSize: "1.1rem" }}
                />
              </div>
              {guardianError && <p className="text-red-500 mb-3 font-bold" style={{ fontSize: "1rem" }}>{guardianError}</p>}
              {guardianSent && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4 flex items-center gap-3">
                  <Check className="w-5 h-5 text-green-500 flex-shrink-0" />
                  <p className="text-green-700 font-bold" style={{ fontSize: "1rem" }}>등록 요청을 보냈습니다. 보호자가 수락하면 연결돼요.</p>
                </div>
              )}
              <button
                type="submit"
                disabled={sending}
                className="w-full py-5 bg-[#0A2647] text-white rounded-xl hover:bg-[#144272] transition-colors flex items-center justify-center gap-2 font-black disabled:opacity-50"
                style={{ minHeight: 64, fontSize: "1.2rem" }}
              >
                <UserPlus className="w-6 h-6" />
                {sending ? "요청 중..." : "보호자 등록 요청 보내기"}
              </button>
            </div>
          </form>

          <p className="text-center text-gray-400 font-bold" style={{ fontSize: "1rem" }}>
            최대 3명까지 보호자를 등록할 수 있습니다.
          </p>
        </div>
      )}
    </div>
  );
}
