import { useState } from "react";
import { Save, Check } from "lucide-react";

const DISEASES = ["고혈압 (혈압이 높음)", "당뇨 (혈당이 높음)", "부정맥 (심장 리듬 이상)", "심부전 (심장 기능 저하)", "협심증 (심장 혈관 막힘)", "뇌졸중 (뇌혈관 이상)", "고지혈증 (피 속 지방 과다)", "심방세동 (심장이 불규칙하게 뜀)"];
const MEDICATIONS = ["아스피린", "와파린", "메트포르민", "리시노프릴", "암로디핀", "심바스타틴", "메트로프롤롤", "디곡신"];

export function ProfilePage() {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    age: "",
    gender: "",
    height: "",
    weight: "",
    diseases: [] as string[],
    medications: [] as string[],
    medSearch: "",
    agreeMedical: false,
  });

  const toggleDisease = (d: string) =>
    setForm(f => ({
      ...f,
      diseases: f.diseases.includes(d) ? f.diseases.filter(x => x !== d) : [...f.diseases, d],
    }));

  const addMedication = (med: string) => {
    if (!form.medications.includes(med))
      setForm(f => ({ ...f, medications: [...f.medications, med], medSearch: "" }));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  const filteredMeds = MEDICATIONS.filter(
    m => m.includes(form.medSearch) && !form.medications.includes(m)
  );

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="font-bold text-[#0A2647]" style={{ fontSize: "1.9rem" }}>건강 정보 등록</h1>
        <p className="text-gray-600 mt-2 font-bold" style={{ fontSize: "1.1rem" }}>
          입력하신 정보로 더 정확한 심장 건강 분석을 해드립니다.
        </p>
      </div>



      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-[#0A2647] font-bold mb-5" style={{ fontSize: "1.3rem" }}>기본 신체 정보</h3>
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>나이 (세)</label>
              <input
                type="number"
                min={0}
                max={120}
                placeholder="예: 72"
                value={form.age}
                onChange={e => setForm({ ...form, age: e.target.value })}
                className="w-full px-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E8080] bg-gray-50 font-bold"
                style={{ minHeight: 56, fontSize: "1.15rem" }}
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>성별</label>
              <div className="flex gap-2">
                {["남성", "여성", "기타"].map(g => (
                  <button
                    key={g}
                    type="button"
                    onClick={() => setForm({ ...form, gender: g })}
                    className={`flex-1 py-4 rounded-xl border-2 transition-all font-bold ${form.gender === g ? "border-[#0E8080] bg-[#0E8080]/10 text-[#0E8080]" : "border-gray-200 text-gray-500"}`}
                    style={{ minHeight: 56, fontSize: "1rem" }}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>키 (cm)</label>
              <input
                type="number"
                placeholder="예: 165"
                value={form.height}
                onChange={e => setForm({ ...form, height: e.target.value })}
                className="w-full px-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E8080] bg-gray-50 font-bold"
                style={{ minHeight: 56, fontSize: "1.15rem" }}
              />
            </div>

            <div>
              <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>몸무게 (kg)</label>
              <input
                type="number"
                placeholder="예: 60"
                value={form.weight}
                onChange={e => setForm({ ...form, weight: e.target.value })}
                className="w-full px-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E8080] bg-gray-50 font-bold"
                style={{ minHeight: 56, fontSize: "1.15rem" }}
              />
            </div>
          </div>
        </div>

        {/* Diseases */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-[#0A2647] font-bold mb-2" style={{ fontSize: "1.3rem" }}>현재 앓고 계신 질병</h3>
          <p className="text-gray-500 mb-4 font-bold" style={{ fontSize: "1rem" }}>현재 앓고 계신 병을 모두 선택해 주세요. 없으면 선택 안 하셔도 됩니다.</p>
          <div className="flex flex-wrap gap-3">
            {DISEASES.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDisease(d)}
                className={`px-4 py-3 rounded-xl border-2 transition-all font-bold ${form.diseases.includes(d) ? "border-[#0E8080] bg-[#0E8080]/10 text-[#0E8080]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                style={{ minHeight: 52, fontSize: "1rem" }}
              >
                {form.diseases.includes(d) && <span className="mr-1">✓</span>}
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Medications */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-[#0A2647] font-bold mb-2" style={{ fontSize: "1.3rem" }}>현재 드시는 약</h3>
          <p className="text-gray-500 mb-4 font-bold" style={{ fontSize: "1rem" }}>약 봉투나 약 상자에 적힌 약 이름을 입력하면 목록에서 선택할 수 있어요. 잘 모르시면 병원 진료 기록을 참고해 주세요.</p>
          <div className="relative">
            <input
              type="text"
              placeholder="약 이름 검색"
              value={form.medSearch}
              onChange={e => setForm({ ...form, medSearch: e.target.value })}
              className="w-full px-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0E8080] bg-gray-50 font-bold"
              style={{ minHeight: 56, fontSize: "1.1rem" }}
            />
            {form.medSearch && filteredMeds.length > 0 && (
              <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-xl shadow-lg mt-1 z-10">
                {filteredMeds.map(med => (
                  <button
                    key={med}
                    type="button"
                    onClick={() => addMedication(med)}
                    className="w-full text-left px-4 py-4 hover:bg-gray-50 transition-colors font-bold"
                    style={{ minHeight: 52, fontSize: "1.1rem" }}
                  >
                    {med}
                  </button>
                ))}
              </div>
            )}
          </div>
          {form.medications.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {form.medications.map(med => (
                <span key={med} className="inline-flex items-center gap-1 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg font-bold" style={{ fontSize: "1rem" }}>
                  {med}
                  <button
                    type="button"
                    onClick={() => setForm(f => ({ ...f, medications: f.medications.filter(m => m !== med) }))}
                    className="hover:text-red-500 ml-1 text-lg"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Medical consent */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <label className="flex items-start gap-4 cursor-pointer">
            <input
              type="checkbox"
              checked={form.agreeMedical}
              onChange={e => setForm({ ...form, agreeMedical: e.target.checked })}
              className="mt-1 w-6 h-6 accent-[#0E8080]"
            />
            <span className="text-amber-800 leading-relaxed font-bold" style={{ fontSize: "1.05rem" }}>
              건강 정보 수집·이용에 동의합니다. (필수)<br />
              <span className="text-amber-700 font-normal">
                질병 및 복용약 정보는 심장 건강 분석에만 사용되며, 다른 곳에 제공되지 않습니다.
              </span>
            </span>
          </label>
        </div>

        <button
          type="submit"
          className="w-full py-5 bg-gradient-to-r from-[#0A2647] to-[#0E8080] text-white rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 font-bold"
          style={{ minHeight: 60, fontSize: "1.2rem" }}
        >
          {saved ? (
            <><Check className="w-6 h-6" />저장 완료!</>
          ) : (
            <><Save className="w-6 h-6" />정보 저장하기</>
          )}
        </button>
      </form>
    </div>
  );
}
