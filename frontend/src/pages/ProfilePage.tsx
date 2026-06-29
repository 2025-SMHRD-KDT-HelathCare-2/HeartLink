// ProfilePage.tsx

// frontend/src/pages/ProfilePage.tsx
// =============================================================================
// 건강 정보 등록(프로필) 페이지
//
// [디자인 리뉴얼 포인트]
//   1) 상단 제목 → 청록→블루 그라데이션 헤더 배너 (<Card variant="gradient">)
//   2) 오류 박스 / 질병 칩 / 동의 영역 색상을 tokens.ts(COLORS) 로 정리
//   3) 카드/입력칸/버튼은 기존 공용 <Card>/<Input>/<Button> 유지
//   ※ 정보 조회/저장/검증 로직은 100% 동일
// =============================================================================

import { useState, useEffect } from "react";
import { Save, Check } from "lucide-react";
import { getMe, updateMe } from "../api/authApi";
import { Card, CardTitle, Input, Button } from "../components/ui";
import { COLORS } from "../styles/tokens";

// 질병 목록 (사용자가 선택할 수 있는 후보들)
const DISEASES = [
  "고혈압 (혈압이 높음)", "당뇨 (혈당이 높음)", "부정맥 (심장 리듬 이상)",
  "심부전 (심장 기능 저하)", "협심증 (심장 혈관 막힘)", "뇌졸중 (뇌혈관 이상)",
  "고지혈증 (피 속 지방 과다)", "심방세동 (심장이 불규칙하게 뜀)",
];

// 생년월일("YYYY-MM-DD")로 '만 나이'를 계산해 "만 OO세" 문자열로 반환
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

// 서버 birthDate(ISO)를 type="date" 입력칸용 "YYYY-MM-DD"로 변환
function toDateInputValue(iso?: string): string {
  if (!iso) return "";
  return iso.split("T")[0];
}

export function ProfilePage() {
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [form, setForm] = useState({
    birthDate: "",
    gender: "" as "" | "M" | "F",
    diseases: [] as string[],
    agreeMedical: false,
  });

  // [최초 1회] 서버에서 내 기존 정보를 불러와 form 에 채움
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

  const toggleDisease = (d: string) =>
    setForm(f => ({
      ...f,
      diseases: f.diseases.includes(d)
        ? f.diseases.filter(x => x !== d)
        : [...f.diseases, d],
    }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");

    if (!form.agreeMedical) {
      setErrorMsg("건강 정보 수집·이용에 동의해 주세요.");
      return;
    }

    try {
      setSubmitting(true);
      await updateMe({
        medical_history: form.diseases,
        ...(form.birthDate && { birthDate: form.birthDate }),
        ...(form.gender && { gender: form.gender }),
      });
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
      {/* ───────── 상단 그라데이션 헤더 배너 ───────── */}
      <Card variant="gradient" padding="lg" className="mb-8">
        <h1 className="font-black text-hero leading-tight">건강 정보 등록</h1>
        <p className="mt-2 font-bold text-body opacity-90">
          입력하신 정보로 더 정확한 심장 건강 분석을 해드립니다.
        </p>
      </Card>

      <form onSubmit={handleSave} className="space-y-6">
        {/* 오류 메시지 (있을 때만 표시) — 토큰 색상 */}
        {errorMsg && (
          <div
            className="border rounded-xl p-4 font-bold text-[1.05rem]"
            style={{ backgroundColor: COLORS.dangerBg, borderColor: COLORS.dangerBorder, color: COLORS.danger }}
          >
            {errorMsg}
          </div>
        )}

        {/* ===== 카드 1: 기본 신체 정보 ===== */}
        <Card padding="lg">
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

          {/* 질병 '칩' 버튼들 — 가변 폭 + min-height 52 라서 외형 보존 위해
              일반 button 으로 두고 선택색은 COLORS 토큰을 인라인으로 적용 */}
          <div className="flex flex-wrap gap-3">
            {DISEASES.map(d => {
              const selected = form.diseases.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  onClick={() => toggleDisease(d)}
                  className="px-4 py-3 rounded-xl border-2 transition-all font-bold text-small"
                  style={selected
                    ? { borderColor: COLORS.primary, backgroundColor: COLORS.primarySoft, color: COLORS.primary }
                    : { borderColor: COLORS.border, color: COLORS.body }}
                  onMouseEnter={(e) => { if (!selected) e.currentTarget.style.borderColor = COLORS.faint; }}
                  onMouseLeave={(e) => { if (!selected) e.currentTarget.style.borderColor = COLORS.border; }}
                >
                  {selected && <span className="mr-1">✓</span>}
                  {d}
                </button>
              );
            })}
          </div>
        </Card>

        {/* ===== 동의 영역 (필수) — 주의(warning) 톤 토큰 ===== */}
        <div
          className="border rounded-2xl p-6"
          style={{ backgroundColor: COLORS.warningBg, borderColor: COLORS.warningBorder }}
        >
          <label className="flex items-start gap-4 cursor-pointer">
            <input
              type="checkbox"
              checked={form.agreeMedical}
              onChange={e => setForm({ ...form, agreeMedical: e.target.checked })}
              className="mt-1 w-6 h-6 accent-primary"
            />
            <span className="leading-relaxed font-bold text-[1.05rem]" style={{ color: COLORS.warning }}>
              건강 정보 수집·이용에 동의합니다. (필수)
              <br />
              <span className="font-normal" style={{ color: COLORS.warning, opacity: 0.85 }}>
                질병 정보는 심장 건강 분석에만 사용되며, 다른 곳에 제공되지 않습니다.
              </span>
            </span>
          </label>
        </div>

        {/* ===== 저장 버튼 ===== */}
        <Button type="submit" variant="gradient" size="lg" fullWidth disabled={submitting}>
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
