import { NextResponse } from "next/server";

import { serializeProgramAsset } from "@/features/banners/banner.contract";
import { listProgramBannerAssetsActive } from "@/features/banners/banner.service";

export async function GET() {
  const assets = await listProgramBannerAssetsActive();
  return NextResponse.json({ items: assets.map(serializeProgramAsset) });
}
