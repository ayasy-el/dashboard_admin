import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { normalizeBannerRequest, serializeBanner } from "@/features/banners/banner.contract";
import { createBanner, getNextBannerSortOrder, listAdminBanners } from "@/features/banners/banner.service";
import { requireAdminUser } from "@/lib/auth";

const toMessage = (error: unknown) => {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Payload tidak valid";
  }

  return error instanceof Error ? error.message : "Terjadi kesalahan";
};

export async function GET() {
  await requireAdminUser("/program-promotions");
  const banners = await listAdminBanners();
  return NextResponse.json({ items: banners.map(serializeBanner) });
}

export async function POST(request: Request) {
  await requireAdminUser("/program-promotions");

  try {
    const payload = normalizeBannerRequest(await request.json());
    const banner = await createBanner({
      ...payload,
      sortOrder: await getNextBannerSortOrder(),
      isActive: true,
    });

    return NextResponse.json(serializeBanner(banner), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 400 });
  }
}
