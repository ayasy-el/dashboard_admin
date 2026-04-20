"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  IconBuildingStore,
  IconChecklist,
  IconChevronsLeft,
  IconChevronsRight,
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronUp,
  IconCoins,
  IconSearch,
  IconStars,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useGlobalLoading } from "@/components/global-loading-provider";
import type { MonthOption } from "@/features/shared/get-month-options";
import { QueryParamSelect } from "@/features/shared/components/query-param-select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatNumber } from "@/lib/dashboard-metrics";
import { cn } from "@/lib/utils";

type MerchantDirectoryOverviewProps = {
  data: {
    month: string;
    monthLabel: string;
    summary: {
      totalKeywords: number;
      totalUniqueMerchants: number;
      activeKeywords: number;
      productiveKeywords: number;
      totalTransactions: number;
      totalPoint: number;
    };
    merchants: {
      keyword: string;
      merchant: string;
      category: string;
      branch: string;
      cluster: string;
      region: string;
      pointRedeem: number;
      ruleStatus: string;
      startPeriod: string | null;
      endPeriod: string | null;
      redeem: number;
      uniqueRedeemer: number;
      totalPoint: number;
      lastTransactionAt: string | null;
    }[];
  };
  monthOptions: MonthOption[];
};

const statusTone: Record<string, string> = {
  active: "border-transparent bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  scheduled: "border-transparent bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  expired: "border-transparent bg-slate-200 text-slate-700 dark:bg-white/10 dark:text-slate-200",
  inactive: "border-transparent bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300",
};
type SortKey =
  | "keyword"
  | "merchant"
  | "category"
  | "branch"
  | "ruleStatus"
  | "pointRedeem"
  | "redeem"
  | "uniqueRedeemer";
type SortDirection = "asc" | "desc";

const sortColumns: { key: SortKey; label: string }[] = [
  { key: "keyword", label: "KEYWORD" },
  { key: "merchant", label: "MERCHANT" },
  { key: "category", label: "CATEGORY" },
  { key: "branch", label: "BRANCH" },
  { key: "ruleStatus", label: "PERIOD" },
  { key: "pointRedeem", label: "POINT" },
  { key: "redeem", label: "REDEEM" },
  { key: "uniqueRedeemer", label: "UNIQUE REDEEMER" },
];

const compareText = (left: string, right: string, direction: SortDirection) => {
  const result = left.localeCompare(right, "id", { numeric: true, sensitivity: "base" });
  return direction === "asc" ? result : -result;
};

const compareNumber = (left: number, right: number, direction: SortDirection) =>
  direction === "asc" ? left - right : right - left;

function SortButton({
  label,
  active,
  direction,
  onClick,
}: {
  label: string;
  active: boolean;
  direction?: SortDirection;
  onClick: () => void;
}) {
  return (
    <button type="button" className="inline-flex items-center gap-1 font-inherit" onClick={onClick}>
      <span>{label}</span>
      {active ? (
        direction === "asc" ? (
          <IconChevronUp className="size-3.5" />
        ) : (
          <IconChevronDown className="size-3.5" />
        )
      ) : (
        <span className="inline-flex flex-col text-muted-foreground/50">
          <IconChevronUp className="-mb-1 size-3" />
          <IconChevronDown className="-mt-1 size-3" />
        </span>
      )}
    </button>
  );
}

function SummaryCard({
  title,
  value,
  description,
  icon,
}: {
  title: string;
  value: number;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <Card className="gap-0 overflow-hidden border border-border/70 py-0 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between px-6 py-5">
        <div>
          <CardDescription className="text-xs font-semibold tracking-[0.24em] uppercase">
            {title}
          </CardDescription>
          <CardTitle className="mt-2 text-3xl font-bold text-foreground">{formatNumber(value)}</CardTitle>
        </div>
        <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">{icon}</div>
      </CardHeader>
      <CardContent className="px-6 pb-5 pt-0 text-sm text-muted-foreground">{description}</CardContent>
    </Card>
  );
}

