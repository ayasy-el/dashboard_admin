import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { normalizeProgramAssetRequest, serializeProgramAsset } from "@/features/banners/banner.contract";
import { deleteProgramBannerAsset, updateProgramBannerAsset } from "@/features/banners/banner.service";
import { requireAdminUser } from "@/lib/auth";

const parseId = (value: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("ID asset tidak valid");
  }
  return parsed;
};

const toMessage = (error: unknown) => {
  if (error instanceof ZodError) {
    return error.issues[0]?.message ?? "Payload tidak valid";
  }

  return error instanceof Error ? error.message : "Terjadi kesalahan";
};

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  await requireAdminUser("/program-promotions");

  try {
    const { id } = await context.params;
    const payload = normalizeProgramAssetRequest(await request.json());
    const asset = await updateProgramBannerAsset(parseId(id), payload);

    if (!asset) {
      return NextResponse.json({ error: "Asset tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(serializeProgramAsset(asset));
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  await requireAdminUser("/program-promotions");

  try {
    const { id } = await context.params;
    const asset = await deleteProgramBannerAsset(parseId(id));

    if (!asset) {
      return NextResponse.json({ error: "Asset tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 400 });
  }
}
