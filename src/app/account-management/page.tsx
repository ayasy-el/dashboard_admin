import type { Metadata } from "next";

import { DashboardPageShell } from "@/features/shared/components/dashboard-page-shell";
import { requireAdminUser } from "@/lib/auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeErrorMessage } from "@/lib/error-message";

import { MerchantAccountsWorkspace } from "@/features/merchant-accounts/components/merchant-accounts-workspace";
import { getMerchantAccountsDashboard } from "@/features/merchant-accounts/get-merchant-accounts-dashboard";
import { MerchantAccountsRepositoryDrizzle } from "@/features/merchant-accounts/merchant-accounts.repository.drizzle";

export const metadata: Metadata = {
  title: "Account Management | Telkomsel Poin Merchant Dashboard",
  description: "Workspace untuk mengelola user account dan merchant yang terhubung.",
};

type AccountManagementPageProps = {
  searchParams: Promise<{ userId?: string }>;
};

export default async function AccountManagementPage({ searchParams }: AccountManagementPageProps) {
  const user = await requireAdminUser("/account-management");
  const query = await searchParams;
  const selectedAccountId = query.userId ? Number.parseInt(query.userId, 10) : null;
  const repository = new MerchantAccountsRepositoryDrizzle();
  try {
    const data = await getMerchantAccountsDashboard(
      repository,
      Number.isNaN(selectedAccountId ?? Number.NaN) ? null : selectedAccountId,
    );

    return (
      <DashboardPageShell
        sidebarWidth="calc(var(--spacing) * 72)"
        contentClassName="bg-muted/30"
        user={user}
      >
        <div className="px-4 pb-4 lg:px-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Card className="gap-0 border-border/70 py-0 shadow-sm">
              <CardHeader className="pb-2 pt-5">
                <CardDescription className="text-xs font-semibold tracking-[0.22em] uppercase">
                  Jumlah Account Aktif
                </CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">{data.summary.activeAccounts}</CardTitle>
              </CardHeader>
              <CardContent className="pb-5 pt-0 text-sm text-muted-foreground">
                Account yang masih aktif dan bisa menerima merchant.
              </CardContent>
            </Card>

            <Card className="gap-0 border-border/70 py-0 shadow-sm">
              <CardHeader className="pb-2 pt-5">
                <CardDescription className="text-xs font-semibold tracking-[0.22em] uppercase">
                  Jumlah Account Tidak Aktif
                </CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">{data.summary.inactiveAccounts}</CardTitle>
              </CardHeader>
              <CardContent className="pb-5 pt-0 text-sm text-muted-foreground">
                Account yang nonaktif dan perlu di-review sebelum dipakai lagi.
              </CardContent>
            </Card>

            <Card className="gap-0 border-border/70 py-0 shadow-sm">
              <CardHeader className="pb-2 pt-5">
                <CardDescription className="text-xs font-semibold tracking-[0.22em] uppercase">
                  Account Tanpa Merchant
                </CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">{data.summary.unlinkedAccounts}</CardTitle>
              </CardHeader>
              <CardContent className="pb-5 pt-0 text-sm text-muted-foreground">
                Account yang belum punya merchant terhubung.
              </CardContent>
            </Card>

            <Card className="gap-0 border-border/70 py-0 shadow-sm">
              <CardHeader className="pb-2 pt-5">
                <CardDescription className="text-xs font-semibold tracking-[0.22em] uppercase">
                  Merchant Belum Terkoneksi
                </CardDescription>
                <CardTitle className="text-3xl font-bold tabular-nums">{data.summary.unconnectedMerchants}</CardTitle>
              </CardHeader>
              <CardContent className="pb-5 pt-0 text-sm text-muted-foreground">
                Merchant yang belum masuk ke account mana pun.
              </CardContent>
            </Card>
          </div>
        </div>
        <MerchantAccountsWorkspace data={data} />
      </DashboardPageShell>
    );
  } catch (error) {
    const message = normalizeErrorMessage(error instanceof Error ? error.message : "Gagal memuat account management");
    return (
      <DashboardPageShell
        sidebarWidth="calc(var(--spacing) * 72)"
        contentClassName="bg-muted/30"
        user={user}
      >
        <div className="px-4 pb-4 lg:px-6">
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {message}
          </div>
        </div>
      </DashboardPageShell>
    );
  }
}
