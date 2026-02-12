"use client";

import * as React from "react";
import { useSearchParams } from "next/navigation";

import { DataTable } from "@/components/data-table";
import { DashboardFilterControls } from "@/components/dashboard-filter-controls";
import { useDashboardFilters } from "@/components/dashboard-filter-provider";
import { SectionCards, type StatCard } from "@/components/section-cards";
import { TableCard } from "@/components/table-card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type OperationalResponse = {
  month: string;
  monthLabel: string;
  previousMonth: string;
  previousMonthLabel: string;
  cards: {
    success: {
      current: number;
      previous: number;
      series: { date: string; value: number }[];
    };
    failed: {
      current: number;
      previous: number;
      series: { date: string; value: number }[];
    };
  };
  topMerchants: {
    merchant: string;
    keyword: string;
    totalTransactions: number;
    uniqMerchant: string;
    uniqRedeemer: number;
  }[];
  expiredRules: {
    merchant: string;
    keyword: string;
    startPeriod: string;
    endPeriod: string;
    daysLeft: number;
  }[];
  expiredPastRules: {
    merchant: string;
    keyword: string;
    startPeriod: string;
    endPeriod: string;
  }[];
};

type OverviewTableResponse = {
  branchTable: {
    branches: {
      id: number;
      name: string;
      totalMerchant: number;
      uniqueMerchant: number;
      totalPoint: number;
      totalTransaksi: number;
      uniqueRedeemer: number;
      merchantAktif: number;
      merchantProduktif: number;
      children: {
        id: number;
        name: string;
        totalMerchant: number;
        uniqueMerchant: number;
        totalPoint: number;
        totalTransaksi: number;
        uniqueRedeemer: number;
        merchantAktif: number;
        merchantProduktif: number;
      }[];
    }[];
  };
  categoryTable: {
    id: number;
    name: string;
    totalMerchant: number;
    uniqueMerchant: number;
    totalPoint: number;
    totalTransaksi: number;
    uniqueRedeemer: number;
    merchantAktif: number;
    merchantProduktif: number;
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
  "[&_th]:px-5 [&_td]:px-5 [&_td]:py-3 [&_th]:h-14 [&_th:first-child]:pl-12 [&_td:first-child]:pl-12 [&_th:last-child]:pr-12 [&_td:last-child]:pr-12";
const focusTargets = new Set([
  "merchant-active",
  "merchant-productive",
  "merchant-not-active",
  "merchant-expired",
]);
const MERCHANT_TABLE_PAGE_SIZE = 8;
const getPageItems = (page: number, totalPages: number) => {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }
  if (page <= 4) {
    return [1, 2, 3, 4, 5, "...", totalPages] as const;
  }
  if (page >= totalPages - 3) {
    return [1, "...", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages] as const;
  }
  return [1, "...", page - 1, page, page + 1, "...", totalPages] as const;
};
const formatDateCell = (value: string | null) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
};

