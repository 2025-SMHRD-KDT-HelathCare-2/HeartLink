// frontend/src/pages/ProfilePage.tsx
// =============================================================================
// 건강 정보 등록(프로필) 페이지
//
// [이 파일이 하는 일]
//   - 화면이 열리면 서버에서 내 기존 정보를 불러와 입력칸을 채웁니다.
//   - 생년월일/성별/앓고 있는 질병을 입력하고 '저장하기'를 누르면 서버에 반영됩니다.
//
// [1단계 리팩터링에서 바뀐 점 — 기능은 그대로, '겉모양 코드'만 정리]
//   1) 색상 하드코딩(#0D9488 등) → 디자인 토큰 클래스(primary 등)
//   2) 글자 크기 인라인 style(style={{ fontSize: ... }}) → 토큰 클래스(text-sub 등)
//   3) 반복되던 흰 카드 박스 → 공통 컴포넌트 <Card> / 제목은 <CardTitle>
//   4) 규격이 맞는 입력칸/버튼 → 공통 <Input> / <Button> 으로 교체
//   ※ 질병 선택 '칩' 버튼은 크기 규격이 공통 Button 과 달라(외형 보존 위해)
//      일반 button 으로 두고 색상/폰트 토큰만 정리했습니다.
//   ※ 화면에 보이는 결과(디자인/동작)는 이전과 똑같습니다.
// =============================================================================

import { useState, useEffect } from "react";
import { Save, Check } from "lucide-react";
import { getMe, updateMe } from "../api/authApi";
// 공통 UI 컴포넌트
//   - Card      : 흰색 둥근 카드 박스 (그림자 + 테두리)
//   - CardTitle : 카드 안의 민트색 제목
//   - Input     : 입력칸 (여기서는 생년월일 날짜 선택에 사용)
//   - Button    : 표준 버튼 (성별 선택, 저장 버튼)
import { Card, CardTitle, Input, Button } from "../components/ui";

// 질병 목록 (사용자가 선택할 수 있는 후보들)
const DISEASES = [
  "고혈압 (혈압이 높음)", "당뇨 (혈당이 높음)", "부정맥 (심장 리듬 이상)",
  "심부전 (심장 기능 저하)", "협심증 (심장 혈관 막힘)", "뇌졸중 (뇌혈관 이상)",
  "고지혈증 (피 속 지방 과다)", "심방세동 (심장이 불규칙하게 뜀)",
];

// -----------------------------------------------------------------------------
// [도우미] 생년월일("YYYY-MM-DD")로 '만 나이'를 계산해 "만 OO세" 문자열로 돌려줍니다.
//   - 화면에 참고용으로만 보여줍니다. (실제 나이는 서버가 계산)
//   - 값이 없거나 이상하면 빈 문자열을 돌려줍니다.
// -----------------------------------------------------------------------------
function calcAge(birthDate: string): string {
  if (!birthDate) return "";
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return "";

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  // 아직 올해 생일이 안 지났으면 한 살 빼줍니다.
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  if (age < 0 || age > 150) return "";
  return `만 ${age}세`;
}

// -----------------------------------------------------------------------------
// [도우미] 서버에서 받은 birthDate(ISO 날짜 문자열)를
//          날짜 입력칸(type="date")이 알아듣는 "YYYY-MM-DD"로 잘라줍니다.
//   - 예: "1955-03-12T00:00:00.000Z" → "1955-03-12"
// -----------------------------------------------------------------------------
function toDateInputValue(iso?: string): string {
  if (!iso) return "";
  return iso.split("T")[0];
}

