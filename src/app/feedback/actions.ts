"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireAdminUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { merchantFeedback } from "@/lib/db/schema";

const updateFeedbackSchema = z.object({
  id: z.coerce.number().int().positive(),
  status: z.enum(["open", "in_progress", "resolved", "canceled"]),
  reply: z.string().max(5000),
});

export async function updateFeedbackTicket(input: {
  id: string;
  status: "open" | "in_progress" | "resolved" | "canceled";
  reply: string;
}) {
  await requireAdminUser("/feedback");

  const parsed = updateFeedbackSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Payload update feedback tidak valid.");
  }

  const now = new Date().toISOString();
  const reply = parsed.data.reply.trim();

  await db
    .update(merchantFeedback)
    .set({
      status: parsed.data.status,
      reply: reply || null,
      repliedAt: reply ? now : null,
      updatedAt: now,
    })
    .where(eq(merchantFeedback.id, parsed.data.id));

  revalidatePath("/feedback");

  return { ok: true as const };
}
