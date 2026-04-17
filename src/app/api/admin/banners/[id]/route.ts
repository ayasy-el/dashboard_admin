import { NextResponse } from "next/server";
import { ZodError } from "zod";

import { normalizeBannerRequest, serializeBanner } from "@/features/banners/banner.contract";
import { deleteBanner, updateBanner } from "@/features/banners/banner.service";
import { requireAdminUser } from "@/lib/auth";

const parseId = (value: string) => {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("ID banner tidak valid");
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
    const payload = normalizeBannerRequest(await request.json());
    const banner = await updateBanner(parseId(id), payload);

    if (!banner) {
      return NextResponse.json({ error: "Banner tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json(serializeBanner(banner));
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 400 });
  }
}

export async function DELETE(_request: Request, context: { params: Promise<{ id: string }> }) {
  await requireAdminUser("/program-promotions");

  try {
    const { id } = await context.params;
    const banner = await deleteBanner(parseId(id));

    if (!banner) {
      return NextResponse.json({ error: "Banner tidak ditemukan" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: toMessage(error) }, { status: 400 });
  }
}
