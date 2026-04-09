import type { Metadata } from "next";
import { cookies } from "next/headers";

import { DashboardPageShell } from "@/features/shared/components/dashboard-page-shell";
import { getMonthOptions } from "@/features/shared/get-month-options";
import { getOverviewDashboard } from "@/features/overview/get-overview-dashboard";
import { OverviewContent } from "@/features/overview/components/overview-content";
import { OverviewRepositoryDrizzle } from "@/features/overview/overview.repository.drizzle";
import { requireAdminUser } from "@/lib/auth";
import { DASHBOARD_FILTER_COOKIE_NAME, parseDashboardFilterCookie } from "@/lib/dashboard-filters";

export const metadata: Metadata = {
  title: "Overview | Telkomsel Poin Merchant Dashboard",
  description: "Overview dashboard admin Telkomsel Poin Merchant.",
};

export default async function Page() {
  const user = await requireAdminUser("/");
  const cookieStore = await cookies();
  const persistedFilters = parseDashboardFilterCookie(cookieStore.get(DASHBOARD_FILTER_COOKIE_NAME)?.value);

  const monthOptions = await getMonthOptions();
  const effectiveMonth =
    monthOptions.find((option) => option.value === persistedFilters.month)?.value ?? monthOptions[0]?.value ?? null;

  const repo = new OverviewRepositoryDrizzle();
  const data = await getOverviewDashboard(repo, effectiveMonth, {
    categories: persistedFilters.categories,
    branches: persistedFilters.branches,
  });

  return (
    <DashboardPageShell sidebarWidth="16rem" user={user}>
      <OverviewContent data={data} monthOptions={monthOptions} selectedMonth={data.month} />
    </DashboardPageShell>
  );
}
