import { DashboardPageShell } from "@/features/shared/components/dashboard-page-shell";
import { getMonthOptions } from "@/features/shared/get-month-options";
import { getOverviewDashboard } from "@/features/overview/get-overview-dashboard";
import { OverviewContent } from "@/features/overview/components/overview-content";
import { OverviewRepositoryDrizzle } from "@/features/overview/overview.repository.drizzle";

type PageProps = {
  searchParams?: Promise<{
    month?: string | string[];
    category?: string | string[];
    branch?: string | string[];
  }>;
};

const toArrayParam = (value: string | string[] | undefined) => {
  if (Array.isArray(value)) return value.map((item) => item.trim()).filter(Boolean);
  if (typeof value === "string" && value.trim()) return [value.trim()];
  return [];
};

export default async function Page({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const monthQuery = Array.isArray(params.month) ? params.month[0] ?? null : params.month ?? null;
  const categoryQuery = toArrayParam(params.category);
  const branchQuery = toArrayParam(params.branch);

  const monthOptions = await getMonthOptions();
  const effectiveMonth = monthQuery ?? monthOptions[0]?.value ?? null;

  const repo = new OverviewRepositoryDrizzle();
  const data = await getOverviewDashboard(repo, effectiveMonth, {
    categories: categoryQuery,
    branches: branchQuery,
  });

  return (
    <DashboardPageShell sidebarWidth="16rem">
      <OverviewContent data={data} monthOptions={monthOptions} selectedMonth={data.month} />
    </DashboardPageShell>
  );
}
