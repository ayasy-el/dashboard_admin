import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getProgramBannerAssetByKeyword } from "@/features/banners/banner.service";
import { MerchantDetailContent } from "@/features/merchant-detail/components/merchant-detail-content";
import { getMerchantDetailDashboard } from "@/features/merchant-detail/get-merchant-detail-dashboard";
import { MerchantDetailRepositoryDrizzle } from "@/features/merchant-detail/merchant-detail.repository.drizzle";
import { DashboardPageShell } from "@/features/shared/components/dashboard-page-shell";
import { getMonthOptions } from "@/features/shared/get-month-options";
import { requireAdminUser } from "@/lib/auth";

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
  const { keyword } = await params;
  const query = await searchParams;

  const monthOptions = await getMonthOptions();
  const selectedMonth = query.month ?? monthOptions[0]?.value ?? null;
  const decodedKeyword = decodeURIComponent(keyword);
  const [detailData, programBannerAsset] = await Promise.all([
    getMerchantDetailDashboard(new MerchantDetailRepositoryDrizzle(), decodedKeyword, selectedMonth),
    getProgramBannerAssetByKeyword(decodedKeyword),
  ]);

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
