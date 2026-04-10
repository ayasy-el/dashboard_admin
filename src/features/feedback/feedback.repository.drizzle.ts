import { sql } from "drizzle-orm";

import type {
  FeedbackDashboardData,
  FeedbackEntry,
  FeedbackRepository,
} from "@/features/feedback/feedback.repository";
import { db } from "@/lib/db";

export class FeedbackRepositoryDrizzle implements FeedbackRepository {
  async getFeedbackDashboardData(): Promise<FeedbackDashboardData> {
    const rows = await db.execute(sql`
      select
        mf.id::text as id,
        mf.merchant_key::text as merchant_key,
        dm.keyword_code as keyword,
        dm.merchant_name as merchant_name,
        dm.uniq_merchant as uniq_merchant,
        mf.user_id::text as user_id,
        u.email as user_email,
        u.username as username,
        mf.type,
        mf.category,
        mf.title,
        mf.message,
        mf.status,
        mf.attachment_key,
        mf.attachment_file_name,
        mf.attachment_mime_type,
        mf.attachment_size,
        mf.reply,
        mf.replied_at::text as replied_at,
        mf.created_at::text as created_at,
        mf.updated_at::text as updated_at
      from merchant_feedback mf
      inner join dim_merchant dm on dm.merchant_key = mf.merchant_key
      inner join users u on u.id = mf.user_id
      order by mf.created_at desc, mf.id desc
    `);

    const feedback: FeedbackEntry[] = rows.rows.map((row) => ({
      id: String(row.id ?? ""),
      merchantKey: String(row.merchant_key ?? ""),
      keyword: String(row.keyword ?? ""),
      merchantName: String(row.merchant_name ?? ""),
      uniqMerchant: String(row.uniq_merchant ?? ""),
      userId: String(row.user_id ?? ""),
      userEmail: String(row.user_email ?? ""),
      username: row.username ? String(row.username) : null,
      type: row.type as FeedbackEntry["type"],
      category: String(row.category ?? ""),
      title: String(row.title ?? ""),
      message: String(row.message ?? ""),
      status: row.status as FeedbackEntry["status"],
      attachment: row.attachment_key
        ? {
            fileName: row.attachment_file_name ? String(row.attachment_file_name) : null,
            mimeType: row.attachment_mime_type ? String(row.attachment_mime_type) : null,
            size: row.attachment_size ? Number(row.attachment_size) : null,
            downloadUrl: `/api/feedback/${row.id}/attachment`,
          }
        : null,
      reply: row.reply ? String(row.reply) : null,
      repliedAt: row.replied_at ? String(row.replied_at) : null,
      createdAt: String(row.created_at ?? ""),
      updatedAt: String(row.updated_at ?? ""),
    }));

    return {
      summary: {
        total: feedback.length,
        open: feedback.filter((item) => item.status === "open").length,
        inProgress: feedback.filter((item) => item.status === "in_progress").length,
        resolved: feedback.filter((item) => item.status === "resolved").length,
        canceled: feedback.filter((item) => item.status === "canceled").length,
        replied: feedback.filter((item) => Boolean(item.reply?.trim())).length,
      },
      feedback,
    };
  }
}
