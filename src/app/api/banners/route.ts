import { NextResponse } from "next/server";

import { serializeBanner } from "@/features/banners/banner.contract";
import { listActiveBanners } from "@/features/banners/banner.service";

export async function GET() {
  const banners = await listActiveBanners();
  return NextResponse.json({ items: banners.map(serializeBanner) });
}