export function MerchantDirectoryOverview({ data, monthOptions }: MerchantDirectoryOverviewProps) {
  const router = useRouter();
  const { startNavigation } = useGlobalLoading();
  const [query, setQuery] = React.useState("");
  const deferredQuery = React.useDeferredValue(query);
  const [sortState, setSortState] = React.useState<{ key: SortKey; direction: SortDirection }>({
    key: "redeem",
    direction: "desc",
  });
  const [rowsPerPage, setRowsPerPage] = React.useState(10);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageInput, setPageInput] = React.useState("1");

  const filteredMerchants = React.useMemo(() => {
    const normalized = deferredQuery.trim().toLowerCase();
    if (!normalized) return data.merchants;

    return data.merchants.filter((merchant) =>
      [
        merchant.keyword,
        merchant.merchant,
        merchant.category,
        merchant.branch,
        merchant.cluster,
        merchant.region,
        merchant.ruleStatus,
        merchant.startPeriod ?? "",
        merchant.endPeriod ?? "",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [data.merchants, deferredQuery]);

  const sortedMerchants = React.useMemo(() => {
    const next = [...filteredMerchants];
    next.sort((left, right) => {
      switch (sortState.key) {
        case "keyword":
          return compareText(left.keyword, right.keyword, sortState.direction);
        case "merchant":
          return compareText(left.merchant, right.merchant, sortState.direction);
        case "category":
          return compareText(left.category, right.category, sortState.direction);
        case "branch":
          return compareText(left.branch, right.branch, sortState.direction);
        case "ruleStatus":
          return compareText(left.ruleStatus, right.ruleStatus, sortState.direction);
        case "pointRedeem":
          return compareNumber(left.pointRedeem, right.pointRedeem, sortState.direction);
        case "redeem":
          return compareNumber(left.redeem, right.redeem, sortState.direction);
        case "uniqueRedeemer":
          return compareNumber(left.uniqueRedeemer, right.uniqueRedeemer, sortState.direction);
        default:
          return 0;
      }
    });
    return next;
  }, [filteredMerchants, sortState]);

  const toggleSort = (key: SortKey) => {
    setSortState((current) => {
      if (current.key !== key) return { key, direction: "asc" };
      return { key, direction: current.direction === "asc" ? "desc" : "asc" };
    });
    setCurrentPage(1);
  };

  const totalRows = sortedMerchants.length;
  const totalPages = Math.max(1, Math.ceil(totalRows / rowsPerPage));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = totalRows === 0 ? 0 : (safePage - 1) * rowsPerPage;
  const paginatedMerchants = sortedMerchants.slice(startIndex, startIndex + rowsPerPage);

  React.useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  React.useEffect(() => {
    setPageInput(String(safePage));
  }, [safePage]);

  const commitPageInput = () => {
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsed)) {
      setPageInput(String(safePage));
      return;
    }
    setCurrentPage(Math.min(totalPages, Math.max(1, parsed)));
  };

  return (
    <div className="space-y-6 px-4 pb-8 lg:px-6">
      <div className="flex flex-col gap-4 rounded-3xl border border-border/70 bg-gradient-to-r from-background via-background to-primary/5 px-6 py-5 shadow-sm lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <div className="text-sm font-medium uppercase tracking-[0.24em] text-muted-foreground">Merchant Directory</div>
          <div className="space-y-1">
            <h1 className="text-3xl font-bold tracking-tight text-foreground">All Merchants</h1>
            <p className="text-base text-muted-foreground">Daftar keyword merchant dan ringkasan performa untuk {data.monthLabel}.</p>
          </div>
        </div>
        <QueryParamSelect
          value={data.month}
          options={monthOptions}
          paramKey="month"
          allLabel="Semua bulan"
          placeholder="Pilih bulan"
          ariaLabel="Pilih bulan merchant"
          className="w-full min-w-[220px] bg-background lg:w-[220px]"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-4">
        <SummaryCard
          title="TOTAL KEYWORDS"
          value={data.summary.totalKeywords}
          description="Jumlah seluruh keyword merchant yang tersedia."
          icon={<IconBuildingStore className="size-5" />}
        />
        <SummaryCard
          title="UNIQUE MERCHANTS"
          value={data.summary.totalUniqueMerchants}
          description="Jumlah merchant unik dari seluruh keyword."
          icon={<IconChecklist className="size-5" />}
        />
        <SummaryCard
          title="ACTIVE KEYWORDS"
          value={data.summary.activeKeywords}
          description="Keyword dengan rule aktif pada periode terpilih."
          icon={<IconStars className="size-5" />}
        />
        <SummaryCard
          title="BURNING POIN"
          value={data.summary.totalPoint}
          description={`Total poin terbakar dari ${formatNumber(data.summary.totalTransactions)} transaksi sukses.`}
          icon={<IconCoins className="size-5" />}
        />
      </div>

      <Card className="gap-0 overflow-hidden border border-border/70 py-0 shadow-sm">
        <CardHeader className="border-b px-6 py-5">
          <CardTitle className="text-xl text-foreground">Merchant List</CardTitle>
          <CardDescription>Klik merchant untuk membuka halaman detail baru.</CardDescription>
          <div className="relative mt-4">
            <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search keyword / merchant / category / branch / status"
              className="h-10 rounded-full border-border bg-background pl-10"
            />
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/60 hover:bg-muted/60">
                  {sortColumns.map((column) => (
                    <TableHead key={column.key}>
                      <SortButton
                        label={column.label}
                        active={sortState.key === column.key}
                        direction={sortState.key === column.key ? sortState.direction : undefined}
                        onClick={() => toggleSort(column.key)}
                      />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedMerchants.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                      Merchant tidak ditemukan.
                    </TableCell>
                  </TableRow>
                ) : (
                paginatedMerchants.map((merchant) => {
                  const href = `/merchant/${encodeURIComponent(merchant.keyword)}?month=${encodeURIComponent(data.month)}`;
                  return (
                    <TableRow
                      key={merchant.keyword}
                      className="cursor-pointer transition-colors hover:bg-muted/60"
                      onClick={() => {
                        startNavigation();
                        router.push(href);
                      }}
                    >
                      <TableCell className="font-semibold text-foreground">{merchant.keyword}</TableCell>
                      <TableCell>
                        <div className="font-medium text-foreground">{merchant.merchant}</div>
                        <div className="text-xs text-muted-foreground">
                          {merchant.cluster}, {merchant.region}
                        </div>
                      </TableCell>
                      <TableCell>{merchant.category}</TableCell>
                      <TableCell>{merchant.branch}</TableCell>
                      <TableCell>
                        <div className="space-y-1">
                          <Badge className={cn("hover:bg-inherit", statusTone[merchant.ruleStatus] ?? statusTone.inactive)}>
                            {merchant.ruleStatus}
                          </Badge>
                          <div className="text-xs text-muted-foreground">
                            {merchant.startPeriod && merchant.endPeriod
                              ? `${merchant.startPeriod} - ${merchant.endPeriod}`
                              : "No active rule"}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>{formatNumber(merchant.pointRedeem)}</TableCell>
                      <TableCell>{formatNumber(merchant.redeem)}</TableCell>
                      <TableCell>{formatNumber(merchant.uniqueRedeemer)}</TableCell>
                    </TableRow>
                  );
                }))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col gap-3 border-t px-6 py-4 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-3">
              <span>
                {totalRows === 0 ? 0 : startIndex + 1} - {Math.min(startIndex + rowsPerPage, totalRows)} of {totalRows}
              </span>
              <div className="flex items-center gap-2">
                <span>Rows per page</span>
                <select
                  className="h-8 rounded-md border border-border bg-background px-2 text-sm text-foreground"
                  value={rowsPerPage}
                  onChange={(event) => {
                    setRowsPerPage(Number(event.target.value));
                    setCurrentPage(1);
                  }}
                >
                  {[10, 20, 50].map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex items-center gap-2 self-end sm:self-auto">
              <span>
                Page {safePage} of {totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage(1)}
              >
                <IconChevronsLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                disabled={safePage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                <IconChevronLeft className="size-4" />
              </Button>
              <input
                className="h-8 w-11 rounded-md border border-border bg-background text-center text-sm text-foreground"
                inputMode="numeric"
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value.replace(/[^\d]/g, ""))}
                onBlur={commitPageInput}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    commitPageInput();
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                <IconChevronRight className="size-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className="rounded-full"
                disabled={safePage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
              >
                <IconChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
