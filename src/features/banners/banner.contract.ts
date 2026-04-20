type BannerRecord = {
  id: number;
  title: string;
  subtitle: string;
  cta: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type ProgramAssetRecord = {
  id: number;
  keywordCode: string | null;
  imageUrl: string;
  isActive: boolean;
  updatedAt: string;
};

const pick = <T extends Record<string, unknown>>(payload: T, camelKey: string, snakeKey: string) => {
  if (camelKey in payload) return payload[camelKey];
  return payload[snakeKey];
};

export const normalizeBannerRequest = (payload: Record<string, unknown>) => ({
  title: payload.title,
  subtitle: payload.subtitle,
  cta: payload.cta,
  imageUrl: pick(payload, "imageUrl", "image_url"),
  isActive: pick(payload, "isActive", "is_active"),
  sortOrder: pick(payload, "sortOrder", "sort_order"),
  startsAt: pick(payload, "startsAt", "starts_at"),
  endsAt: pick(payload, "endsAt", "ends_at"),
});

export const normalizeProgramAssetRequest = (payload: Record<string, unknown>) => ({
  keywordCode: pick(payload, "keywordCode", "keyword_code"),
  imageUrl: pick(payload, "imageUrl", "image_url"),
  isActive: pick(payload, "isActive", "is_active"),
});

export const serializeBanner = (banner: BannerRecord) => ({
  id: banner.id,
  title: banner.title,
  subtitle: banner.subtitle,
  cta: banner.cta,
  image_url: banner.imageUrl,
  is_active: banner.isActive,
  sort_order: banner.sortOrder,
  starts_at: banner.startsAt,
  ends_at: banner.endsAt,
  created_at: banner.createdAt ?? null,
  updated_at: banner.updatedAt ?? null,
});

export const serializeProgramAsset = (asset: ProgramAssetRecord) => ({
  id: asset.id,
  keyword_code: asset.keywordCode,
  image_url: asset.imageUrl,
  is_active: asset.isActive,
  updated_at: asset.updatedAt,
});