export function ProfilePage() {
  const [saved, setSaved] = useState(false);           // 저장 직후 '완료' 표시 여부
  const [loading, setLoading] = useState(true);        // 첫 정보 불러오는 중 여부
  const [submitting, setSubmitting] = useState(false); // 저장 진행 중 여부
  const [errorMsg, setErrorMsg] = useState("");        // 화면에 보여줄 오류 메시지

  // 입력값 상태
  //   - birthDate : "YYYY-MM-DD" 문자열
  //   - gender    : 서버가 쓰는 "M"/"F" 값 그대로 저장
  //   - diseases  : 선택한 질병 이름들의 목록
  //   - agreeMedical : 동의 체크 여부(필수)
  const [form, setForm] = useState({
    birthDate: "",
    gender: "" as "" | "M" | "F",
    diseases: [] as string[],
    agreeMedical: false,
  });

  // ---------------------------------------------------------------------------
  // [최초 1회] 화면이 열릴 때 서버에서 내 기존 정보를 불러와 form 에 채웁니다.
  //   - alive 플래그: 데이터를 받기 전에 화면을 떠나면, 이미 사라진 화면의
  //     상태를 바꾸려다 생기는 경고/오류를 막는 안전장치입니다.
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let alive = true;

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

  // 질병 칩을 눌렀을 때: 이미 선택돼 있으면 빼고, 아니면 추가합니다.
  const toggleDisease = (d: string) =>
    setForm(f => ({
      ...f,
      diseases: f.diseases.includes(d)
        ? f.diseases.filter(x => x !== d)
        : [...f.diseases, d],
    }));

  // ---------------------------------------------------------------------------
  // [저장] 저장 버튼을 눌렀을 때 실행됩니다.
  // ---------------------------------------------------------------------------
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    // 동의 체크는 필수입니다.
    if (!form.agreeMedical) {
      setErrorMsg("건강 정보 수집·이용에 동의해 주세요.");
      return;
    }

    try {
      setSubmitting(true);

      // 서버로 보낼 값 구성 (생년월일/성별은 값이 있을 때만 포함)
      await updateMe({
        medical_history: form.diseases,
        ...(form.birthDate && { birthDate: form.birthDate }),
        ...(form.gender && { gender: form.gender }),
      });

      // 저장 성공 표시 → 3초 뒤 원래 버튼으로 복귀
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      const message = err instanceof Error
        ? err.message
        : "저장에 실패했습니다. 잠시 후 다시 시도해 주세요.";
      setErrorMsg(message);
    } finally {
      setSubmitting(false);
    }
  };

  // 정보를 불러오는 동안 잠깐 보여줄 안내 화면
  if (loading) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <p className="text-gray-500 font-bold text-[1.1rem]">정보를 불러오는 중입니다...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      {/* 페이지 상단 제목 영역 */}
      <div className="mb-8">
        <h1 className="font-bold text-primary text-[1.9rem]">건강 정보 등록</h1>
        <p className="text-gray-600 mt-2 font-bold text-[1.1rem]">
          입력하신 정보로 더 정확한 심장 건강 분석을 해드립니다.
        </p>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 오류 메시지 (있을 때만 표시) */}
        {errorMsg && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 font-bold text-[1.05rem]">
            {errorMsg}
          </div>
        )}

        {/* ===== 카드 1: 기본 신체 정보 ===== */}
        <Card padding="lg">
          {/* CardTitle 기본 크기는 text-sub(1.3rem)라 원본과 동일합니다. */}
          <CardTitle className="mb-5">기본 신체 정보</CardTitle>

          <div className="grid grid-cols-2 gap-5">
            {/* 생년월일 입력 (선택하면 옆에 '만 OO세'를 함께 보여줌) */}
            <div>
              <label className="block text-gray-700 mb-2 font-bold text-[1.1rem]">
                생년월일
                {form.birthDate && (
                  <span className="ml-2 text-primary text-[0.95rem]">
                    ({calcAge(form.birthDate)})
                  </span>
                )}
              </label>
              {/* 공통 Input 사용. 이 칸은 왼쪽 아이콘 없이 쓰던 칸이라
                  leftIcon 을 지정하지 않습니다(원본과 동일하게 패딩 왼쪽 기본). */}
              <Input
                type="date"
                value={form.birthDate}
                max={new Date().toISOString().split("T")[0]} // 미래 날짜 선택 방지
                onChange={e => setForm({ ...form, birthDate: e.target.value })}
              />
            </div>

            {/* 성별 선택 (화면엔 한글, 저장은 "M"/"F") */}
            <div>
              <label className="block text-gray-700 mb-2 font-bold text-[1.1rem]">성별</label>
              <div className="flex gap-2">
                {([
                  { label: "남성", value: "M" },
                  { label: "여성", value: "F" },
                ] as const).map(g => (
                  <Button
                    key={g.value}
                    variant={form.gender === g.value ? "selected" : "outline"}
                    size="md"
                    fullWidth
                    onClick={() => setForm({ ...form, gender: g.value })}
                  >
                    {g.label}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </Card>

        {/* ===== 카드 2: 현재 앓고 있는 질병 ===== */}
        <Card padding="lg">
          <CardTitle className="mb-2">현재 앓고 계신 질병</CardTitle>
          <p className="text-gray-500 mb-4 font-bold text-small">
            현재 앓고 계신 병을 모두 선택해 주세요. 없으면 선택 안 하셔도 됩니다.
          </p>

          {/* 질병 '칩' 버튼들 — 가변 폭에 min-height 52 라서 공통 Button 규격과 달라
              외형 보존을 위해 일반 button 으로 두고 색상/폰트 토큰만 정리했습니다. */}
          <div className="flex flex-wrap gap-3">
            {DISEASES.map(d => {
              const selected = form.diseases.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDisease(d)}
                  className={`px-4 py-3 rounded-xl border-2 transition-all font-bold text-small ${
                    selected
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-gray-200 text-gray-600 hover:border-gray-300"
                  }`}
                  style={{ minHeight: 52 }}
                >
                  {/* 선택된 질병 앞에는 체크 표시(✓)를 붙입니다. */}
                  {selected && <span className="mr-1">✓</span>}
                  {d}
                </button>
              );
            })}
          </div>
        </Card>

        {/* ===== 동의 영역 (필수) ===== */}
        {/* 노란 경고 톤은 amber 계열 고정 색이라 토큰 대상이 아니므로 그대로 둡니다. */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6">
          <label className="flex items-start gap-4 cursor-pointer">
            <input
              type="checkbox"
              checked={form.agreeMedical}
              onChange={e => setForm({ ...form, agreeMedical: e.target.checked })}
              // accent-primary: 체크박스 색을 디자인 토큰(민트)으로 지정
              className="mt-1 w-6 h-6 accent-primary"
            />
            <span className="text-amber-800 leading-relaxed font-bold text-[1.05rem]">
              건강 정보 수집·이용에 동의합니다. (필수)
              <br />
              <span className="text-amber-700 font-normal">
                질병 정보는 심장 건강 분석에만 사용되며, 다른 곳에 제공되지 않습니다.
              </span>
            </span>
          </label>
        </div>

        {/* ===== 저장 버튼 ===== */}
        {/* 상태에 따라 내용이 3가지로 바뀝니다: 저장중 / 저장완료 / 평소
            (loading prop 을 쓰면 스피너가 함께 나오므로, 원본처럼 텍스트만
             바꾸기 위해 loading 대신 disabled 를 사용합니다.) */}
        <Button type="submit" variant="primary" size="lg" fullWidth disabled={submitting}>
          {submitting ? (
            "저장 중..."
          ) : saved ? (
            <>
              <Check className="w-6 h-6" />
              저장 완료!
            </>
          ) : (
            <>
              <Save className="w-6 h-6" />
              정보 저장하기
            </>
          )}
        </Button>
      </form>
    </div>
  );
}
