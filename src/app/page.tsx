import type { Metadata } from "next";
import { cookies } from "next/headers";

import { DashboardPageShell } from "@/features/shared/components/dashboard-page-shell";
import { getMonthOptions } from "@/features/shared/get-month-options";
import { getOverviewDashboard } from "@/features/overview/get-overview-dashboard";
import { OverviewContent } from "@/features/overview/components/overview-content";
import { OverviewRepositoryDrizzle } from "@/features/overview/overview.repository.drizzle";
import { requireAdminUser } from "@/lib/auth";
import { DASHBOARD_FILTER_COOKIE_NAME, parseDashboardFilterCookie } from "@/lib/dashboard-filters";
import { normalizeErrorMessage } from "@/lib/error-message";

export const metadata: Metadata = {
  title: "Overview | Telkomsel Poin Merchant Dashboard",
  description: "Overview dashboard admin Telkomsel Poin Merchant.",
};

export default async function Page() {
  const user = await requireAdminUser("/");
  const cookieStore = await cookies();
  const persistedFilters = parseDashboardFilterCookie(cookieStore.get(DASHBOARD_FILTER_COOKIE_NAME)?.value);

  try {
    const monthOptions = await getMonthOptions();
    const effectiveMonth =
      monthOptions.find((option) => option.value === persistedFilters.month)?.value ??
      monthOptions[0]?.value ??
      null;

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
  } catch (error) {
    const message = normalizeErrorMessage(error instanceof Error ? error.message : "Gagal memuat overview");
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
