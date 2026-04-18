import type { Metadata } from "next";

import { MerchantDirectoryOverview } from "@/features/merchant/components/merchant-directory-overview";
import { getMerchantDirectory } from "@/features/merchant/get-merchant-directory";
import { MerchantDirectoryRepositoryDrizzle } from "@/features/merchant/merchant-directory.repository.drizzle";
import { DashboardPageShell } from "@/features/shared/components/dashboard-page-shell";
import { getMonthOptions } from "@/features/shared/get-month-options";
import { requireAdminUser } from "@/lib/auth";

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

  const monthOptions = await getMonthOptions();
  const selectedMonth = query.month ?? monthOptions[0]?.value ?? null;
  const repo = new MerchantDirectoryRepositoryDrizzle();
  const data = await getMerchantDirectory(repo, selectedMonth);

  return (
    <DashboardPageShell sidebarWidth="calc(var(--spacing) * 72)" contentClassName="" user={user}>
      <MerchantDirectoryOverview data={data} monthOptions={monthOptions} />
    </DashboardPageShell>
  );
}
