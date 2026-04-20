import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";

import { and, asc, desc, eq, isNull, lte, gte, or, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/lib/db";
import { programBannerAssets, providerBanners } from "@/lib/db/schema";

const bannerPayloadSchema = z.object({
  title: z.string().trim().min(1, "Title wajib diisi").max(160, "Title terlalu panjang"),
  subtitle: z.string().trim().min(1, "Subtitle wajib diisi").max(240, "Subtitle terlalu panjang"),
  cta: z.string().trim().min(1, "CTA wajib diisi").max(80, "CTA terlalu panjang"),
  imageUrl: z.string().trim().min(1, "Image URL wajib diisi").max(500, "Image URL terlalu panjang"),
  isActive: z.boolean().default(true),
  sortOrder: z.coerce.number().int().min(0).default(0),
  startsAt: z.string().trim().datetime({ offset: true }).optional().nullable().or(z.literal("")),
  endsAt: z.string().trim().datetime({ offset: true }).optional().nullable().or(z.literal("")),
});
const bannerPatchSchema = bannerPayloadSchema.partial();

const programAssetBaseSchema = z.object({
  keywordCode: z.string().trim().min(1, "keywordCode tidak boleh kosong").max(500),
  imageUrl: z.string().trim().min(1, "Image URL wajib diisi").max(500, "Image URL terlalu panjang"),
  isActive: z.boolean().default(true),
});
const programAssetPayloadSchema = programAssetBaseSchema;
const programAssetPatchSchema = programAssetBaseSchema.partial();

const imageMimeToExt: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

const uploadDir = path.join(process.cwd(), "public", "uploads", "banner-assets");
const publicUploadPrefix = "/uploads/banner-assets";

const toNullableString = (value: string | null | undefined) => {
  const normalized = value?.trim();
  return normalized ? normalized : null;
};

const normalizeBannerPayload = (payload: z.infer<typeof bannerPayloadSchema>) => {
  const startsAt = toNullableString(payload.startsAt ?? null);
  const endsAt = toNullableString(payload.endsAt ?? null);

  if (startsAt && endsAt && startsAt > endsAt) {
    throw new Error("starts_at tidak boleh lebih besar dari ends_at");
  }

  return {
    title: payload.title.trim(),
    subtitle: payload.subtitle.trim(),
    cta: payload.cta.trim(),
    imageUrl: payload.imageUrl.trim(),
    isActive: payload.isActive,
    sortOrder: payload.sortOrder,
    startsAt,
    endsAt,
  };
};

const normalizeBannerPatchPayload = (payload: z.infer<typeof bannerPatchSchema>) => {
  const values: Record<string, string | number | boolean | null> = {};

  if (payload.title !== undefined) values.title = payload.title.trim();
  if (payload.subtitle !== undefined) values.subtitle = payload.subtitle.trim();
  if (payload.cta !== undefined) values.cta = payload.cta.trim();
  if (payload.imageUrl !== undefined) values.imageUrl = payload.imageUrl.trim();
  if (payload.isActive !== undefined) values.isActive = payload.isActive;
  if (payload.sortOrder !== undefined) values.sortOrder = payload.sortOrder;
  if (payload.startsAt !== undefined) values.startsAt = toNullableString(payload.startsAt ?? null);
  if (payload.endsAt !== undefined) values.endsAt = toNullableString(payload.endsAt ?? null);

  if (
    typeof values.startsAt === "string" &&
    typeof values.endsAt === "string" &&
    values.startsAt > values.endsAt
  ) {
    throw new Error("starts_at tidak boleh lebih besar dari ends_at");
  }

  return values;
};

const normalizeProgramAssetPayload = (payload: z.infer<typeof programAssetPayloadSchema>) => ({
  ruleKey: null,
  keywordCode: payload.keywordCode.trim(),
  imageUrl: payload.imageUrl.trim(),
  isActive: payload.isActive,
});

const normalizeProgramAssetPatchPayload = (payload: z.infer<typeof programAssetPatchSchema>) => {
  const values: Record<string, string | boolean | null> = {};

  if (payload.keywordCode !== undefined) values.keywordCode = payload.keywordCode.trim();
  if (payload.imageUrl !== undefined) values.imageUrl = payload.imageUrl.trim();
  if (payload.isActive !== undefined) values.isActive = payload.isActive;

  return values;
};

export type BannerFormInput = z.input<typeof bannerPayloadSchema>;
export type ProgramAssetFormInput = z.input<typeof programAssetPayloadSchema>;

export function validateBannerPayload(payload: unknown) {
  return normalizeBannerPayload(bannerPayloadSchema.parse(payload));
}

export function validateBannerPatchPayload(payload: unknown) {
  return normalizeBannerPatchPayload(bannerPatchSchema.parse(payload));
}

export function validateProgramAssetPayload(payload: unknown) {
  return normalizeProgramAssetPayload(programAssetPayloadSchema.parse(payload));
}

export function validateProgramAssetPatchPayload(payload: unknown) {
  return normalizeProgramAssetPatchPayload(programAssetPatchSchema.parse(payload));
}

export async function listAdminBanners() {
  return db
    .select()
    .from(providerBanners)
    .orderBy(asc(providerBanners.sortOrder), desc(providerBanners.updatedAt), asc(providerBanners.id));
}

export async function listActiveBanners() {
  const now = new Date().toISOString();

  return db
    .select({
      id: providerBanners.id,
      title: providerBanners.title,
      subtitle: providerBanners.subtitle,
      cta: providerBanners.cta,
      imageUrl: providerBanners.imageUrl,
      isActive: providerBanners.isActive,
      sortOrder: providerBanners.sortOrder,
      startsAt: providerBanners.startsAt,
      endsAt: providerBanners.endsAt,
      createdAt: providerBanners.createdAt,
      updatedAt: providerBanners.updatedAt,
    })
    .from(providerBanners)
    .where(
      and(
        eq(providerBanners.isActive, true),
        or(isNull(providerBanners.startsAt), lte(providerBanners.startsAt, now)),
        or(isNull(providerBanners.endsAt), gte(providerBanners.endsAt, now))
      )
    )
    .orderBy(asc(providerBanners.sortOrder), desc(providerBanners.updatedAt), asc(providerBanners.id));
}

export async function createBanner(payload: unknown) {
  const values = validateBannerPayload(payload);

  const [banner] = await db
    .insert(providerBanners)
    .values(values)
    .returning();

  return banner;
}

export async function updateBanner(id: number, payload: unknown) {
  const values = validateBannerPatchPayload(payload);

  if (Object.keys(values).length === 0) {
    const [existing] = await db.select().from(providerBanners).where(eq(providerBanners.id, id)).limit(1);
    return existing ?? null;
  }

  const nextStartsAt = "startsAt" in values ? values.startsAt : undefined;
  const nextEndsAt = "endsAt" in values ? values.endsAt : undefined;

  if (nextStartsAt !== undefined || nextEndsAt !== undefined) {
    const [existing] = await db.select().from(providerBanners).where(eq(providerBanners.id, id)).limit(1);
    if (!existing) return null;

    const resolvedStartsAt = (nextStartsAt ?? existing.startsAt) as string | null;
    const resolvedEndsAt = (nextEndsAt ?? existing.endsAt) as string | null;

    if (resolvedStartsAt && resolvedEndsAt && resolvedStartsAt > resolvedEndsAt) {
      throw new Error("starts_at tidak boleh lebih besar dari ends_at");
    }
  }

  const [banner] = await db
    .update(providerBanners)
    .set({
      ...values,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(providerBanners.id, id))
    .returning();

  return banner ?? null;
}

export async function deleteBanner(id: number) {
  const [banner] = await db.delete(providerBanners).where(eq(providerBanners.id, id)).returning();
  return banner ?? null;
}

export async function listProgramBannerAssetsAdmin() {
  return db
    .select()
    .from(programBannerAssets)
    .orderBy(desc(programBannerAssets.updatedAt), asc(programBannerAssets.id));
}

export async function listProgramBannerAssetsActive() {
  return db
    .select()
    .from(programBannerAssets)
    .where(eq(programBannerAssets.isActive, true))
    .orderBy(desc(programBannerAssets.updatedAt), asc(programBannerAssets.id));
}

export async function createProgramBannerAsset(payload: unknown) {
  const values = validateProgramAssetPayload(payload);

  const [asset] = await db
    .insert(programBannerAssets)
    .values(values)
    .returning();

  return asset;
}

export async function updateProgramBannerAsset(id: number, payload: unknown) {
  const values = validateProgramAssetPatchPayload(payload);

  const [existing] = await db.select().from(programBannerAssets).where(eq(programBannerAssets.id, id)).limit(1);
  if (!existing) return null;

  const resolvedKeywordCode = ("keywordCode" in values ? values.keywordCode : existing.keywordCode) ?? null;

  if (!resolvedKeywordCode) {
    throw new Error("keyword_code wajib diisi");
  }

  const [asset] = await db
    .update(programBannerAssets)
    .set({
      ...values,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(programBannerAssets.id, id))
    .returning();

  return asset ?? null;
}

export async function deleteProgramBannerAsset(id: number) {
  const [asset] = await db.delete(programBannerAssets).where(eq(programBannerAssets.id, id)).returning();
  return asset ?? null;
}

export async function getNextBannerSortOrder() {
  const [result] = await db
    .select({
      nextSortOrder: sql<number>`coalesce(max(${providerBanners.sortOrder}), -1) + 1`,
    })
    .from(providerBanners);

  return result?.nextSortOrder ?? 0;
}

export async function saveBannerImage(file: File) {
  if (!(file instanceof File)) {
    throw new Error("File upload tidak valid");
  }

  if (!imageMimeToExt[file.type]) {
    throw new Error("Format file belum didukung. Gunakan JPG, PNG, WEBP, GIF, atau SVG.");
  }

  if (file.size === 0) {
    throw new Error("File kosong tidak bisa diupload");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Ukuran file maksimal 5 MB");
  }

  await mkdir(uploadDir, { recursive: true });

  const extension = imageMimeToExt[file.type];
  const fileName = `${Date.now()}-${randomUUID()}${extension}`;
  const absolutePath = path.join(uploadDir, fileName);
  const bytes = Buffer.from(await file.arrayBuffer());

  await writeFile(absolutePath, bytes);

  return {
    imageUrl: `${publicUploadPrefix}/${fileName}`,
    fileName,
  };
}
