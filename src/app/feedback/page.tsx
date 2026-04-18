import type { Metadata } from "next";

import { updateFeedbackTicket } from "@/app/feedback/actions";
import { FeedbackCenterContent } from "@/features/feedback/components/feedback-center-content";
import { getFeedbackDashboard } from "@/features/feedback/get-feedback-dashboard";
import { FeedbackRepositoryDrizzle } from "@/features/feedback/feedback.repository.drizzle";
import { DashboardPageShell } from "@/features/shared/components/dashboard-page-shell";
import { requireAdminUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Feedback Center | Telkomsel Poin Merchant Dashboard",
  description: "Feedback center admin untuk membaca dan membalas feedback merchant.",
};

export default async function FeedbackPage() {
  const user = await requireAdminUser("/feedback");
  const data = await getFeedbackDashboard(new FeedbackRepositoryDrizzle());

  return (
    <DashboardPageShell sidebarWidth="16rem" user={user}>
      <FeedbackCenterContent data={data} onUpdate={updateFeedbackTicket} />
    </DashboardPageShell>
  );
}
