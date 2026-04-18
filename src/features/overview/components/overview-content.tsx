import Link from "next/link";
import {
  MultiFilterDropdown,
  SingleFilterDropdown,
} from "@/features/shared/components/filter-dropdown";
import { SectionCards } from "@/features/shared/components/section-cards";
import type { MonthOption } from "@/features/shared/get-month-options";
import { OverviewTransactions } from "@/features/overview/components/overview-transactions";
import { ComparisonProgressTableCard } from "@/features/shared/components/comparison-progress-table-card";
import { DashboardFilterLink } from "@/features/shared/components/dashboard-filter-link";
import { DataTableCard } from "@/features/shared/components/data-table-card";
import { DistributionPieCard } from "@/features/shared/components/distribution-pie-card";
import { RankedMetricsTableCard } from "@/features/shared/components/ranked-metrics-table-card";
import {
  IconCircleCheck,
  IconCircleOff,
  IconTargetArrow,
  IconTrophy,
  IconChartPie,
  IconMessage2Exclamation,
  IconHourglassOff,
} from "@tabler/icons-react";
import { buildOverviewContentViewModel } from "@/features/overview/overview-content.viewmodel";
import type { OverviewResponse } from "@/features/overview/overview.types";

type OverviewContentProps = {
  data: OverviewResponse;
  monthOptions: MonthOption[];
  selectedMonth: string;
};

