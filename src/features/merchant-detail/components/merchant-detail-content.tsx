"use client";

import * as React from "react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { IconChartBar, IconClockHour4, IconReceipt2, IconSearch } from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Card, CardAction, CardContent, CardDescription, CardHeader } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MerchantBannerAssetCard } from "@/features/merchant-detail/components/merchant-banner-asset-card";
import type { MonthOption } from "@/features/shared/get-month-options";
import { QueryParamSelect } from "@/features/shared/components/query-param-select";
import { formatNumber } from "@/lib/dashboard-metrics";
import { cn } from "@/lib/utils";

type ProgramBannerAssetRecord = {
  id: number;
  keywordCode: string | null;
  imageUrl: string;
  isActive: boolean;
  updatedAt: string;
};

type MerchantDetailContentProps = {
  data: {
    month: string;
    monthLabel: string;
    previousMonthLabel: string;
    identity: {
      keyword: string;
      merchant: string;
      uniqMerchant: string;
      category: string;
      branch: string;
      cluster: string;
      region: string;
    };
    cards: {
      totalTransactions: { current: number; previous: number };
      uniqueRedeemer: { current: number; previous: number };
      totalPoint: { current: number; previous: number };
    };
    monthlyPerformance: {
      month: string;
      redeem: number;
      uniqueRedeem: number;
    }[];
    keywordComposition: {
      name: string;
      value: number;
    }[];
    dailyTrend: {
      date: string;
      redeem: number;
      uniqueRedeemer: number;
      totalPoint: number;
    }[];
    ruleStatuses: {
      keyword: string;
      status: string;
      startPeriod: string;
      endPeriod: string;
      daysLeft: number;
    }[];
    transactions: {
      transactionAt: string;
      keyword: string;
      status: string;
      qty: number;
      totalPoint: number;
      branch: string;
    }[];
  };
  monthOptions: MonthOption[];
  programBannerAsset: ProgramBannerAssetRecord | null;
};

type TrendMode = "monthly" | "daily";

const trendConfig = {
  redeem: { label: "Redeem", color: "var(--chart-1)" },
  uniqueRedeem: { label: "Unique Redeem", color: "var(--chart-2)" },
} satisfies ChartConfig;

const formatMonthTick = (value: string) =>
  new Date(`${value}-01`).toLocaleDateString("id-ID", { month: "short" });

const formatDateShort = (value: string) =>
  new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "short" });

const formatDateFull = (value: string) =>
  new Date(value).toLocaleDateString("id-ID", { day: "2-digit", month: "long", year: "numeric" });

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("id-ID", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

const getDelta = (current: number, previous: number) => {
  if (previous <= 0) {
    return current > 0 ? 100 : 0;
  }
  return ((current - previous) / previous) * 100;
};

function DeltaBadge({ current, previous }: { current: number; previous: number }) {
  const delta = getDelta(current, previous);
  const isPositive = delta >= 0;
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full border-0 px-2.5 py-1 text-xs font-semibold",
        isPositive
          ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300"
          : "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
      )}
    >
      {isPositive ? "+" : ""}
      {delta.toLocaleString("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: 1 })}%
    </Badge>
  );
}

