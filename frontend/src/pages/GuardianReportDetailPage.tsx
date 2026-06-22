import { useParams } from "react-router-dom";
import { ReportDetailPage } from "../components/ReportDetailCommon";

export function GuardianReportDetailPage() {
  const { memberId } = useParams();
  return <ReportDetailPage mode="guardian" memberId={memberId} />;
}