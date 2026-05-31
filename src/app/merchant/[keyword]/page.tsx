import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { getProgramBannerAssetByKeyword } from "@/features/banners/banner.service";
import { MerchantDetailContent } from "@/features/merchant-detail/components/merchant-detail-content";
import { getMerchantDetailDashboard } from "@/features/merchant-detail/get-merchant-detail-dashboard";
import { MerchantDetailRepositoryDrizzle } from "@/features/merchant-detail/merchant-detail.repository.drizzle";
import { DashboardPageShell } from "@/features/shared/components/dashboard-page-shell";
import { getMonthOptions } from "@/features/shared/get-month-options";
import { requireAdminUser } from "@/lib/auth";
import { DASHBOARD_FILTER_COOKIE_NAME, parseDashboardFilterCookie } from "@/lib/dashboard-filters";
import { normalizeErrorMessage } from "@/lib/error-message";

type MerchantDetailPageProps = {
  params: Promise<{ keyword: string }>;
  searchParams: Promise<{ month?: string }>;
};

export async function generateMetadata({ params }: MerchantDetailPageProps): Promise<Metadata> {
  const { keyword } = await params;

  return {
    title: `${decodeURIComponent(keyword)} | Merchant Detail`,
    description: "Detail merchant per keyword pada dashboard admin Telkomsel Poin Merchant.",
  };
}

export default async function MerchantDetailPage({ params, searchParams }: MerchantDetailPageProps) {
  const user = await requireAdminUser("/merchant");
  let monthOptions: Awaited<ReturnType<typeof getMonthOptions>> = [];
  let detailData: Awaited<ReturnType<typeof getMerchantDetailDashboard>> | null = null;
  let programBannerAsset: Awaited<ReturnType<typeof getProgramBannerAssetByKeyword>> | null = null;

  try {
    const { keyword } = await params;
    const query = await searchParams;
    const cookieStore = await cookies();
    const persistedFilters = parseDashboardFilterCookie(
      cookieStore.get(DASHBOARD_FILTER_COOKIE_NAME)?.value,
    );

    monthOptions = await getMonthOptions();
    const selectedMonth =
      monthOptions.find((option) => option.value === query.month)?.value ??
      monthOptions.find((option) => option.value === persistedFilters.month)?.value ??
      monthOptions[0]?.value ??
      null;
    const decodedKeyword = decodeURIComponent(keyword);
    [detailData, programBannerAsset] = await Promise.all([
      getMerchantDetailDashboard(new MerchantDetailRepositoryDrizzle(), decodedKeyword, selectedMonth),
      getProgramBannerAssetByKeyword(decodedKeyword),
    ]);
  } catch (error) {
    const message = normalizeErrorMessage(
      error instanceof Error ? error.message : "Gagal memuat merchant detail",
    );
    return (
      <DashboardPageShell sidebarWidth="calc(var(--spacing) * 72)" contentClassName="" user={user}>
        <div className="px-4 py-6 lg:px-6">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {message}
          </div>
        </div>
      </DashboardPageShell>
    );
  }

  if (!detailData) {
    notFound();
  }

  return (
    <DashboardPageShell sidebarWidth="calc(var(--spacing) * 72)" contentClassName="" user={user}>
      <MerchantDetailContent
        data={detailData}
        monthOptions={monthOptions}
        programBannerAsset={programBannerAsset}
      />
    </DashboardPageShell>
  );
}
