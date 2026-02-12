import { OperationalContent } from "@/features/operational/components/operational-content";
import { getOperationalDashboard } from "@/features/operational/get-operational-dashboard";
import { OperationalRepositoryDrizzle } from "@/features/operational/operational.repository.drizzle";
import { DashboardPageShell } from "@/features/shared/components/dashboard-page-shell";
import { getMonthOptions } from "@/features/shared/get-month-options";

type PageProps = {
  searchParams?: Promise<{ month?: string }>;
};

export default async function Page({ searchParams }: PageProps) {
  const params = (await searchParams) ?? {};
  const monthQuery = params.month ?? null;

  const monthOptions = await getMonthOptions();
  const effectiveMonth = monthQuery ?? monthOptions[0]?.value ?? null;

  const repo = new OperationalRepositoryDrizzle();
  const data = await getOperationalDashboard(repo, effectiveMonth);

  return (
    <DashboardPageShell sidebarWidth="calc(var(--spacing) * 72)" contentClassName="">
      <OperationalContent data={data} monthOptions={monthOptions} selectedMonth={data.month} />
    </DashboardPageShell>
  );
}