export function OperationalContent() {
  const { initialized, applied } = useDashboardFilters();
  const searchParams = useSearchParams();
  const initialFocusRef = React.useRef<string | null>(
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("focus") ??
          (window.location.hash ? window.location.hash.replace("#", "") : null)
      : null
  );
  const [expiryScope, setExpiryScope] = React.useState<"month" | "upcoming">("month");
  const [data, setData] = React.useState<OperationalResponse | null>(null);
  const [overviewTables, setOverviewTables] = React.useState<OverviewTableResponse | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [highlightedSection, setHighlightedSection] = React.useState<string | null>(null);
  const [merchantActivePage, setMerchantActivePage] = React.useState(1);
  const [merchantProductivePage, setMerchantProductivePage] = React.useState(1);
  const [merchantNotActivePage, setMerchantNotActivePage] = React.useState(1);
  const [merchantExpiredPage, setMerchantExpiredPage] = React.useState(1);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        const params = buildFilterSearchParams(applied);
        params.set("expiryScope", expiryScope);

        const [operationalResponse, overviewResponse] = await Promise.all([
          fetch(`/api/operational?${params.toString()}`, { signal: controller.signal }),
          fetch(`/api/overview?${buildFilterSearchParams(applied).toString()}`, {
            signal: controller.signal,
          }),
        ]);

        if (!operationalResponse.ok || !overviewResponse.ok) {
          throw new Error("Failed to load operational data");
        }

        const operationalPayload = (await operationalResponse.json()) as OperationalResponse;
        const overviewPayload = (await overviewResponse.json()) as OverviewTableResponse;

        if (active) {
          setData(operationalPayload);
          setOverviewTables(overviewPayload);
          setMerchantActivePage(1);
          setMerchantProductivePage(1);
          setMerchantNotActivePage(1);
          setMerchantExpiredPage(1);
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
  }, [initialized, expiryScope, applied.months.join(","), applied.categories.join(","), applied.branches.join(","), applied.merchants.join(",")]);

  React.useEffect(() => {
    if (!overviewTables) return;
    const focus = searchParams.get("focus") ?? initialFocusRef.current;
    if (!focus || !focusTargets.has(focus)) return;
    initialFocusRef.current = focus;

    let attempts = 0;
    const maxAttempts = 12;
    const tryScroll = () => {
      const target = document.getElementById(focus);
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
        setHighlightedSection(focus);
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) {
        window.setTimeout(tryScroll, 120);
      }
    };
    tryScroll();
  }, [overviewTables, searchParams]);

  const merchantActiveTotalPages = React.useMemo(() => {
    const total = overviewTables?.merchantActiveRows.length ?? 0;
    return Math.max(1, Math.ceil(total / MERCHANT_TABLE_PAGE_SIZE));
  }, [overviewTables?.merchantActiveRows.length]);

  const merchantProductiveTotalPages = React.useMemo(() => {
    const total = overviewTables?.merchantProductiveRows.length ?? 0;
    return Math.max(1, Math.ceil(total / MERCHANT_TABLE_PAGE_SIZE));
  }, [overviewTables?.merchantProductiveRows.length]);

  const merchantNotActiveTotalPages = React.useMemo(() => {
    const total = overviewTables?.merchantNotActiveRows.length ?? 0;
    return Math.max(1, Math.ceil(total / MERCHANT_TABLE_PAGE_SIZE));
  }, [overviewTables?.merchantNotActiveRows.length]);

  const merchantExpiredTotalPages = React.useMemo(() => {
    const total = overviewTables?.merchantExpiredRows.length ?? 0;
    return Math.max(1, Math.ceil(total / MERCHANT_TABLE_PAGE_SIZE));
  }, [overviewTables?.merchantExpiredRows.length]);

  const merchantActiveRowsPaged = React.useMemo(() => {
    const rows = overviewTables?.merchantActiveRows ?? [];
    const start = (merchantActivePage - 1) * MERCHANT_TABLE_PAGE_SIZE;
    return rows.slice(start, start + MERCHANT_TABLE_PAGE_SIZE);
  }, [overviewTables?.merchantActiveRows, merchantActivePage]);

  const merchantProductiveRowsPaged = React.useMemo(() => {
    const rows = overviewTables?.merchantProductiveRows ?? [];
    const start = (merchantProductivePage - 1) * MERCHANT_TABLE_PAGE_SIZE;
    return rows.slice(start, start + MERCHANT_TABLE_PAGE_SIZE);
  }, [overviewTables?.merchantProductiveRows, merchantProductivePage]);

  const merchantNotActiveRowsPaged = React.useMemo(() => {
    const rows = overviewTables?.merchantNotActiveRows ?? [];
    const start = (merchantNotActivePage - 1) * MERCHANT_TABLE_PAGE_SIZE;
    return rows.slice(start, start + MERCHANT_TABLE_PAGE_SIZE);
  }, [overviewTables?.merchantNotActiveRows, merchantNotActivePage]);

  const merchantExpiredRowsPaged = React.useMemo(() => {
    const rows = overviewTables?.merchantExpiredRows ?? [];
    const start = (merchantExpiredPage - 1) * MERCHANT_TABLE_PAGE_SIZE;
    return rows.slice(start, start + MERCHANT_TABLE_PAGE_SIZE);
  }, [overviewTables?.merchantExpiredRows, merchantExpiredPage]);

  const merchantActivePageItems = React.useMemo(
    () => getPageItems(merchantActivePage, merchantActiveTotalPages),
    [merchantActivePage, merchantActiveTotalPages]
  );

  const merchantProductivePageItems = React.useMemo(
    () => getPageItems(merchantProductivePage, merchantProductiveTotalPages),
    [merchantProductivePage, merchantProductiveTotalPages]
  );

  const merchantNotActivePageItems = React.useMemo(
    () => getPageItems(merchantNotActivePage, merchantNotActiveTotalPages),
    [merchantNotActivePage, merchantNotActiveTotalPages]
  );

  const merchantExpiredPageItems = React.useMemo(
    () => getPageItems(merchantExpiredPage, merchantExpiredTotalPages),
    [merchantExpiredPage, merchantExpiredTotalPages]
  );

  const stats: StatCard[] = React.useMemo(() => {
    if (!data) return [];
    return [
      {
        id: "transaction-success",
        label: "Transaction Success",
        unit: "transaksi",
        currentTotal: data.cards.success.current,
        previousTotal: data.cards.success.previous,
        series: data.cards.success.series,
      },
      {
        id: "transaction-failed",
        label: "Transaction Failed",
        unit: "transaksi",
        currentTotal: data.cards.failed.current,
        previousTotal: data.cards.failed.previous,
        series: data.cards.failed.series,
      },
    ];
  }, [data]);

  const summary = React.useMemo(() => {
    if (!data) return null;
    const success = data.cards.success.current;
    const failed = data.cards.failed.current;
    const total = success + failed;
    const rate = total > 0 ? (success / total) * 100 : 0;
    return { total, rate };
  }, [data]);

  if (!data) {
    return (
      <div className="px-4 text-sm text-muted-foreground lg:px-6">
        {loading ? "Memuat data..." : "Tidak ada data"}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 px-4 lg:px-6">
        <div className="text-sm font-medium text-muted-foreground">Ringkasan bulan</div>
        <DashboardFilterControls />
      </div>

      <SectionCards
        monthLabel={data.monthLabel}
        previousMonthLabel={data.previousMonthLabel}
        stats={stats}
        className="mx-auto w-full max-w-4xl px-0 sm:grid-cols-2 @xl/main:grid-cols-2 @5xl/main:grid-cols-2"
      />

      {summary ? (
        <div className="flex flex-wrap items-center gap-3 px-4 text-sm text-muted-foreground lg:px-6">
          <Badge variant="secondary" className="px-4 py-2 text-sm">
            Success Rate: {formatPercent(summary.rate)} %
          </Badge>
          <Badge variant="secondary" className="px-4 py-2 text-sm">
            Total: {formatNumber(summary.total)} transaksi
          </Badge>
        </div>
      ) : null}

      {loading ? (
        <div className="px-4 text-xs text-muted-foreground lg:px-6">Memuat data terbaru...</div>
      ) : null}

      <div className="grid gap-6 px-4 lg:px-6">
        <TableCard title="Top Merchant">
          <Table className={tableClassName}>
            <TableHeader className="bg-slate-900 text-slate-100">
              <TableRow>
                <TableHead>Nama Merchant</TableHead>
                <TableHead>Uniq Merchant</TableHead>
                <TableHead>Keyword</TableHead>
                <TableHead>Jumlah Transaksi</TableHead>
                <TableHead>Uniq Redeemer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topMerchants.length ? (
                data.topMerchants.map((row) => (
                  <TableRow key={`${row.merchant}-${row.keyword}`}>
                    <TableCell className="font-medium">{row.merchant}</TableCell>
                    <TableCell>{row.uniqMerchant}</TableCell>
                    <TableCell>{row.keyword}</TableCell>
                    <TableCell>{row.totalTransactions}</TableCell>
                    <TableCell>{row.uniqRedeemer}</TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-16 text-center text-sm text-muted-foreground">
                    Tidak ada data top merchant.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableCard>

        {overviewTables ? (
          <DataTable
            data={{
              cluster: overviewTables.branchTable.branches,
              category: overviewTables.categoryTable,
            }}
          />
        ) : null}

        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-muted-foreground">Rule Expired</div>
          <Select value={expiryScope} onValueChange={(value) => setExpiryScope(value as "month" | "upcoming")}>
            <SelectTrigger className="h-9 w-[220px]" size="sm" aria-label="Pilih cakupan expired">
              <SelectValue placeholder="Cakupan expired" />
            </SelectTrigger>
            <SelectContent className="rounded-xl">
              <SelectItem value="month" className="rounded-lg">
                Bulan Ini
              </SelectItem>
              <SelectItem value="upcoming" className="rounded-lg">
                Semua Upcoming
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <TableCard title={expiryScope === "month" ? "Rule Expired Bulan Ini" : "Rule Expired Upcoming"}>
          <Table className={tableClassName}>
            <TableHeader className="bg-slate-900 text-slate-100">
              <TableRow>
                <TableHead>Nama Merchant</TableHead>
                <TableHead>Keyword</TableHead>
                <TableHead>Mulai</TableHead>
                <TableHead>Berakhir</TableHead>
                <TableHead>Hari Tersisa</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.expiredRules.length ? (
                data.expiredRules.map((row) => (
                  <TableRow key={`${row.merchant}-${row.keyword}-${row.endPeriod}`}>
                    <TableCell className="font-medium">{row.merchant}</TableCell>
                    <TableCell>{row.keyword}</TableCell>
                    <TableCell>{row.startPeriod}</TableCell>
                    <TableCell>{row.endPeriod}</TableCell>
                    <TableCell className={row.daysLeft < 0 ? "text-red-600" : row.daysLeft <= 7 ? "font-bold text-orange-500" : ""}>
                      {row.daysLeft}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-16 text-center text-sm text-muted-foreground">
                    Tidak ada rule sesuai filter.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableCard>

        <TableCard title="Rule Sudah Expired">
          <Table className={tableClassName}>
            <TableHeader className="bg-slate-900 text-slate-100">
              <TableRow>
                <TableHead>Nama Merchant</TableHead>
                <TableHead>Keyword</TableHead>
                <TableHead>Mulai</TableHead>
                <TableHead>Berakhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.expiredPastRules.length ? (
                data.expiredPastRules.map((row) => (
                  <TableRow key={`${row.merchant}-${row.keyword}-${row.endPeriod}`}>
                    <TableCell className="font-medium">{row.merchant}</TableCell>
                    <TableCell>{row.keyword}</TableCell>
                    <TableCell>{row.startPeriod}</TableCell>
                    <TableCell>{row.endPeriod}</TableCell>
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
        </TableCard>

        {overviewTables ? (
          <div
            id="merchant-active"
            className={`scroll-mt-24 rounded-xl transition-all duration-500 ${
              highlightedSection === "merchant-active" ? "ring-2 ring-primary/70 shadow-lg shadow-primary/15" : ""
            }`}
          >
            <TableCard title="Merchant Active ✅">
              {highlightedSection === "merchant-active" ? (
                <div className="px-6 pt-4 text-xs font-medium text-primary">Focused from Overview</div>
              ) : null}
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
                  {merchantActiveRowsPaged.length ? (
                    merchantActiveRowsPaged.map((row) => (
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
              {merchantActiveTotalPages > 1 ? (
                <div className="mt-4 flex items-center justify-end gap-1 px-5 pb-2 text-sm">
                  {merchantActivePageItems.map((item, index) =>
                    item === "..." ? (
                      <span key={`merchant-active-ellipsis-${index}`} className="px-2 py-1 text-xs text-muted-foreground">
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        className={`rounded-md border px-3 py-1.5 text-sm ${
                          item === merchantActivePage
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted"
                        }`}
                        onClick={() => setMerchantActivePage(item)}
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>
              ) : null}
            </TableCard>
          </div>
        ) : null}

        {overviewTables ? (
          <div
            id="merchant-productive"
            className={`scroll-mt-24 rounded-xl transition-all duration-500 ${
              highlightedSection === "merchant-productive" ? "ring-2 ring-primary/70 shadow-lg shadow-primary/15" : ""
            }`}
          >
            <TableCard title="Merchant Productive 🥇">
              {highlightedSection === "merchant-productive" ? (
                <div className="px-6 pt-4 text-xs font-medium text-primary">Focused from Overview</div>
              ) : null}
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
                  {merchantProductiveRowsPaged.length ? (
                    merchantProductiveRowsPaged.map((row) => (
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
              {merchantProductiveTotalPages > 1 ? (
                <div className="mt-4 flex items-center justify-end gap-1 px-5 pb-2 text-sm">
                  {merchantProductivePageItems.map((item, index) =>
                    item === "..." ? (
                      <span key={`merchant-productive-ellipsis-${index}`} className="px-2 py-1 text-xs text-muted-foreground">
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        className={`rounded-md border px-3 py-1.5 text-sm ${
                          item === merchantProductivePage
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted"
                        }`}
                        onClick={() => setMerchantProductivePage(item)}
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>
              ) : null}
            </TableCard>
          </div>
        ) : null}

        {overviewTables ? (
          <div
            id="merchant-not-active"
            className={`scroll-mt-24 rounded-xl transition-all duration-500 ${
              highlightedSection === "merchant-not-active" ? "ring-2 ring-primary/70 shadow-lg shadow-primary/15" : ""
            }`}
          >
            <TableCard title="Merchant Not Active ⚠️">
              {highlightedSection === "merchant-not-active" ? (
                <div className="px-6 pt-4 text-xs font-medium text-primary">Focused from Overview</div>
              ) : null}
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
                  {merchantNotActiveRowsPaged.length ? (
                    merchantNotActiveRowsPaged.map((row) => (
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
              {merchantNotActiveTotalPages > 1 ? (
                <div className="mt-4 flex items-center justify-end gap-1 px-5 pb-2 text-sm">
                  {merchantNotActivePageItems.map((item, index) =>
                    item === "..." ? (
                      <span key={`merchant-not-active-ellipsis-${index}`} className="px-2 py-1 text-xs text-muted-foreground">
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        className={`rounded-md border px-3 py-1.5 text-sm ${
                          item === merchantNotActivePage
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted"
                        }`}
                        onClick={() => setMerchantNotActivePage(item)}
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>
              ) : null}
            </TableCard>
          </div>
        ) : null}

        {overviewTables ? (
          <div
            id="merchant-expired"
            className={`scroll-mt-24 rounded-xl transition-all duration-500 ${
              highlightedSection === "merchant-expired" ? "ring-2 ring-primary/70 shadow-lg shadow-primary/15" : ""
            }`}
          >
            <TableCard title="Merchant Expired ⏳">
              {highlightedSection === "merchant-expired" ? (
                <div className="px-6 pt-4 text-xs font-medium text-primary">Focused from Overview</div>
              ) : null}
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
                  {merchantExpiredRowsPaged.length ? (
                    merchantExpiredRowsPaged.map((row) => (
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
              {merchantExpiredTotalPages > 1 ? (
                <div className="mt-4 flex items-center justify-end gap-1 px-5 pb-2 text-sm">
                  {merchantExpiredPageItems.map((item, index) =>
                    item === "..." ? (
                      <span key={`merchant-expired-ellipsis-${index}`} className="px-2 py-1 text-xs text-muted-foreground">
                        ...
                      </span>
                    ) : (
                      <button
                        key={item}
                        type="button"
                        className={`rounded-md border px-3 py-1.5 text-sm ${
                          item === merchantExpiredPage
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background hover:bg-muted"
                        }`}
                        onClick={() => setMerchantExpiredPage(item)}
                      >
                        {item}
                      </button>
                    )
                  )}
                </div>
              ) : null}
            </TableCard>
          </div>
        ) : null}
      </div>
    </div>
  );
}
