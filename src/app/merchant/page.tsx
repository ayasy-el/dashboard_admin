import type { Metadata } from "next";
import { cookies } from "next/headers";

import { MerchantDirectoryOverview } from "@/features/merchant/components/merchant-directory-overview";
import { getMerchantDirectory } from "@/features/merchant/get-merchant-directory";
import { MerchantDirectoryRepositoryDrizzle } from "@/features/merchant/merchant-directory.repository.drizzle";
import { DashboardPageShell } from "@/features/shared/components/dashboard-page-shell";
import { getMonthOptions } from "@/features/shared/get-month-options";
import { requireAdminUser } from "@/lib/auth";
import { DASHBOARD_FILTER_COOKIE_NAME, parseDashboardFilterCookie } from "@/lib/dashboard-filters";

export const metadata: Metadata = {
  title: "Merchant | Telkomsel Poin Merchant Dashboard",
  description: "Directory merchant dan detail keyword pada dashboard admin Telkomsel Poin Merchant.",
};

type MerchantPageProps = {
  searchParams: Promise<{ month?: string }>;
};

export default async function MerchantPage({ searchParams }: MerchantPageProps) {
  const user = await requireAdminUser("/merchant");
  const query = await searchParams;
  const cookieStore = await cookies();
  const persistedFilters = parseDashboardFilterCookie(
    cookieStore.get(DASHBOARD_FILTER_COOKIE_NAME)?.value,
  );

  const monthOptions = await getMonthOptions();
  const selectedMonth =
    monthOptions.find((option) => option.value === query.month)?.value ??
    monthOptions.find((option) => option.value === persistedFilters.month)?.value ??
    monthOptions[0]?.value ??
    null;
  const repo = new MerchantDirectoryRepositoryDrizzle();
  const data = await getMerchantDirectory(repo, selectedMonth);

  return (
    <DashboardPageShell sidebarWidth="calc(var(--spacing) * 72)" contentClassName="" user={user}>
      <MerchantDirectoryOverview data={data} monthOptions={monthOptions} />
    </DashboardPageShell>
  );
}
