import { NextResponse } from "next/server";

import { createSignedBannerAssetUrl } from "@/lib/banner-assets";
import { serializeBanner } from "@/features/banners/banner.contract";
import { listActiveBanners } from "@/features/banners/banner.service";

export async function GET() {
  const banners = await listActiveBanners();
  return NextResponse.json({
    items: banners.map((banner) =>
      serializeBanner({
        ...banner,
        imageUrl: createSignedBannerAssetUrl(banner.imageUrl),
      }),
    ),
  });
}
