import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";

import { requireAdminUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { merchantFeedback } from "@/lib/db/schema";
import { readFeedbackAttachment } from "@/lib/feedback-attachments";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_: Request, context: RouteContext) {
  await requireAdminUser("/feedback");
  const { id } = await context.params;

  const [row] = await db
    .select({
      attachmentKey: merchantFeedback.attachmentKey,
      attachmentFileName: merchantFeedback.attachmentFileName,
      attachmentMimeType: merchantFeedback.attachmentMimeType,
    })
    .from(merchantFeedback)
    .where(eq(merchantFeedback.id, Number(id)))
    .limit(1);

  if (!row?.attachmentKey) {
    return NextResponse.json({ error: "Attachment not found" }, { status: 404 });
  }

  try {
    const attachment = await readFeedbackAttachment(row.attachmentKey);
    return new NextResponse(attachment.content, {
      headers: {
        "Content-Type": row.attachmentMimeType || "application/octet-stream",
        "Content-Disposition": `inline; filename="${encodeURIComponent(row.attachmentFileName || "attachment")}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Attachment file is missing" }, { status: 404 });
  }
}
