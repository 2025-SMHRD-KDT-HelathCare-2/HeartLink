// frontend/src/pages/ProfilePage.tsx
import { useState, useEffect } from "react";
import { Save, Check } from "lucide-react";
import { getMe, updateMe } from "../api/authApi";

// 질병 목록 (복용약 목록 상수는 기능 삭제로 함께 제거됨)
const DISEASES = ["고혈압 (혈압이 높음)", "당뇨 (혈당이 높음)", "부정맥 (심장 리듬 이상)", "심부전 (심장 기능 저하)", "협심증 (심장 혈관 막힘)", "뇌졸중 (뇌혈관 이상)", "고지혈증 (피 속 지방 과다)", "심방세동 (심장이 불규칙하게 뜀)"];

// -----------------------------------------------------------------------
// [도우미] 생년월일("YYYY-MM-DD")로 '만 나이'를 계산해 "만 OO세" 문자열로 돌려줍니다.
//   - 화면에 참고용으로 보여주기 위한 용도입니다. (실제 나이는 서버가 계산)
//   - 값이 없거나 이상하면 빈 문자열을 돌려줍니다.
// -----------------------------------------------------------------------
function calcAge(birthDate: string): string {
  if (!birthDate) return "";
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  if (age < 0 || age > 150) return "";
  return `만 ${age}세`;
}

// -----------------------------------------------------------------------
// [도우미] 서버에서 받은 birthDate(ISO 날짜 문자열)를
//          날짜 입력칸(type="date")이 알아듣는 "YYYY-MM-DD"로 잘라줍니다.
//   - 예: "1955-03-12T00:00:00.000Z" → "1955-03-12"
// -----------------------------------------------------------------------
function toDateInputValue(iso?: string): string {
  if (!iso) return "";
  return iso.split("T")[0];
}

