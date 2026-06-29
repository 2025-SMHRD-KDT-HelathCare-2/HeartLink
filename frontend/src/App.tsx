// ============================================================================
// App.tsx
//
// 앱의 가장 바깥 껍데기입니다. 여기서 하는 일은 딱 두 가지입니다.
//   (1) 앱 전체가 공유해야 하는 "Context Provider"들을 바깥에서 감싸고,
//   (2) 그 안에 실제 화면 길잡이인 <AppRouter /> 를 둡니다.
//
// ※ Provider 순서(중첩 순서)에 주의하세요.
//   안쪽 컴포넌트(AppRouter 등)는 자기를 감싼 "바깥 Provider"의 값만 쓸 수 있습니다.
//   useAuth() 는 AuthProvider 안에서만 동작하므로,
//   AuthProvider 가 AppRouter 보다 반드시 "바깥"에 있어야 합니다.
// ============================================================================

import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";              // 있으면 사용
import { LastViewedReportProvider } from "./context/LastViewedReportContext"; // 있으면 사용
import AppRouter from "./routes/AppRouter";

export default function App() {
  return (
    // 가장 바깥: 인증 상태(로그인/역할/세션확인)를 앱 전체에 제공
    <AuthProvider>
      {/* 그다음: 토스트 알림을 앱 전체에서 띄울 수 있게 제공 */}
      <ToastProvider>
        {/* 그다음: 마지막으로 본 리포트 정보를 공유 */}
        <LastViewedReportProvider>
          {/* 가장 안쪽: 실제 화면을 그리는 라우터 */}
          <AppRouter />
        </LastViewedReportProvider>
      </ToastProvider>
    </AuthProvider>
  );
}
