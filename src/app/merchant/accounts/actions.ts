"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { hashPassword, requireAdminUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { dimMerchant, userAccounts } from "@/lib/db/schema";

const accountSchema = z.object({
  email: z.string().trim().email().max(320),
  username: z.string().trim().min(2).max(120),
  isActive: z.boolean().optional(),
});

const updateAccountSchema = accountSchema.extend({
  userId: z.coerce.number().int().positive(),
});

const deleteAccountSchema = z.object({
  userId: z.coerce.number().int().positive(),
});

const assignMerchantsSchema = z.object({
  userId: z.coerce.number().int().positive(),
  merchantKeys: z.array(z.string().uuid()).min(1),
});

const removeMerchantsSchema = z.object({
  userId: z.coerce.number().int().positive(),
  merchantKeys: z.array(z.string().uuid()).min(1),
});

const ensureUserExists = async (userId: number) => {
  const [userRow] = await db
    .select({ id: userAccounts.id })
    .from(userAccounts)
    .where(eq(userAccounts.id, userId))
    .limit(1);

  return Boolean(userRow);
};

export async function createMerchantAccount(input: {
  email: string;
  username: string;
  isActive?: boolean;
}) {
  await requireAdminUser("/account-management");

  const parsed = accountSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Payload create account tidak valid.");
  }

  const passwordHash = await hashPassword(crypto.randomUUID());
  const now = new Date().toISOString();

  const [created] = await db
    .insert(userAccounts)
    .values({
      email: parsed.data.email.trim().toLowerCase(),
      username: parsed.data.username.trim(),
      passwordHash,
      isActive: parsed.data.isActive ?? true,
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: userAccounts.id });

  revalidatePath("/account-management");

  return { ok: true as const, userId: created.id };
}

export async function updateMerchantAccount(input: {
  userId: number | string;
  email: string;
  username: string;
  isActive?: boolean;
}) {
  await requireAdminUser("/account-management");

  const parsed = updateAccountSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Payload update account tidak valid.");
  }

  const exists = await ensureUserExists(parsed.data.userId);
  if (!exists) {
    throw new Error("User account tidak ditemukan.");
  }

  const now = new Date().toISOString();

  await db
    .update(userAccounts)
    .set({
      email: parsed.data.email.trim().toLowerCase(),
      username: parsed.data.username.trim(),
      isActive: parsed.data.isActive ?? true,
      updatedAt: now,
    })
    .where(eq(userAccounts.id, parsed.data.userId));

  revalidatePath("/account-management");

  return { ok: true as const };
}

export async function deleteMerchantAccount(input: { userId: number | string }) {
  await requireAdminUser("/account-management");

  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Payload delete account tidak valid.");
  }

  const exists = await ensureUserExists(parsed.data.userId);
  if (!exists) {
    throw new Error("User account tidak ditemukan.");
  }

  await db.transaction(async (trx) => {
    await trx
      .update(dimMerchant)
      .set({ userAccountId: null })
      .where(eq(dimMerchant.userAccountId, parsed.data.userId));

    await trx.delete(userAccounts).where(eq(userAccounts.id, parsed.data.userId));
  });

  revalidatePath("/account-management");

  return { ok: true as const };
}

export async function assignMerchantsToAccount(input: {
  userId: number | string;
  merchantKeys: string[];
}) {
  await requireAdminUser("/account-management");

  const parsed = assignMerchantsSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Payload assign merchant tidak valid.");
  }

  const exists = await ensureUserExists(parsed.data.userId);
  if (!exists) {
    throw new Error("User account tidak ditemukan.");
  }

  const validMerchants = await db
    .select({ merchantKey: dimMerchant.merchantKey })
    .from(dimMerchant)
    .where(inArray(dimMerchant.merchantKey, Array.from(new Set(parsed.data.merchantKeys))));

  if (validMerchants.length !== new Set(parsed.data.merchantKeys).size) {
    throw new Error("Ada merchant yang tidak ditemukan.");
  }

  await db
    .update(dimMerchant)
    .set({ userAccountId: parsed.data.userId })
    .where(inArray(dimMerchant.merchantKey, Array.from(new Set(parsed.data.merchantKeys))));

  revalidatePath("/account-management");

  return { ok: true as const };
}

export async function removeMerchantsFromAccount(input: {
  userId: number | string;
  merchantKeys: string[];
}) {
  await requireAdminUser("/account-management");

  const parsed = removeMerchantsSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error("Payload remove merchant tidak valid.");
  }

  const exists = await ensureUserExists(parsed.data.userId);
  if (!exists) {
    throw new Error("User account tidak ditemukan.");
  }

  await db
    .update(dimMerchant)
    .set({ userAccountId: null })
    .where(
      and(
        eq(dimMerchant.userAccountId, parsed.data.userId),
        inArray(dimMerchant.merchantKey, Array.from(new Set(parsed.data.merchantKeys))),
      ),
  );

  revalidatePath("/account-management");

  return { ok: true as const };
}
