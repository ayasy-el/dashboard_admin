"use client";

import * as React from "react";
import Link from "next/link";

import { DashboardFilterControls } from "@/components/dashboard-filter-controls";
import { useDashboardFilters } from "@/components/dashboard-filter-provider";
import { BranchRedeemSummary } from "@/components/overview-branch-redeem-summary";
import { TopMerchantRedeemTable } from "@/components/overview-top-merchants";
import { CategoryBreakdownCard, TransactionAnalyticsCard } from "@/components/overview-transactions";
import { SectionCards, type StatCard } from "@/components/section-cards";
import { TableCard } from "@/components/table-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { buildFilterSearchParams } from "@/lib/dashboard-filters";
import { formatNumber, formatPercent } from "@/lib/dashboard-metrics";

type OverviewResponse = {
  month: string;
  monthLabel: string;
  previousMonth: string;
  previousMonthLabel: string;
  cards: {
    totalPoinPelanggan: number;
    totalTransaksi: number;
    totalFailedTransaksi: number;
    totalPoin: number;
    totalRedeemer: number;
    totalMerchant: number;
    totalMerchantMonthly: number;
    merchantActiveMonthly: number;
    merchantProductiveMonthly: number;
    merchantExpiredMonthly: number;
    previous: {
      totalPoinPelanggan: number;
      totalTransaksi: number;
      totalPoin: number;
      totalRedeemer: number;
      totalMerchant: number;
    };
  };
  dailyPoints: { date: string; value: number }[];
  dailyPoinPelanggan: { date: string; value: number }[];
  dailyTransactions: { date: string; value: number }[];
  dailyRedeemer: { date: string; value: number }[];
  monthlyTransactions: { month: string; value: number }[];
  monthlyRedeemer: { month: string; value: number }[];
  categoryBreakdown: { name: string; value: number; percent: number }[];
  topMerchants: {
    merchant: string;
    category: string;
    branch: string;
    keyword: string;
    redeem: number;
  }[];
  branchRedeemSummary: {
    branch: string;
    keywordCount: number;
    redeemTotal: number;
    uniqueRedeem: number;
  }[];
  overviewDetailRows: {
    category: string;
    branch: string;
    merchant: string;
    keyword: string;
    daysLeft: number;
    pointRedeem: number;
    redeem: number;
    uniqRedeem: number;
  }[];
  merchantActiveRows: {
    branch: string;
    redeem: number;
    redeemer: number;
    shareRedeemPct: number;
    activeMerchantCount: number;
    avgRedeemPerActiveMerchant: number;
  }[];
  merchantProductiveRows: {
    branch: string;
    redeem: number;
    redeemer: number;
    productiveMerchantCount: number;
    productiveRatePct: number;
  }[];
  merchantNotActiveRows: {
    branch: string;
    merchant: string;
    keyword: string;
    lastTransactionAt: string | null;
    inactiveDays: number | null;
  }[];
  merchantExpiredRows: {
    branch: string;
    merchant: string;
    expiredOn: string | null;
    daysSinceExpired: number;
  }[];
};

const tableClassName =
  "[&_th]:px-5 [&_td]:px-5 [&_td]:py-3 [&_td]:text-[15px] [&_th]:h-12 [&_th]:text-sm [&_th:first-child]:pl-8 [&_td:first-child]:pl-8 [&_th:last-child]:pr-8 [&_td:last-child]:pr-8";

const PAGE_SIZE = 10;
const PREVIEW_TABLE_LIMIT = 5;
const formatDateCell = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

