import type {
  FeedbackDashboardData,
  FeedbackRepository,
} from "@/features/feedback/feedback.repository";

export async function getFeedbackDashboard(
  repo: FeedbackRepository,
): Promise<FeedbackDashboardData> {
  return repo.getFeedbackDashboardData();
}
