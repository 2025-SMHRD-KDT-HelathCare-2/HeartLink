// ============================================================================
// UserReportDetailPage
// - 라우트 /report-detail/:type/:id 에 연결되는 "사용자용" 래퍼.
// - 실제 화면은 공통 컴포넌트 ReportDetailPage 가 그립니다.
// - 사용자 모드는 memberId 가 필요 없으므로 mode 만 넘깁니다.
// ============================================================================
import { ReportDetailPage } from "../components/ReportDetailCommon";

export default function UserReportDetailPage() {
  return <ReportDetailPage mode="user" />;
}
