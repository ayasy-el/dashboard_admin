import type { Metadata } from "next";
import { cookies } from "next/headers";

import { OperationalContent } from "@/features/operational/components/operational-content";
import { getOperationalDashboard } from "@/features/operational/get-operational-dashboard";
import { OperationalRepositoryDrizzle } from "@/features/operational/operational.repository.drizzle";
import { DashboardPageShell } from "@/features/shared/components/dashboard-page-shell";
import { getMonthOptions } from "@/features/shared/get-month-options";
import { requireAdminUser } from "@/lib/auth";
import { DASHBOARD_FILTER_COOKIE_NAME, parseDashboardFilterCookie } from "@/lib/dashboard-filters";

export const metadata: Metadata = {
  title: "Operational | Telkomsel Poin Merchant Dashboard",
  description: "Operational dashboard admin Telkomsel Poin Merchant.",
};

export default async function Page() {
  const user = await requireAdminUser("/operational");
  const cookieStore = await cookies();
  const persistedFilters = parseDashboardFilterCookie(cookieStore.get(DASHBOARD_FILTER_COOKIE_NAME)?.value);

  const monthOptions = await getMonthOptions();
  const effectiveMonth =
    monthOptions.find((option) => option.value === persistedFilters.month)?.value ?? monthOptions[0]?.value ?? null;

  const repo = new OperationalRepositoryDrizzle();
  const data = await getOperationalDashboard(repo, effectiveMonth, {
    categories: persistedFilters.categories,
    branches: persistedFilters.branches,
  });

  return (
    <DashboardPageShell sidebarWidth="calc(var(--spacing) * 72)" contentClassName="" user={user}>
      <OperationalContent data={data} monthOptions={monthOptions} selectedMonth={data.month} />
    </DashboardPageShell>
  );
}
