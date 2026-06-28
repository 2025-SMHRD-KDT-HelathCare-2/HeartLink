// frontend/src/pages/Registerpage.tsx
// =============================================================================
// 회원가입 페이지
//
// [이 파일이 하는 일]
//   - 사용자/보호자 회원가입 폼을 보여주고, 입력값을 검사한 뒤 서버로 보냅니다.
//
// [1단계 리팩터링에서 바뀐 점 — 기능은 그대로, '겉모양 코드'만 정리]
//   1) 색상 하드코딩(#0D9488 등) → 디자인 토큰 클래스(primary 등)로 교체
//   2) 글자 크기 인라인 style(style={{ fontSize: ... }}) → 토큰 클래스(text-sub 등)
//   3) 반복되던 입력창/버튼 코드 → 공통 컴포넌트 <Input>, <Button> 으로 교체
//   ※ 화면에 보이는 결과(디자인/동작)는 이전과 똑같습니다.
// =============================================================================

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart, Eye, EyeOff, Lock, Mail, User, Shield,
  Calendar, CheckCircle,
} from "lucide-react";
import { register, type RegisterPayload } from "../api/authApi";
import { SocialLoginButtons } from "../components/auth/SocialLoginButtons";
import { PhoneVerification } from "../components/auth/PhoneVerification";

// 공통 UI 컴포넌트를 한 줄로 불러옵니다.
//   - Button: 모든 버튼의 표준 모양/동작을 담당
//   - Input : 아이콘 + 입력창 + 에러 메시지를 한 번에 처리
// (참고) 이 페이지에는 '필수/선택' 배지를 보여주는 전용 라벨이 따로 필요해서,
//        공통 FieldLabel 대신 아래에서 RegisterFieldLabel 을 별도로 정의해 씁니다.
import { Button, Input } from "../components/ui";

type Role = "user" | "guardian";

// -----------------------------------------------------------------------------
// [전용 라벨] 입력 항목 위에 붙는 제목 라벨
//   - 오른쪽에 '필수'(빨강) 또는 '선택'(회색) 배지를 함께 보여줍니다.
//   - 공통 FieldLabel 은 별표(*)만 붙이는 단순한 형태라서, 이 페이지에서는
//     배지 형태가 필요해 이름을 RegisterFieldLabel 로 두어 따로 유지합니다.
// -----------------------------------------------------------------------------
function RegisterFieldLabel({ text, required }: { text: string; required?: boolean }) {
  return (
    <label className="flex items-center gap-2 text-gray-700 mb-2 font-bold text-[1.1rem]">
      {text}
      {required ? (
        // 필수 항목 배지: 연한 빨강 배경 + 빨강 글씨
        <span className="px-2 py-0.5 rounded-md bg-red-100 text-red-600 font-bold text-[0.8rem]">
          필수
        </span>
      ) : (
        // 선택 항목 배지: 연한 회색 배경 + 회색 글씨
        <span className="px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 font-bold text-[0.8rem]">
          선택
        </span>
      )}
    </label>
  );
}

// -----------------------------------------------------------------------------
// [안내 말풍선] 회원 유형(사용자/보호자)을 고르면 그에 맞는 설명을 보여줍니다.
//   - 유형을 바꿀 때 잠깐 사라졌다(150ms) 다시 나타나는 '부드러운 전환' 효과가 있습니다.
//   - visible 상태에 따라 투명도(opacity)와 위치(translate)가 바뀌면서 애니메이션됩니다.
// -----------------------------------------------------------------------------
function RoleToast({ role }: { role: Role }) {
  const [visible, setVisible] = useState(false);
  const [displayRole, setDisplayRole] = useState<Role>(role);

  // 처음 화면에 뜰 때: 50ms 뒤 서서히 나타나게 함
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 50);
    return () => clearTimeout(t);
  }, []);

  // 유형이 바뀔 때: 먼저 숨기고 → 150ms 뒤 내용 교체 → 다시 나타냄
  useEffect(() => {
    setVisible(false);
    const t = setTimeout(() => {
      setDisplayRole(role);
      requestAnimationFrame(() => setVisible(true));
    }, 150);
    return () => clearTimeout(t);
  }, [role]);

  const isUser = displayRole === "user";

  return (
    <div
      // bg-primary/10 = 민트색의 10% 투명 배경, border-primary/30 = 민트 30% 테두리
      // (원래 코드는 사용자/보호자 둘 다 같은 민트 스타일이라, 분기 없이 합쳤습니다.)
      className={`flex items-start gap-3 px-4 py-3 rounded-xl border font-bold mb-4 transition-all duration-500 bg-primary/10 border-primary/30 text-primary ${
        visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-1"
      }`}
      style={{ fontSize: "0.95rem" }}
    >
      <span>
        {isUser
          ? "측정하는 본인의 페이지입니다. 잘 모르실 경우 보호자와 함께 진행해 주세요."
          : "측정 결과를 지켜볼 수 있는 보호자 계정입니다."}
      </span>
    </div>
  );
}