export function OverviewContent() {
  const { initialized, applied } = useDashboardFilters();
  const [data, setData] = React.useState<OverviewResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [page, setPage] = React.useState(1);
  const [detailSearch, setDetailSearch] = React.useState("");

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        const params = buildFilterSearchParams(applied);
        const response = await fetch(`/api/overview?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Failed to load overview data");
        }
        const payload = (await response.json()) as OverviewResponse;
        if (active) {
          setData(payload);
          setPage(1);
          setDetailSearch("");
        }
      } catch (error) {
        if (active) {
          console.error(error);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (initialized && applied.months.length) {
      load();
    }

    return () => {
      active = false;
      controller.abort();
    };
  }, [initialized, applied.months.join(","), applied.categories.join(","), applied.branches.join(","), applied.merchants.join(",")]);

  const stats: StatCard[] = React.useMemo(() => {
    if (!data) return [];
    return [
      {
        id: "customer-points",
        label: "Total Poin Pelanggan",
        unit: "poin",
        currentTotal: data.cards.totalPoinPelanggan,
        previousTotal: data.cards.previous.totalPoinPelanggan,
        series: data.dailyPoinPelanggan,
      },
      {
        id: "transactions",
        label: "Total Redeem",
        unit: "redeem",
        currentTotal: data.cards.totalTransaksi,
        previousTotal: data.cards.previous.totalTransaksi,
        series: data.dailyTransactions,
      },
      {
        id: "total-points",
        label: "Burning Poin",
        unit: "poin",
        currentTotal: data.cards.totalPoin,
        previousTotal: data.cards.previous.totalPoin,
        series: data.dailyPoints,
      },
      {
        id: "redeemers",
        label: "Total Redeemer",
        unit: "redeemer",
        currentTotal: data.cards.totalRedeemer,
        previousTotal: data.cards.previous.totalRedeemer,
        series: data.dailyRedeemer,
      },
    ];
  }, [data]);

  const filteredDetailRows = React.useMemo(() => {
    const rows = data?.overviewDetailRows ?? [];
    const keyword = detailSearch.trim().toLowerCase();
    if (!keyword) return rows;
    return rows.filter((row) => {
      const searchable = `${row.category} ${row.branch} ${row.merchant} ${row.keyword}`.toLowerCase();
      return searchable.includes(keyword);
    });
  }, [data?.overviewDetailRows, detailSearch]);

  const totalDetailPages = React.useMemo(() => {
    const total = filteredDetailRows.length;
    return Math.max(1, Math.ceil(total / PAGE_SIZE));
  }, [filteredDetailRows.length]);

  const pagedDetailRows = React.useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filteredDetailRows.slice(start, start + PAGE_SIZE);
  }, [filteredDetailRows, page]);

  const detailPageItems = React.useMemo(() => {
    const total = totalDetailPages;
    if (total <= 7) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (page <= 4) {
      return [1, 2, 3, 4, 5, "...", total] as const;
    }
    if (page >= total - 3) {
      return [1, "...", total - 4, total - 3, total - 2, total - 1, total] as const;
    }
    return [1, "...", page - 1, page, page + 1, "...", total] as const;
  }, [page, totalDetailPages]);

  const merchantNotActivePreview = React.useMemo(
    () => (data?.merchantNotActiveRows ?? []).slice(0, PREVIEW_TABLE_LIMIT),
    [data?.merchantNotActiveRows]
  );

  const merchantExpiredPreview = React.useMemo(
    () => (data?.merchantExpiredRows ?? []).slice(0, PREVIEW_TABLE_LIMIT),
    [data?.merchantExpiredRows]
  );

  return (
    <>
      <div className="flex flex-col gap-3 px-4 lg:px-6">
        <div className="text-sm font-medium text-muted-foreground">Ringkasan bulan</div>
        <DashboardFilterControls />
      </div>
      {data ? (
        <>
          <SectionCards
            monthLabel={data.monthLabel}
            previousMonthLabel={data.previousMonthLabel}
            stats={stats}
          />

          <div className="grid gap-4 px-4 lg:grid-cols-4 lg:px-6">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Total Merchant</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold tabular-nums">{formatNumber(data.cards.totalMerchant)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Merchant Aktif (Bulan)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold tabular-nums">{formatNumber(data.cards.merchantActiveMonthly)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Merchant Produktif (Bulan)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold tabular-nums">{formatNumber(data.cards.merchantProductiveMonthly)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Merchant Expired (Bulan)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold tabular-nums">{formatNumber(data.cards.merchantExpiredMonthly)}</div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 px-4 lg:grid-cols-2 lg:px-6">
            <CategoryBreakdownCard
              monthLabel={data.monthLabel}
              categoryBreakdown={data.categoryBreakdown}
              totalDaily={data.cards.totalTransaksi}
            />
            <TopMerchantRedeemTable data={data.topMerchants} loading={loading} />
          </div>

          <div className="grid gap-4 px-4 lg:grid-cols-2 lg:px-6">
            <TransactionAnalyticsCard
              monthLabel={data.monthLabel}
              dailySeries={data.dailyTransactions}
              dailyRedeemerSeries={data.dailyRedeemer}
              monthlySeries={data.monthlyTransactions}
              monthlyRedeemerSeries={data.monthlyRedeemer}
              totalDaily={data.cards.totalTransaksi}
              totalMonthly={data.monthlyTransactions.at(-1)?.value ?? 0}
            />
            <BranchRedeemSummary
              data={data.branchRedeemSummary}
              loading={loading}
              totalTransactions={data.cards.totalTransaksi + data.cards.totalFailedTransaksi}
              successRate={
                data.cards.totalTransaksi + data.cards.totalFailedTransaksi > 0
                  ? (data.cards.totalTransaksi / (data.cards.totalTransaksi + data.cards.totalFailedTransaksi)) * 100
                  : 0
              }
            />
          </div>

          <div className="grid gap-4 px-4 lg:px-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <TableCard title="Merchant Active ✅" headerClassName="[&_div[data-slot=card-title]]:text-lg">
                <Table className={tableClassName}>
                  <TableHeader className="bg-slate-900 text-slate-100">
                    <TableRow>
                      <TableHead>Branch</TableHead>
                      <TableHead>Redeem</TableHead>
                      <TableHead>Redeemer</TableHead>
                      <TableHead>% Share Redeem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.merchantActiveRows.length ? (
                      data.merchantActiveRows.map((row) => (
                        <TableRow key={row.branch}>
                          <TableCell className="font-medium">{row.branch}</TableCell>
                          <TableCell>{formatNumber(row.redeem)}</TableCell>
                          <TableCell>{formatNumber(row.redeemer)}</TableCell>
                          <TableCell>{formatPercent(row.shareRedeemPct)}%</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-16 text-center text-sm text-muted-foreground">
                          Tidak ada data merchant aktif.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {data.merchantActiveRows.length ? (
                  <div className="mt-4 flex justify-end px-5 pb-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href="/operational?focus=merchant-active#merchant-active">View more</Link>
                    </Button>
                  </div>
                ) : null}
              </TableCard>

              <TableCard title="Merchant Productive 🥇" headerClassName="[&_div[data-slot=card-title]]:text-lg">
                <Table className={tableClassName}>
                  <TableHeader className="bg-slate-900 text-slate-100">
                    <TableRow>
                      <TableHead>Branch</TableHead>
                      <TableHead>Redeem</TableHead>
                      <TableHead>Redeemer</TableHead>
                      <TableHead>% Productive</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.merchantProductiveRows.length ? (
                      data.merchantProductiveRows.map((row) => (
                        <TableRow key={row.branch}>
                          <TableCell className="font-medium">{row.branch}</TableCell>
                          <TableCell>{formatNumber(row.redeem)}</TableCell>
                          <TableCell>{formatNumber(row.redeemer)}</TableCell>
                          <TableCell>{formatPercent(row.productiveRatePct)}%</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-16 text-center text-sm text-muted-foreground">
                          Tidak ada data merchant produktif.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {data.merchantProductiveRows.length ? (
                  <div className="mt-4 flex justify-end px-5 pb-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href="/operational?focus=merchant-productive#merchant-productive">View more</Link>
                    </Button>
                  </div>
                ) : null}
              </TableCard>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              <TableCard title="Merchant Not Active ⚠️" headerClassName="[&_div[data-slot=card-title]]:text-lg">
                <Table className={tableClassName}>
                  <TableHeader className="bg-slate-900 text-slate-100">
                    <TableRow>
                      <TableHead>Branch</TableHead>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Keyword</TableHead>
                      <TableHead>Last Trx</TableHead>
                      <TableHead>Inactive Days</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {merchantNotActivePreview.length ? (
                      merchantNotActivePreview.map((row) => (
                        <TableRow key={`${row.keyword}-${row.merchant}`}>
                          <TableCell>{row.branch}</TableCell>
                          <TableCell className="font-medium">{row.merchant}</TableCell>
                          <TableCell>{row.keyword}</TableCell>
                          <TableCell>{formatDateCell(row.lastTransactionAt)}</TableCell>
                          <TableCell>{row.inactiveDays ?? "-"}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={5} className="h-16 text-center text-sm text-muted-foreground">
                          Tidak ada merchant not active.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {data.merchantNotActiveRows.length ? (
                  <div className="mt-4 flex justify-end px-5 pb-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href="/operational?focus=merchant-not-active#merchant-not-active">View more</Link>
                    </Button>
                  </div>
                ) : null}
              </TableCard>

              <TableCard title="Merchant Expired ⏳" headerClassName="[&_div[data-slot=card-title]]:text-lg">
                <Table className={tableClassName}>
                  <TableHeader className="bg-slate-900 text-slate-100">
                    <TableRow>
                      <TableHead>Branch</TableHead>
                      <TableHead>Merchant</TableHead>
                      <TableHead>Expired On</TableHead>
                      <TableHead>Days Since</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {merchantExpiredPreview.length ? (
                      merchantExpiredPreview.map((row) => (
                        <TableRow key={`${row.branch}-${row.merchant}`}>
                          <TableCell>{row.branch}</TableCell>
                          <TableCell className="font-medium">{row.merchant}</TableCell>
                          <TableCell>{formatDateCell(row.expiredOn)}</TableCell>
                          <TableCell>{formatNumber(row.daysSinceExpired)}</TableCell>
                        </TableRow>
                      ))
                    ) : (
                      <TableRow>
                        <TableCell colSpan={4} className="h-16 text-center text-sm text-muted-foreground">
                          Tidak ada merchant expired.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
                {data.merchantExpiredRows.length ? (
                  <div className="mt-4 flex justify-end px-5 pb-2">
                    <Button asChild size="sm" variant="outline">
                      <Link href="/operational?focus=merchant-expired#merchant-expired">View more</Link>
                    </Button>
                  </div>
                ) : null}
              </TableCard>
            </div>

            <TableCard>
              <div className="flex items-center justify-between border-b border-border/70 px-8 py-6">
                <div>
                  <div className="text-xl font-semibold md:text-2xl">Detail Merchant 🧾</div>
                  <div className="text-base text-muted-foreground">
                    Kategori, branch, keyword, poin, redeem, dan hari tersisa
                  </div>
                </div>
                <div className="w-full max-w-[320px]">
                  <Input
                    value={detailSearch}
                    onChange={(event) => {
                      setDetailSearch(event.target.value);
                      setPage(1);
                    }}
                    placeholder="Cari merchant, branch, kategori, keyword..."
                    className="h-10 text-sm"
                  />
                </div>
              </div>
              <Table className={tableClassName}>
                <TableHeader className="bg-slate-900 text-slate-100">
                  <TableRow>
                    <TableHead>Kategori</TableHead>
                    <TableHead>Branch</TableHead>
                    <TableHead>Merchant</TableHead>
                    <TableHead>Keyword</TableHead>
                    <TableHead>Days Left</TableHead>
                    <TableHead>Poin</TableHead>
                    <TableHead>Redeem</TableHead>
                    <TableHead>Uniq Redeem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedDetailRows.length ? (
                    pagedDetailRows.map((row) => (
                      <TableRow key={`${row.keyword}-${row.merchant}`}>
                        <TableCell>{row.category}</TableCell>
                        <TableCell>{row.branch}</TableCell>
                        <TableCell className="font-medium">{row.merchant}</TableCell>
                        <TableCell>{row.keyword}</TableCell>
                        <TableCell className={row.daysLeft < 0 ? "text-red-600" : ""}>{row.daysLeft}</TableCell>
                        <TableCell>{formatNumber(row.pointRedeem)}</TableCell>
                        <TableCell>{formatNumber(row.redeem)}</TableCell>
                        <TableCell>{formatNumber(row.uniqRedeem)}</TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={8} className="h-16 text-center text-sm text-muted-foreground">
                        Tidak ada data detail.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <div className="mt-4 flex items-center justify-between px-5 pb-2 text-sm text-muted-foreground">
                <span>
                  Menampilkan {pagedDetailRows.length} dari {filteredDetailRows.length} data
                </span>
                <div className="flex items-center gap-1">
                  {detailPageItems.map((item, index) =>
                    item === "..." ? (
                      <span key={`ellipsis-${index}`} className="px-2 py-1 text-xs">
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        className={`rounded-md border px-3 py-1.5 text-sm ${
                          item === page
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted"
                        }`}
                        onClick={() => setPage(item)}
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>
              </div>
            </TableCard>
          </div>
        </>
      ) : (
        <div className="px-4 text-sm text-muted-foreground lg:px-6">
          {loading ? "Memuat data..." : "Tidak ada data"}
        </div>
      )}
    </>
  );
}
