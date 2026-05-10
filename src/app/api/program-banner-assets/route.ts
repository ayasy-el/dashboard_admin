import { NextResponse } from "next/server";

import { createSignedBannerAssetUrl } from "@/lib/banner-assets";
import { serializeProgramAsset } from "@/features/banners/banner.contract";
import { listProgramBannerAssetsActive } from "@/features/banners/banner.service";

export async function GET() {
  const assets = await listProgramBannerAssetsActive();
  return NextResponse.json({
    items: assets.map((asset) =>
      serializeProgramAsset({
        ...asset,
        imageUrl: createSignedBannerAssetUrl(asset.imageUrl),
      }),
    ),
  });
}
