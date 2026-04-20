import type { Metadata } from "next";

import BannerManagementClient from "./program-promotions-client";
import { listAdminBanners } from "@/features/banners/banner.service";
import { requireAdminUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Program & Promotions | Telkomsel Poin Merchant Dashboard",
  description: "Kelola banner promosi merchant yang tampil di aplikasi.",
};

export default async function ProgramPromotionsPage() {
  const user = await requireAdminUser("/program-promotions");
  const initialBanners = await listAdminBanners();

  return <BannerManagementClient initialBanners={initialBanners} user={user} />;
}
