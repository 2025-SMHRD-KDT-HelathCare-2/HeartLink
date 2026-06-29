// ============================================================================
// GuardianReportDetailPage
// - 라우트 /guardian-report-detail/:userId/:type/:id 에 연결되는 "보호자용" 래퍼.
// - 주소의 :userId 를 useParams 로 꺼내 공통 컴포넌트에 memberId 로 넘깁니다.
// ============================================================================
import { useParams } from "react-router-dom";
import { ReportDetailPage } from "../components/ReportDetailCommon";

export default function GuardianReportDetailPage() {
  // 주소 /guardian-report-detail/:userId/:type/:id 의 :userId
  const { userId } = useParams();
  return <ReportDetailPage mode="guardian" memberId={userId} />;
}