export function ProfilePage() {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);   // 첫 정보 불러오는 중 여부
  const [submitting, setSubmitting] = useState(false); // 저장 진행 중 여부
  const [errorMsg, setErrorMsg] = useState("");   // 화면에 보여줄 오류 메시지

  // -----------------------------------------------------------------------
  // [변경] 입력값 상태(form)
  //   - 'age' → 'birthDate'로 교체
  //   - 'medications', 'medSearch' 삭제 (복용약 기능 제거)
  //   - 'height', 'weight' 삭제 (저장 계획 없음)
  // -----------------------------------------------------------------------
  const [form, setForm] = useState({
    birthDate: "",
    gender: "" as "" | "M" | "F",   // 서버가 쓰는 값 그대로 "M"/"F"로 저장
    diseases: [] as string[],
    agreeMedical: false,
  });

  // -----------------------------------------------------------------------
  // [추가] 화면이 처음 열릴 때, 서버에서 내 기존 정보를 불러와 form에 채웁니다.
  //   - 이렇게 하면 사용자가 예전에 입력한 값이 화면에 그대로 보입니다.
  // -----------------------------------------------------------------------
  useEffect(() => {
    let alive = true; // 화면을 빠르게 떠났을 때 잘못된 상태 변경을 막기 위한 안전장치

    (async () => {
      try {
        const me = await getMe();
        if (!alive) return;
        setForm(prev => ({
          ...prev,
          birthDate: toDateInputValue(me.birthDate),
          gender: me.gender ?? "",
          diseases: me.medicalHistory ?? [],
        }));
      } catch (err) {
        if (!alive) return;
        const message = err instanceof Error ? err.message : "정보를 불러오지 못했습니다.";
        setErrorMsg(message);
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => { alive = false; };
  }, []);

  const toggleDisease = (d: string) =>
    setForm(f => ({
      ...f,
      diseases: f.diseases.includes(d) ? f.diseases.filter(x => x !== d) : [...f.diseases, d],
    }));

  // -----------------------------------------------------------------------
  // [변경] 저장 버튼 눌렀을 때: 실제로 서버에 저장(updateMe)합니다.
  // -----------------------------------------------------------------------
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // 필수 동의 체크 확인
    if (!form.agreeMedical) {
      setErrorMsg("건강 정보 수집·이용에 동의해 주세요.");
      return;
    }

    try {
      setSubmitting(true);

      // 서버로 보낼 값 구성
      //   - 질병 목록은 medical_history 라는 이름으로 보냅니다. (서버 필드: medicalHistory)
      //   - birthDate / gender 도 함께 보냅니다. (값이 있을 때만)
      await updateMe({
        medical_history: form.diseases,
        ...(form.birthDate && { birthDate: form.birthDate }),
        ...(form.gender && { gender: form.gender }),
      });

      // 저장 성공 표시 (3초 뒤 원래 버튼으로 복귀)
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "저장에 실패했습니다. 잠시 후 다시 시도해 주세요.";
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  // 정보를 불러오는 동안 잠깐 보여줄 안내
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-gray-500 font-bold" style={{ fontSize: "1.1rem" }}>정보를 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="font-bold text-[#0D9488]" style={{ fontSize: "1.9rem" }}>건강 정보 등록</h1>
        <p className="text-gray-600 mt-2 font-bold" style={{ fontSize: "1.1rem" }}>
          입력하신 정보로 더 정확한 심장 건강 분석을 해드립니다.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 오류 메시지 (있을 때만 표시) */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 font-bold" style={{ fontSize: "1.05rem" }}>
            {errorMsg}
          </div>
        )}

        {/* Basic info */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-[#0D9488] font-bold mb-5" style={{ fontSize: "1.3rem" }}>기본 신체 정보</h3>
          <div className="grid grid-cols-2 gap-5">
            {/* 생년월일 (예전 '나이' 입력칸을 날짜 선택으로 교체) */}
            <div>
              <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>
                생년월일
                {form.birthDate && (
                  <span className="ml-2 text-[#0D9488]" style={{ fontSize: "0.95rem" }}>
                    ({calcAge(form.birthDate)})
                  </span>
                )}
              </label>
              <input
                type="date"
                value={form.birthDate}
                max={new Date().toISOString().split("T")[0]} // 미래 날짜 선택 방지
                onChange={e => setForm({ ...form, birthDate: e.target.value })}
                className="w-full px-4 py-4 border border-gray-200 rounded-xl focus:outline-none focus:border-[#0D9488] bg-gray-50 font-bold"
                style={{ minHeight: 56, fontSize: "1.15rem" }}
              />
            </div>

            {/* 성별 (서버가 쓰는 "M"/"F" 값으로 저장, 화면에는 한글로 표시) */}
            <div>
              <label className="block text-gray-700 mb-2 font-bold" style={{ fontSize: "1.1rem" }}>성별</label>
              <div className="flex gap-2">
                {([
                  { label: "남성", value: "M" },
                  { label: "여성", value: "F" },
                ] as const).map(g => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setForm({ ...form, gender: g.value })}
                    className={`flex-1 py-4 rounded-xl border-2 transition-all font-bold ${form.gender === g.value ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]" : "border-gray-200 text-gray-500"}`}
                    style={{ minHeight: 56, fontSize: "1rem" }}
                  >
                    {g.label}
                  </button>
                ))}
              </div>
            </div>

            {/* [삭제] 키(cm) / 몸무게(kg) 입력칸은 저장 계획이 없어 제거했습니다. */}
          </div>
        </div>

        {/* Diseases */}
        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-[#0D9488] font-bold mb-2" style={{ fontSize: "1.3rem" }}>현재 앓고 계신 질병</h3>
          <p className="text-gray-500 mb-4 font-bold" style={{ fontSize: "1rem" }}>현재 앓고 계신 병을 모두 선택해 주세요. 없으면 선택 안 하셔도 됩니다.</p>
          <div className="flex flex-wrap gap-3">
            {DISEASES.map(d => (
              <button
                key={d}
                type="button"
                onClick={() => toggleDisease(d)}
                className={`px-4 py-3 rounded-xl border-2 transition-all font-bold ${form.diseases.includes(d) ? "border-[#0D9488] bg-[#0D9488]/10 text-[#0D9488]" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                style={{ minHeight: 52, fontSize: "1rem" }}
              >
                {form.diseases.includes(d) && <span className="mr-1">✓</span>}
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* [삭제] '현재 드시는 약'(복용약) 영역 전체 제거 */}

        {/* Medical consent */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <label className="flex items-start gap-4 cursor-pointer">
            <input
              type="checkbox"
              checked={form.agreeMedical}
              onChange={e => setForm({ ...form, agreeMedical: e.target.checked })}
              className="mt-1 w-6 h-6 accent-[#0D9488]"
            />
            <span className="text-amber-800 leading-relaxed font-bold" style={{ fontSize: "1.05rem" }}>
              건강 정보 수집·이용에 동의합니다. (필수)<br />
              <span className="text-amber-700 font-normal">
                질병 정보는 심장 건강 분석에만 사용되며, 다른 곳에 제공되지 않습니다.
              </span>
            </span>
          </label>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full py-5 bg-gradient-to-r from-[#0D9488] to-[#0D9488] text-white rounded-xl hover:opacity-90 transition-all flex items-center justify-center gap-2 font-bold disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ minHeight: 60, fontSize: "1.2rem" }}
        >
          {submitting ? (
            "저장 중..."
          ) : saved ? (
            <><Check className="w-6 h-6" />저장 완료!</>
          ) : (
            <><Save className="w-6 h-6" />정보 저장하기</>
          )}
        </button>
      </form>
    </div>
  );
}
