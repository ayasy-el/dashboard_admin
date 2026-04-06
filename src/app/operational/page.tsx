import type { Metadata } from "next";

import { OperationalContent } from "@/features/operational/components/operational-content";
import { getOperationalDashboard } from "@/features/operational/get-operational-dashboard";
import { OperationalRepositoryDrizzle } from "@/features/operational/operational.repository.drizzle";
import { DashboardPageShell } from "@/features/shared/components/dashboard-page-shell";
import { getMonthOptions } from "@/features/shared/get-month-options";
import { requireAdminUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Operational | Telkomsel Poin Merchant Dashboard",
  description: "Operational dashboard admin Telkomsel Poin Merchant.",
};

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
  const user = await requireAdminUser("/operational");
  const params = (await searchParams) ?? {};
  const monthQuery = Array.isArray(params.month) ? params.month[0] ?? null : params.month ?? null;
  const categoryQuery = toArrayParam(params.category);
  const branchQuery = toArrayParam(params.branch);

  const monthOptions = await getMonthOptions();
  const effectiveMonth = monthQuery ?? monthOptions[0]?.value ?? null;

  const repo = new OperationalRepositoryDrizzle();
  const data = await getOperationalDashboard(repo, effectiveMonth, {
    categories: categoryQuery,
    branches: branchQuery,
  });

  return (
    <DashboardPageShell sidebarWidth="calc(var(--spacing) * 72)" contentClassName="" user={user}>
      <OperationalContent data={data} monthOptions={monthOptions} selectedMonth={data.month} />
    </DashboardPageShell>
  );
}
