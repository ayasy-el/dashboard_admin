import type { Metadata } from "next";

import BannerManagementClient from "./program-promotions-client";
import { listAdminBanners } from "@/features/banners/banner.service";
import { requireAdminUser } from "@/lib/auth";
import { DashboardPageShell } from "@/features/shared/components/dashboard-page-shell";
import { normalizeErrorMessage } from "@/lib/error-message";

export const metadata: Metadata = {
  title: "Program & Promotions | Telkomsel Poin Merchant Dashboard",
  description: "Kelola banner promosi merchant yang tampil di aplikasi.",
};

export default async function ProgramPromotionsPage() {
  const user = await requireAdminUser("/program-promotions");
  try {
    const initialBanners = await listAdminBanners();

    return <BannerManagementClient initialBanners={initialBanners} user={user} />;
  } catch (error) {
    const message = normalizeErrorMessage(
      error instanceof Error ? error.message : "Gagal memuat program promotions",
    );
    return (
      <DashboardPageShell sidebarWidth="16rem" user={user}>
        <div className="px-4 py-6 lg:px-6">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {message}
          </div>
        </div>
      </DashboardPageShell>
    );
  }
}
