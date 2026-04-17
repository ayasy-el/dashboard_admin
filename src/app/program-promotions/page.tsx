import type { Metadata } from "next";

import BannerManagementClient from "./program-promotions-client";
import { listAdminBanners, listProgramBannerAssetsAdmin } from "@/features/banners/banner.service";
import { requireAdminUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Program & Promotions | Telkomsel Poin Merchant Dashboard",
  description: "Kelola banner promosi merchant dan asset banner program aktif.",
};

export default async function ProgramPromotionsPage() {
  const user = await requireAdminUser("/program-promotions");
  const [initialBanners, initialProgramAssets] = await Promise.all([
    listAdminBanners(),
    listProgramBannerAssetsAdmin(),
  ]);

  return (
    <BannerManagementClient
      initialBanners={initialBanners}
      initialProgramAssets={initialProgramAssets}
      user={user}
    />
  );
}
