export type FeedbackStatus = "open" | "in_progress" | "resolved" | "canceled";

export type FeedbackType = "report" | "critic" | "suggestion";

export type FeedbackEntry = {
  id: string;
  merchantKey: string;
  keyword: string;
  merchantName: string;
  uniqMerchant: string;
  userId: string;
  userEmail: string;
  username: string | null;
  type: FeedbackType;
  category: string;
  title: string;
  message: string;
  status: FeedbackStatus;
  attachment: {
    fileName: string | null;
    mimeType: string | null;
    size: number | null;
    downloadUrl: string;
  } | null;
  reply: string | null;
  repliedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type FeedbackDashboardData = {
  summary: {
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    canceled: number;
    replied: number;
  };
  feedback: FeedbackEntry[];
};

export interface FeedbackRepository {
  getFeedbackDashboardData(): Promise<FeedbackDashboardData>;
}
