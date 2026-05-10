import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

const IMAGE_MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/svg+xml": ".svg",
};

const EXT_TO_IMAGE_MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

const BANNER_ASSET_ROUTE_PREFIX = "/api/admin/banner-assets";
const BANNER_ASSET_DIR = path.resolve(process.cwd(), "..", ".banner-assets");
const DEFAULT_SIGNED_URL_TTL_SECONDS = 60 * 60;
const VALID_ASSET_KEY_REGEX = /^[a-f0-9-]{36}\.[a-z0-9]+$/i;

const getAssetSecret = () => process.env.ADMIN_ASSET_SHARED_SECRET ?? null;

const inferMimeTypeFromKey = (key: string) => {
  const extension = path.extname(key).toLowerCase();
  return EXT_TO_IMAGE_MIME[extension] ?? "application/octet-stream";
};

const signAssetKey = (key: string, expiresAt: number, secret: string) =>
  createHmac("sha256", secret).update(`${key}:${expiresAt}`).digest("base64url");

const resolveManagedAssetFilePath = (key: string) => {
  if (!VALID_ASSET_KEY_REGEX.test(key)) {
    return null;
  }

  const candidate = path.resolve(BANNER_ASSET_DIR, key);
  const relative = path.relative(BANNER_ASSET_DIR, candidate);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return candidate;
};

export const isManagedBannerAssetPath = (value: string | null | undefined) =>
  Boolean(value && value.startsWith(`${BANNER_ASSET_ROUTE_PREFIX}/`));

export const buildBannerAssetPath = (key: string) => `${BANNER_ASSET_ROUTE_PREFIX}/${encodeURIComponent(key)}`;

export const extractBannerAssetKey = (value: string | null | undefined) => {
  if (!value || !value.startsWith(`${BANNER_ASSET_ROUTE_PREFIX}/`)) {
    return null;
  }

  const key = decodeURIComponent(value.slice(BANNER_ASSET_ROUTE_PREFIX.length + 1));
  return resolveManagedAssetFilePath(key) ? key : null;
};

export const createSignedBannerAssetUrl = (
  value: string,
  ttlSeconds = DEFAULT_SIGNED_URL_TTL_SECONDS,
) => {
  const key = extractBannerAssetKey(value);
  const secret = getAssetSecret();

  if (!key || !secret) {
    return value;
  }

  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const signature = signAssetKey(key, expiresAt, secret);
  const separator = value.includes("?") ? "&" : "?";
  return `${value}${separator}exp=${expiresAt}&sig=${encodeURIComponent(signature)}`;
};

export const verifySignedBannerAssetUrl = (key: string, expRaw: string | null, sigRaw: string | null) => {
  const secret = getAssetSecret();
  if (!secret || !resolveManagedAssetFilePath(key) || !expRaw || !sigRaw) {
    return false;
  }

  const expiresAt = Number(expRaw);
  if (!Number.isFinite(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
    return false;
  }

  const expected = signAssetKey(key, expiresAt, secret);
  const expectedBuffer = Buffer.from(expected, "utf8");
  const actualBuffer = Buffer.from(sigRaw, "utf8");

  if (expectedBuffer.length !== actualBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, actualBuffer);
};

export async function saveBannerAsset(file: File) {
  if (!(file instanceof File)) {
    throw new Error("File upload tidak valid");
  }

  const extension = IMAGE_MIME_TO_EXT[file.type];
  if (!extension) {
    throw new Error("Format file belum didukung. Gunakan JPG, PNG, WEBP, GIF, atau SVG.");
  }

  if (file.size === 0) {
    throw new Error("File kosong tidak bisa diupload");
  }

  if (file.size > 5 * 1024 * 1024) {
    throw new Error("Ukuran file maksimal 5 MB");
  }

  const key = `${randomUUID()}${extension}`;
  const filePath = resolveManagedAssetFilePath(key);
  if (!filePath) {
    throw new Error("Key asset tidak valid");
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  await mkdir(BANNER_ASSET_DIR, { recursive: true });
  await writeFile(filePath, bytes);

  return {
    key,
    imageUrl: buildBannerAssetPath(key),
  };
}

export async function readBannerAsset(key: string) {
  const filePath = resolveManagedAssetFilePath(key);
  if (!filePath) {
    throw new Error("Invalid asset key");
  }

  const content = await readFile(filePath);

  return {
    key,
    filePath,
    content,
    mimeType: inferMimeTypeFromKey(key),
  };
}

export async function deleteManagedBannerAssetByUrl(value: string | null | undefined) {
  const key = extractBannerAssetKey(value);
  if (!key) {
    return;
  }

  const filePath = resolveManagedAssetFilePath(key);
  if (!filePath) {
    return;
  }

  try {
    await unlink(filePath);
  } catch {
    // Ignore missing file during cleanup.
  }
}