export function OverviewContent({ data, monthOptions, selectedMonth }: OverviewContentProps) {
  const {
    stats,
    categoryData,
    regionRows,
    activeRows,
    productiveRows,
    inactiveRows,
    inactiveDetailRows,
    expiredRows,
    totalExpiredMerchants,
  } = buildOverviewContentViewModel(data);
  const filterLinkClassName = "font-medium";
  const keywordLinkClassName =
    "font-medium text-black underline-offset-4 hover:underline dark:text-white";
  const branchLink = (branch: string, key: string) => (
    <DashboardFilterLink key={key} month={selectedMonth} branch={branch}>
      {branch}
    </DashboardFilterLink>
  );
  const categoryLink = (category: string, key: string) => (
    <DashboardFilterLink
      key={key}
      month={selectedMonth}
      category={category}
      className={filterLinkClassName}
    >
      {category}
    </DashboardFilterLink>
  );
  const keywordLink = (keyword: string, key: string) => (
    <Link
      key={key}
      href={`/merchant/${encodeURIComponent(keyword)}?month=${encodeURIComponent(selectedMonth)}`}
      className={keywordLinkClassName}
    >
      {keyword}
    </Link>
  );

  const regionRowsWithLinks = regionRows.map((row, index) =>
    index === 0
      ? row
      : {
          ...row,
          label: branchLink(String(row.label), `region-branch-${row.id}`),
        },
  );

  const activeRowsWithLinks = activeRows.map((row, index) => [
    branchLink(String(row[0]), `active-branch-${index}-${row[0]}`),
    ...row.slice(1),
  ]);

  const productiveRowsWithLinks = productiveRows.map((row, index) => [
    branchLink(String(row[0]), `productive-branch-${index}-${row[0]}`),
    ...row.slice(1),
  ]);

  const inactiveRowsWithLinks = inactiveRows.map((row, index) => [
    branchLink(String(row[0]), `inactive-summary-branch-${index}-${row[0]}`),
    ...row.slice(1),
  ]);

  const inactiveDetailRowsWithLinks = data.notActiveMerchants.map((merchant) => [
    branchLink(merchant.branch, `inactive-branch-${merchant.branch}-${merchant.keyword}`),
    merchant.merchant,
    keywordLink(merchant.keyword, `inactive-keyword-${merchant.keyword}`),
  ]);

  const expiredRowsWithLinks = data.expiredMerchants.map((merchant) => [
    branchLink(merchant.branch, `expired-branch-${merchant.branch}-${merchant.keyword}`),
    merchant.merchant,
    keywordLink(merchant.keyword, `expired-keyword-${merchant.keyword}`),
  ]);

  const merchantPerMonthRowsWithLinks = [...data.merchantPerMonth]
    .sort((a, b) => b.redeem - a.redeem)
    .map((row, index) => [
      String(index + 1),
      categoryLink(row.category, `category-${row.keyword}`),
      branchLink(row.branch, `branch-${row.keyword}`),
      row.merchant,
      keywordLink(row.keyword, `keyword-${row.keyword}`),
      row.startPeriod,
      row.endPeriod,
      new Intl.NumberFormat("id-ID").format(row.point),
      new Intl.NumberFormat("id-ID").format(row.redeem),
      new Intl.NumberFormat("id-ID").format(row.uniqueRedeem),
    ]);

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 lg:px-6">
        <div className="text-sm font-medium text-muted-foreground">Ringkasan bulan</div>
        <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
          <SingleFilterDropdown
            title="MONTH"
            paramKey="month"
            selectedValue={selectedMonth}
            options={monthOptions.map((option) => ({
              value: option.value,
              label: option.label,
            }))}
            className="w-[220px]"
          />
          <MultiFilterDropdown
            title="CATEGORY"
            paramKey="category"
            selectedValues={data.filters.categories}
            options={data.filterOptions.categories.map((category) => ({
              value: category,
              label: category,
            }))}
            className="w-[200px]"
          />
          <MultiFilterDropdown
            title="BRANCH"
            options={data.filterOptions.branches.map((branch) => ({
              value: branch,
              label: branch,
            }))}
            paramKey="branch"
            selectedValues={data.filters.branches}
            className="w-[200px]"
          />
        </div>
      </div>
      <SectionCards
        monthLabel={data.monthLabel}
        previousMonthLabel={data.previousMonthLabel}
        stats={stats}
        className="[&_[data-slot=card]]:border-border/80 [&_[data-slot=card]]:shadow-sm [&_[data-slot=card]]:transition [&_[data-slot=card]]:hover:shadow-md"
      />
      <OverviewTransactions
        selectedMonth={selectedMonth}
        monthLabel={data.monthLabel}
        previousMonthLabel={data.previousMonthLabel}
        dailySeries={data.dailyTransactions}
        dailyUniqueSeries={data.dailyRedeemer}
        monthlySeries={data.monthlyTransactions}
        monthlyUniqueSeries={data.monthlyRedeemers}
        totalRedeem={data.cards.totalTransaksi}
        totalUniqueRedeem={data.cards.totalRedeemer}
        topMerchants={data.topMerchants}
      />
      <div className="space-y-6 px-4 lg:px-6">
        <div className="grid gap-6 xl:grid-cols-12">
          <DistributionPieCard
            className="min-w-[20rem] min-w-0 xl:col-span-4"
            title="Merchant Categories"
            icon={<IconChartPie className="size-4 text-secondary" />}
            data={categoryData}
            description="Berdasarkan jumlah transaksi"
            minLabelPercent={10}
          />
          <ComparisonProgressTableCard
            className="min-w-0 xl:col-span-8"
            title="POIN Redeem Region Jatim"
            icon={<IconTargetArrow className="size-4 text-secondary" />}
            headers={["REGION", "KEYWORD", "STATUS REDEEM", "UNIQUE REEDEEM"]}
            rows={regionRowsWithLinks}
            darkHeader
            splitLabel="Branch"
            leftBarClassName="bg-red-400"
            rightBarClassName="bg-yellow-500"
            sortableColumns={[false, false, true, true]}
            pagination={{ enabled: true, pageSize: 6, keepFirstRow: true }}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-2 2xl:grid-cols-3">
          <RankedMetricsTableCard
            className="min-w-0"
            title="Merchant Active"
            tone="green"
            icon={<IconCircleCheck className="size-4 text-green-500" />}
            headerCols={["BRANCH", "OA", "TRX", "UNIQ REDEEMER"]}
            sortableColumns={[false, true, true, true]}
            rows={activeRowsWithLinks}
            pagination={{ enabled: true, pageSize: 6 }}
          />
          <RankedMetricsTableCard
            className="min-w-0"
            title="Merchant Productive"
            tone="yellow"
            icon={<IconTrophy className="size-4 text-yellow-500" />}
            headerCols={["BRANCH", "OP", "TRX", "UNIQ REDEEMER"]}
            rows={productiveRowsWithLinks}
            sortableColumns={[false, true, true, true]}
            pagination={{ enabled: true, pageSize: 6 }}
          />
          <RankedMetricsTableCard
            className="min-w-0 lg:col-span-2 2xl:col-span-1"
            title="Merchant Alert"
            tone="red"
            icon={<IconMessage2Exclamation className="size-4 text-primary" />}
            headerCols={["BRANCH", "NOT ACTIVE", "EXPIRED"]}
            rows={inactiveRowsWithLinks}
            pagination={{ enabled: true, pageSize: 6 }}
            sortableColumns={[false, true, true]}
            paginationInfo={`Not Active: ${inactiveDetailRows.length} • Expired: ${totalExpiredMerchants}`}
          />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <RankedMetricsTableCard
            className="min-w-0"
            title="Merchant Not Active Detail"
            tone="red"
            icon={<IconCircleOff className="size-4 text-primary" />}
            headerCols={["BRANCH", "MERCHANT", "KEYWORD"]}
            rows={inactiveDetailRowsWithLinks}
            pagination={{ enabled: true, pageSize: 6 }}
            paginationInfo={`Total: ${inactiveDetailRows.length}`}
          />
          <RankedMetricsTableCard
            className="min-w-0"
            title="Merchant Expired Detail"
            tone="yellow"
            icon={<IconHourglassOff className="size-4 text-yellow-500" />}
            headerCols={["BRANCH", "MERCHANT", "KEYWORD"]}
            rows={expiredRowsWithLinks}
            pagination={{ enabled: true, pageSize: 6 }}
            paginationInfo={`Total: ${expiredRows.length}`}
          />
        </div>
        <DataTableCard
          className="min-w-0"
          title="Detail List Merchant"
          darkHeader={true}
          headers={[
            "#",
            "MERCHANT CATEGORY",
            "BRANCH",
            "MERCHANT",
            "KEYWORD",
            "START PERIOD",
            "END PERIOD",
            "POIN",
            "REDEEM",
            "UNIQE REDEEM",
          ]}
          rows={merchantPerMonthRowsWithLinks}
          sortableColumns={[false, true, true, true, true, true, true, true, true, true]}
          pagination={{ enabled: true, pageSize: 10 }}
          columnClassNames={[
            "",
            "font-medium",
            "",
            "",
            "font-medium",
            "text-muted-foreground",
            "text-muted-foreground",
            "text-right",
            "text-right font-semibold",
            "text-right font-semibold",
          ]}
        />
      </div>
    </div>
  );
}
