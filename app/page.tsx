import { DashboardPageShell } from "@/features/shared/components/dashboard-page-shell";
import { getMonthOptions } from "@/features/shared/get-month-options";
import { getOverviewDashboard } from "@/features/overview/get-overview-dashboard";
import { OverviewContent } from "@/features/overview/components/overview-content";
import { OverviewRepositoryDrizzle } from "@/features/overview/overview.repository.drizzle";

type PageProps = {
  searchParams?: Promise<{ month?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const monthQuery = params.month ?? null;

  const monthOptions = await getMonthOptions();
  const effectiveMonth = monthQuery ?? monthOptions[0]?.value ?? null;

  const repo = new OverviewRepositoryDrizzle();
  const data = await getOverviewDashboard(repo, effectiveMonth);

  return (
    <DashboardPageShell sidebarWidth="16rem">
      <OverviewContent data={data} monthOptions={monthOptions} selectedMonth={data.month} />
    </DashboardPageShell>
  );
}