// -----------------------------------------------------------------------------
// [성공 모달] 가입이 끝나면 화면 전체를 덮는 안내 창을 띄웁니다.
//   - fixed inset-0 = 화면 전체를 덮음, bg-black/50 = 반투명 검정 배경
//   - 버튼을 누르면 onClose() 가 실행되어 로그인 페이지로 이동합니다.
// -----------------------------------------------------------------------------
function SuccessModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-sm text-center">
        <div className="flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mx-auto mb-5">
          <CheckCircle className="w-12 h-12 text-green-500" />
        </div>
        <h2 className="text-primary font-black mb-3 text-title">가입 완료!</h2>
        <p className="text-gray-600 font-bold mb-7 leading-relaxed text-[1.1rem]">
          HeartLink 회원이 되셨습니다.
          <br />
          로그인 후 서비스를 이용하세요.
        </p>
        {/* 공통 Button 사용: primary(민트) + lg(큰 크기) + 가로 꽉 채움 */}
        <Button variant="primary" size="lg" fullWidth onClick={onClose}>
          로그인하러 가기
        </Button>
      </div>
    </div>
  );
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>("user");          // 선택된 회원 유형
  const [showPassword, setShowPassword] = useState(false); // 비밀번호 보기/숨기기
  const [submitting, setSubmitting] = useState(false);     // 가입 처리 중 여부
  const [showSuccess, setShowSuccess] = useState(false);   // 성공 모달 표시 여부
  const [errors, setErrors] = useState<Record<string, string>>({}); // 항목별 에러 메시지

  // ---------------------------------------------------------------------------
  // [입력값 상태] 사용자가 입력한 모든 값을 한 곳에 모아 둡니다.
  //   - birthDate: 생년월일을 "YYYY-MM-DD" 문자열로 저장 (예: "1955-03-12")
  //   - gender   : "" (미선택) / "M" (남) / "F" (여)
  //   - medical_history: 쉼표로 구분된 과거 병력 텍스트
  // ---------------------------------------------------------------------------
  const [form, setForm] = useState({
    email: "", password: "", passwordConfirm: "", nickname: "",
    birthDate: "", gender: "" as "" | "M" | "F",
    medical_history: "",
    phone: "",
  });

  // 전화번호 인증 완료 여부 (PhoneVerification 컴포넌트가 알려줌)
  const [phoneVerified, setPhoneVerified] = useState(false);

  // 특정 항목 하나만 골라서 값을 바꾸는 도우미 함수
  const setField = (key: string, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  // ---------------------------------------------------------------------------
  // [입력값 검사] 서버로 보내기 전에 잘못된 값이 없는지 확인합니다.
  //   - 문제가 있으면 { 항목이름: "에러 메시지" } 형태로 모아서 돌려줍니다.
  // ---------------------------------------------------------------------------
  const validate = () => {
    const errs: Record<string, string> = {};
    if (!phoneVerified) errs.phone = "전화번호 인증을 완료해 주세요.";
    if (!form.email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/))
      errs.email = "올바른 이메일 주소를 입력해 주세요.";
    if (form.password.length < 8)
      errs.password = "비밀번호는 8글자 이상이어야 합니다.";
    if (form.password !== form.passwordConfirm)
      errs.passwordConfirm = "비밀번호가 일치하지 않습니다.";
    if (!form.nickname.trim()) errs.nickname = "닉네임을 입력해 주세요.";

    // 생년월일은 '선택' 항목이라, 값을 입력했을 때만 검사합니다.
    if (form.birthDate) {
      const birth = new Date(form.birthDate); // 입력 문자열 → 날짜 객체
      const today = new Date();               // 오늘 날짜
      const ageNum = today.getFullYear() - birth.getFullYear(); // 대략적인 나이

      if (Number.isNaN(birth.getTime())) {
        errs.birthDate = "올바른 생년월일을 선택해 주세요.";   // 날짜로 해석 불가
      } else if (birth > today) {
        errs.birthDate = "생년월일은 오늘 이후 날짜가 될 수 없습니다."; // 미래 날짜
      } else if (ageNum > 150) {
        errs.birthDate = "생년월일을 다시 확인해 주세요.";     // 비현실적인 값
      }
    }

    return errs;
  };

  // 쉼표(,)로 구분된 글자를 배열로 바꾸는 도우미 (예: "고혈압, 당뇨" → ["고혈압","당뇨"])
  const toArray = (text: string) =>
    text.split(",").map((s) => s.trim()).filter((s) => s.length > 0);

  // ---------------------------------------------------------------------------
  // [폼 제출] 회원가입 버튼을 눌렀을 때 실행됩니다.
  // ---------------------------------------------------------------------------
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); // 브라우저 기본 새로고침 동작 막기
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return; // 에러가 하나라도 있으면 중단

    // 서버로 보낼 데이터 묶음 만들기 (값이 있는 항목만 포함)
    const payload: RegisterPayload = {
      email: form.email,
      password: form.password,
      nickname: form.nickname,
      role,
      phone: form.phone.replace(/[^0-9]/g, ""), // 숫자만 남기기
    };
    if (form.birthDate) payload.birthDate = form.birthDate; // 예: "1955-03-12"
    if (form.gender) payload.gender = form.gender;
    payload.medical_history = toArray(form.medical_history);

    try {
      setSubmitting(true);
      await register(payload); // 서버에 가입 요청
      setShowSuccess(true);    // 성공하면 모달 띄우기
    } catch (err) {
      const message = err instanceof Error ? err.message : "회원가입에 실패했습니다.";
      setErrors({ global: message }); // 전체 에러 영역에 메시지 표시
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* 가입 성공 시에만 모달 표시. 닫으면 로그인 페이지로 이동 */}
      {showSuccess && <SuccessModal onClose={() => navigate("/login")} />}

      {/* 전체 배경: 민트 그라데이션 (primary → primary-mid → primary) */}
      <div className="min-h-screen bg-gradient-to-br from-primary via-primary-mid to-primary flex items-center justify-center p-4 py-10">
        <div className="w-full max-w-md">
          {/* 상단 로고 영역 */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 rounded-full mb-4 backdrop-blur-sm">
              <Heart className="w-12 h-12 text-white fill-current" />
            </div>
            <h1 className="text-white font-bold text-hero">회원가입</h1>
            <p className="text-white/80 mt-2 text-body">HeartLink와 함께 심장 건강을 지켜요</p>
          </div>

          {/* 흰색 카드: 실제 입력 폼이 들어가는 영역 */}
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <p className="text-gray-500 mb-6 font-bold text-small">
              <span className="text-red-500">필수</span> 항목을 입력해 주세요. 건강 정보(
              <span className="text-gray-500">선택</span>)를 입력하시면 더 정확한 분석을 받을 수 있어요.
            </p>

            {/* 회원 유형 선택 (사용자 / 보호자) */}
            <div className="mb-3">
              <RegisterFieldLabel text="회원 유형" required />
              <div className="flex gap-3">
                {/* 선택된 유형은 'selected'(민트 강조), 아니면 'outline'(회색 테두리) */}
                <Button
                  variant={role === "user" ? "selected" : "outline"}
                  size="md"
                  fullWidth
                  icon={<User className="w-6 h-6" />}
                  onClick={() => setRole("user")}
                >
                  사용자
                </Button>
                <Button
                  variant={role === "guardian" ? "selected" : "outline"}
                  size="md"
                  fullWidth
                  icon={<Shield className="w-6 h-6" />}
                  onClick={() => setRole("guardian")}
                >
                  가족·보호자
                </Button>
              </div>
            </div>

            {/* 선택한 유형에 대한 안내 말풍선 */}
            <RoleToast role={role} />

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* 전체 에러(서버 실패 등) 표시 영역 */}
              {errors.global && (
                <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 font-bold text-small">
                  {errors.global}
                </div>
              )}

              {/* ===== 기본 정보 섹션 ===== */}
              <div className="pt-1">
                <h2 className="text-primary font-bold mb-4 pb-2 border-b-2 border-gray-100 text-sub">
                  기본 정보
                </h2>

                {/* 전화번호 인증 (별도 컴포넌트가 입력 + 인증을 모두 처리) */}
                <PhoneVerification
                  phone={form.phone}
                  onPhoneChange={(v) => setField("phone", v)}
                  onVerifiedChange={setPhoneVerified}
                />
                {errors.phone && (
                  <p className="text-red-500 mb-3 font-bold text-small">{errors.phone}</p>
                )}

                {/* 이메일 입력: 공통 Input 사용 (왼쪽 메일 아이콘 + 에러 메시지 자동 처리) */}
                <div className="mb-5">
                  <RegisterFieldLabel text="이메일 주소" required />
                  <Input
                    type="email"
                    placeholder="example@email.com"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    leftIcon={<Mail className="w-6 h-6" />}
                    error={errors.email}
                  />
                </div>

                {/* 비밀번호 입력: 오른쪽 눈 아이콘으로 보기/숨기기 토글 */}
                <div className="mb-5">
                  <RegisterFieldLabel text="비밀번호" required />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="8글자 이상 입력"
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    leftIcon={<Lock className="w-6 h-6" />}
                    error={errors.password}
                    rightSlot={
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="text-gray-400 hover:text-gray-600"
                      >
                        {showPassword ? <EyeOff className="w-6 h-6" /> : <Eye className="w-6 h-6" />}
                      </button>
                    }
                  />
                </div>

                {/* 비밀번호 확인 입력 (위 비밀번호와 같은 보기/숨기기 상태를 공유) */}
                <div className="mb-5">
                  <RegisterFieldLabel text="비밀번호 확인" required />
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="비밀번호를 다시 입력"
                    value={form.passwordConfirm}
                    onChange={(e) => setField("passwordConfirm", e.target.value)}
                    leftIcon={<Lock className="w-6 h-6" />}
                    error={errors.passwordConfirm}
                  />
                </div>

                {/* 닉네임 입력 */}
                <div>
                  <RegisterFieldLabel text="닉네임" required />
                  <Input
                    type="text"
                    placeholder="사용하실 이름을 입력"
                    value={form.nickname}
                    onChange={(e) => setField("nickname", e.target.value)}
                    leftIcon={<User className="w-6 h-6" />}
                    error={errors.nickname}
                  />
                </div>
              </div>

              {/* ===== 건강 정보 섹션 (사용자 유형일 때만 표시) ===== */}
              {role === "user" && (
                <div className="pt-3">
                  <h2 className="text-primary font-bold mb-1 pb-2 border-b-2 border-gray-100 text-sub">
                    건강 정보
                  </h2>
                  <p className="text-gray-400 mb-4 font-bold text-tiny">
                    선택 입력이며, 나중에 프로필에서 추가할 수 있어요.
                  </p>

                  {/* 생년월일: 브라우저 기본 날짜 선택기(type="date") 사용.
                      max(오늘)을 지정해 미래 날짜는 아예 못 고르게 막습니다. */}
                  <div className="mb-5">
                    <RegisterFieldLabel text="생년월일" />
                    <Input
                      type="date"
                      value={form.birthDate}
                      max={new Date().toISOString().split("T")[0]} // 오늘까지만 선택 가능
                      onChange={(e) => setField("birthDate", e.target.value)}
                      leftIcon={<Calendar className="w-6 h-6" />}
                      error={errors.birthDate}
                    />
                  </div>

                  {/* 성별 선택 (남성 / 여성). 선택된 쪽이 민트색으로 강조됨 */}
                  <div className="mb-5">
                    <RegisterFieldLabel text="성별" />
                    <div className="flex gap-3">
                      <Button
                        variant={form.gender === "M" ? "selected" : "outline"}
                        size="md"
                        fullWidth
                        onClick={() => setField("gender", "M")}
                      >
                        남성
                      </Button>
                      <Button
                        variant={form.gender === "F" ? "selected" : "outline"}
                        size="md"
                        fullWidth
                        onClick={() => setField("gender", "F")}
                      >
                        여성
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* 회원가입 제출 버튼: 처리 중이면 스피너 + '가입 처리 중...' 표시 */}
              <Button type="submit" variant="primary" size="lg" fullWidth loading={submitting}>
                {submitting ? "가입 처리 중..." : "회원가입"}
              </Button>
            </form>

            {/* 소셜 로그인 버튼들 (Google / Naver / Kakao) */}
            <SocialLoginButtons role={role} />

            {/* 하단: 이미 회원이면 로그인 페이지로 이동 */}
            <div className="mt-6 pt-6 border-t border-gray-100 text-center">
              <span className="text-gray-500 font-bold text-small">이미 회원이신가요? </span>
              <button
                onClick={() => navigate("/login")}
                className="text-primary font-bold underline text-small"
              >
                로그인
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