function MetricCard({
  title,
  current,
  previous,
  monthLabel,
  previousMonthLabel,
}: {
  title: string;
  current: number;
  previous: number;
  monthLabel: string;
  previousMonthLabel: string;
}) {
  return (
    <Card className="gap-0 overflow-hidden border border-border/70 py-0 shadow-sm">
      <CardHeader className="min-h-40 px-6 py-5">
        <CardDescription className="text-xs font-semibold tracking-[0.28em] uppercase">
          {title}
        </CardDescription>
        <div className="pt-1 text-4xl font-bold tracking-tight text-foreground">
          {formatNumber(current)}
        </div>
        <CardAction>
          <DeltaBadge current={current} previous={previous} />
        </CardAction>
      </CardHeader>
      <CardContent className="border-t-2 border-secondary px-6 py-4">
        <div className="flex items-center justify-between gap-4 text-sm font-semibold text-foreground">
          <span>{monthLabel}</span>
          <span>{formatNumber(current)}</span>
        </div>
        <div className="mt-1 flex items-center justify-between gap-4 text-sm text-muted-foreground">
          <span>{previousMonthLabel}</span>
          <span>{formatNumber(previous)}</span>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  if (normalized === "active") {
    return (
      <Badge className="border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/15">
        Active
      </Badge>
    );
  }
  if (normalized === "success") {
    return (
      <Badge className="border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/15">
        success
      </Badge>
    );
  }
  if (normalized === "failed") {
    return (
      <Badge className="border-transparent bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/15">
        failed
      </Badge>
    );
  }
  if (normalized === "scheduled") {
    return (
      <Badge className="border-transparent bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/15">
        Scheduled
      </Badge>
    );
  }
  return (
    <Badge className="border-transparent bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/10">
      Expired
    </Badge>
  );
}

function SectionHeader({
  icon,
  title,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
          {icon}
        </div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
      </div>
      {action}
    </div>
  );
}

export function MerchantDetailContent({
  data,
  monthOptions,
  programBannerAsset,
}: MerchantDetailContentProps) {
  const [trendMode, setTrendMode] = React.useState<TrendMode>("monthly");
  const [searchQuery, setSearchQuery] = React.useState("");
  const deferredSearchQuery = React.useDeferredValue(searchQuery);
  const [currentPage, setCurrentPage] = React.useState(1);
  const primaryRule = data.ruleStatuses[0] ?? null;

  const transactionRows = React.useMemo(
    () =>
      data.transactions.map((row) => ({
        ...row,
        searchValue: `${row.keyword} ${row.status} ${row.branch}`.toLowerCase(),
      })),
    [data.transactions],
  );

  const filteredTransactions = React.useMemo(() => {
    const normalized = deferredSearchQuery.trim().toLowerCase();
    if (!normalized) return transactionRows;
    return transactionRows.filter((row) => row.searchValue.includes(normalized));
  }, [deferredSearchQuery, transactionRows]);

  const pageSize = 10;
  const totalPages = Math.max(1, Math.ceil(filteredTransactions.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedTransactions = React.useMemo(() => {
    const startIndex = (safePage - 1) * pageSize;
    return filteredTransactions.slice(startIndex, startIndex + pageSize);
  }, [filteredTransactions, safePage]);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  return (
    <div className="space-y-6 px-4 pb-8 lg:px-6">
      <div className="rounded-3xl border border-border/70 bg-gradient-to-r from-background via-background to-primary/5 px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink asChild>
                    <Link
                      href={
                        data.month
                          ? `/merchant?month=${encodeURIComponent(data.month)}`
                          : "/merchant"
                      }
                    >
                      Merchant
                    </Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  <BreadcrumbPage>{data.identity.keyword}</BreadcrumbPage>
                </BreadcrumbItem>
              </BreadcrumbList>
            </Breadcrumb>
            <div className="space-y-1">
              <h1 className="text-3xl font-bold tracking-tight text-foreground">
                {data.identity.keyword}
              </h1>
              <p className="text-base text-muted-foreground">{data.identity.merchant}</p>
            </div>
            <div className="flex flex-wrap gap-2 text-sm text-muted-foreground">
              <Badge
                variant="outline"
                className="rounded-full border-border bg-background px-3 py-1"
              >
                {data.identity.category}
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full border-border bg-background px-3 py-1"
              >
                {data.identity.branch}
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full border-border bg-background px-3 py-1"
              >
                {data.identity.cluster}
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full border-border bg-background px-3 py-1"
              >
                {data.identity.region}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-1">
              <div className="space-y-1">
                <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  Start Period
                </div>
                <div className="text-base font-semibold text-foreground">
                  {primaryRule?.startPeriod ?? "-"}
                </div>
              </div>
              <div className="hidden h-8 w-px bg-border sm:block" />
              <div className="space-y-1">
                <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-muted-foreground">
                  End Period
                </div>
                <div className="text-base font-semibold text-foreground">
                  {primaryRule?.endPeriod ?? "-"}
                </div>
              </div>
              <div className="hidden h-8 w-px bg-border sm:block" />
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-border bg-background px-3 text-base font-bold text-foreground shadow-sm transition-colors hover:bg-accent"
                  >
                    {primaryRule ? formatNumber(primaryRule.daysLeft) : "-"}
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Day left</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
          <div className="flex w-full flex-col items-stretch gap-3 lg:w-auto lg:items-end">
            {primaryRule ? <StatusBadge status={primaryRule.status} /> : null}
            <QueryParamSelect
              value={data.month}
              options={monthOptions}
              paramKey="month"
              allLabel="Semua bulan"
              placeholder="Pilih bulan"
              ariaLabel="Pilih bulan detail merchant"
              className="w-full min-w-[220px] bg-background lg:w-[220px]"
            />
          </div>
        </div>
      </div>

      <MerchantBannerAssetCard
        keywordCode={data.identity.keyword}
        initialAsset={programBannerAsset}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <MetricCard
          title="TOTAL TRANSAKSI"
          current={data.cards.totalTransactions.current}
          previous={data.cards.totalTransactions.previous}
          monthLabel={data.monthLabel}
          previousMonthLabel={data.previousMonthLabel}
        />
        <MetricCard
          title="UNIQUE REDEEMER"
          current={data.cards.uniqueRedeemer.current}
          previous={data.cards.uniqueRedeemer.previous}
          monthLabel={data.monthLabel}
          previousMonthLabel={data.previousMonthLabel}
        />
        <MetricCard
          title="BURNING POIN"
          current={data.cards.totalPoint.current}
          previous={data.cards.totalPoint.previous}
          monthLabel={data.monthLabel}
          previousMonthLabel={data.previousMonthLabel}
        />
      </div>

      <div className="grid gap-6">
        <Card className="gap-0 overflow-hidden border border-border/70 py-0 shadow-sm">
          <CardHeader className="border-b px-6 py-5">
            <SectionHeader
              icon={<IconChartBar className="size-5" />}
              title="Merchant Analytics"
              action={
                <Tabs value={trendMode} onValueChange={(value) => setTrendMode(value as TrendMode)}>
                  <TabsList className="rounded-full bg-muted p-1">
                    <TabsTrigger value="monthly" className="rounded-full px-3">
                      Monthly
                    </TabsTrigger>
                    <TabsTrigger value="daily" className="rounded-full px-3">
                      Daily
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              }
            />
            <CardDescription>{data.monthLabel}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 px-6 py-5">
            <div className="flex flex-wrap gap-8">
              <div>
                <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Redeem
                </div>
                <div className="text-5xl font-bold tracking-tight text-foreground">
                  {formatNumber(data.cards.totalTransactions.current)}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                  Unique Redeem
                </div>
                <div className="text-5xl font-bold tracking-tight text-foreground">
                  {formatNumber(data.cards.uniqueRedeemer.current)}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-5 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-primary" />
                <span>Redeem</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="size-3 rounded-full bg-secondary" />
                <span>Unique Redeem</span>
              </div>
            </div>
            <ChartContainer config={trendConfig} className="h-[320px] w-full">
              <BarChart
                data={
                  trendMode === "monthly"
                    ? data.monthlyPerformance
                    : data.dailyTrend.map((row) => ({
                        month: row.date,
                        redeem: row.redeem,
                        uniqueRedeem: row.uniqueRedeemer,
                      }))
                }
                margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  minTickGap={24}
                  tickFormatter={(value) =>
                    trendMode === "monthly"
                      ? formatMonthTick(String(value))
                      : formatDateShort(String(value))
                  }
                />
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      indicator="dot"
                      labelFormatter={(value) =>
                        trendMode === "monthly"
                          ? new Date(`${value}-01`).toLocaleDateString("id-ID", {
                              month: "long",
                              year: "numeric",
                            })
                          : formatDateFull(String(value))
                      }
                    />
                  }
                />
                <Bar
                  dataKey="redeem"
                  stackId="performance"
                  fill="var(--chart-1)"
                  radius={[4, 4, 0, 0]}
                />
                <Bar
                  dataKey="uniqueRedeem"
                  stackId="performance"
                  fill="var(--chart-2)"
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>

        {/* <Card className="gap-0 overflow-hidden border border-border/70 py-0 shadow-sm">
          <CardHeader className="px-6 py-5">
            <SectionHeader
              icon={<IconChartDonut3 className="size-5" />}
              title="Keyword Composition"
            />
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-0">
            <div className="grid gap-6 lg:grid-cols-[220px_1fr] lg:items-center">
              <div className="mx-auto h-[220px] w-[220px]">
                <ChartContainer
                  config={{
                    composition: { label: "Redeem", color: CHART_COLORS[0] },
                  }}
                  className="h-[220px] w-[220px]"
                >
                  <PieChart>
                    <Pie
                      data={data.keywordComposition}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={52}
                      outerRadius={90}
                      stroke="#ffffff"
                      strokeWidth={3}
                      labelLine={false}
                      label={({ percent }) =>
                        percent && percent > 0
                          ? `${(percent * 100).toLocaleString("id-ID", { maximumFractionDigits: 0 })}%`
                          : ""
                      }
                    >
                      {data.keywordComposition.map((item, index) => (
                        <Cell key={item.name} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          hideIndicator
                          labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? "Keyword"}
                          formatter={(value) => {
                            const amount = Number(value ?? 0);
                            const percent =
                              compositionTotal > 0 ? (amount / compositionTotal) * 100 : 0;
                            return (
                              <div className="grid min-w-[10rem] gap-1">
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">Redeem</span>
                                  <span className="font-mono font-medium tabular-nums text-foreground">
                                    {formatNumber(amount)}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between gap-3">
                                  <span className="text-muted-foreground">Share</span>
                                  <span className="font-mono font-medium tabular-nums text-foreground">
                                    {percent.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
                                  </span>
                                </div>
                              </div>
                            );
                          }}
                        />
                      }
                    />
                  </PieChart>
                </ChartContainer>
              </div>
              <div className="space-y-3">
                {data.keywordComposition.map((item, index) => {
                  const percent = compositionTotal > 0 ? (item.value / compositionTotal) * 100 : 0;
                  return (
                    <div
                      key={item.name}
                      className="flex items-center justify-between gap-4 text-sm"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <span
                          className="size-3 rounded-full"
                          style={{ backgroundColor: CHART_COLORS[index % CHART_COLORS.length] }}
                        />
                        <span className="truncate font-medium text-foreground">{item.name}</span>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="font-semibold text-foreground">
                          {percent.toLocaleString("id-ID", { maximumFractionDigits: 0 })}%
                        </div>
                        <div className="text-muted-foreground">{formatNumber(item.value)}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </CardContent>
        </Card> */}
      </div>

      <div className="grid gap-6">
        <Card className="gap-0 overflow-hidden border border-border/70 py-0 shadow-sm">
          <CardHeader className="border-b px-6 py-5">
            <SectionHeader icon={<IconClockHour4 className="size-5" />} title="My Trend (Daily)" />
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead>DATE</TableHead>
                  <TableHead>REDEEM</TableHead>
                  <TableHead>UNIQUE REDEEMER</TableHead>
                  <TableHead>BURNING POIN</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.dailyTrend.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                      Tidak ada transaksi pada bulan ini.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.dailyTrend.map((row) => (
                    <TableRow key={row.date}>
                      <TableCell className="font-medium">{row.date}</TableCell>
                      <TableCell>{formatNumber(row.redeem)}</TableCell>
                      <TableCell>{formatNumber(row.uniqueRedeemer)}</TableCell>
                      <TableCell>{formatNumber(row.totalPoint)}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card className="gap-0 overflow-hidden border border-border/70 py-0 shadow-sm">
        <CardHeader className="border-b px-6 py-5">
          <SectionHeader icon={<IconReceipt2 className="size-5" />} title="My Transaction Detail" />
          <CardDescription>Search and paginate merchant transactions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5 px-6 py-5">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(event) => {
                setSearchQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search keyword / status / branch"
              className="h-12 rounded-full border-border bg-background pl-11"
            />
          </div>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  <TableHead>TIME</TableHead>
                  <TableHead>KEYWORD</TableHead>
                  <TableHead>STATUS</TableHead>
                  <TableHead>QTY</TableHead>
                  <TableHead>TOTAL</TableHead>
                  <TableHead>BRANCH</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedTransactions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                      Tidak ada transaksi yang cocok.
                    </TableCell>
                  </TableRow>
                ) : (
                  paginatedTransactions.map((row) => (
                    <TableRow key={`${row.transactionAt}-${row.keyword}-${row.status}`}>
                      <TableCell className="font-medium">
                        {formatDateTime(row.transactionAt)}
                      </TableCell>
                      <TableCell>{row.keyword}</TableCell>
                      <TableCell>
                        <StatusBadge status={row.status} />
                      </TableCell>
                      <TableCell>{formatNumber(row.qty)}</TableCell>
                      <TableCell>{formatNumber(row.totalPoint)}</TableCell>
                      <TableCell>{row.branch}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex flex-col gap-3 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div>
              Showing {filteredTransactions.length === 0 ? 0 : (safePage - 1) * pageSize + 1} to{" "}
              {Math.min(safePage * pageSize, filteredTransactions.length)} of{" "}
              {filteredTransactions.length}
            </div>
            <div className="flex items-center gap-2 self-end">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                Prev
              </Button>
              {Array.from({ length: Math.min(totalPages, 5) }, (_, index) => {
                const pageNumber = index + 1;
                return (
                  <Button
                    key={pageNumber}
                    variant={pageNumber === safePage ? "default" : "outline"}
                    size="icon-sm"
                    className="rounded-full"
                    onClick={() => setCurrentPage(pageNumber)}
                  >
                    {pageNumber}
                  </Button>
                );
              })}
              {totalPages > 5 ? <span className="px-1">...</span> : null}
              {totalPages > 5 ? (
                <Button
                  variant={safePage === totalPages ? "default" : "outline"}
                  size="icon-sm"
                  className="rounded-full"
                  onClick={() => setCurrentPage(totalPages)}
                >
                  {totalPages}
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
