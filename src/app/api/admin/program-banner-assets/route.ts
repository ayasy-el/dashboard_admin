import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { normalizeProgramAssetRequest, serializeProgramAsset } from "@/features/banners/banner.contract";
import { createProgramBannerAsset, listProgramBannerAssetsAdmin } from "@/features/banners/banner.service";
import { requireAdminUser } from "@/lib/auth";

const toMessage = (error: unknown) => {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Payload tidak valid";
  }

  return error instanceof Error ? error.message : "Terjadi kesalahan";
};

export async function GET() {
  await requireAdminUser("/merchant");
  const assets = await listProgramBannerAssetsAdmin();
  return NextResponse.json({ items: assets.map(serializeProgramAsset) });
}

export async function POST(request: Request) {
  await requireAdminUser("/merchant");

  try {
    const payload = normalizeProgramAssetRequest(await request.json());
    const asset = await createProgramBannerAsset(payload);
    return NextResponse.json(serializeProgramAsset(asset), { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 400 });
  }
}
