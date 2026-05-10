import { NextResponse } from "next/server";

import { getCurrentAdminUser } from "@/lib/auth";
import { readBannerAsset, verifySignedBannerAssetUrl } from "@/lib/banner-assets";

type RouteContext = {
  params: Promise<{ key: string }>;
};

export const dynamic = "force-dynamic";

export async function GET(request: Request, context: RouteContext) {
  const { key } = await context.params;
  const user = await getCurrentAdminUser();
  const { searchParams } = new URL(request.url);

  const authorized =
    Boolean(user) ||
    verifySignedBannerAssetUrl(key, searchParams.get("exp"), searchParams.get("sig"));

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const asset = await readBannerAsset(key);
    return new NextResponse(asset.content, {
      headers: {
        "Content-Type": asset.mimeType,
        "Content-Disposition": `inline; filename="${encodeURIComponent(asset.key)}"`,
        "Cache-Control": "public, max-age=31536000, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }
}
