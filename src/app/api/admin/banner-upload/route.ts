import { NextResponse } from "next/server";

import { saveBannerImage } from "@/features/banners/banner.service";
import { requireAdminUser } from "@/lib/auth";

export async function POST(request: Request) {
  await requireAdminUser("/program-promotions");

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "File wajib diisi" }, { status: 400 });
    }

    const uploaded = await saveBannerImage(file);
    return NextResponse.json({ image_url: uploaded.imageUrl }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload gagal" },
      { status: 400 }
    );
  }
}
