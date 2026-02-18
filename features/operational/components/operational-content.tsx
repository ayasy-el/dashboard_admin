import { MultiFilterDropdown, SingleFilterDropdown } from "@/features/shared/components/filter-dropdown";
import { DataTableCard } from "@/features/shared/components/data-table-card";
import { SectionCards, type StatCard } from "@/features/shared/components/section-cards";
import type { MonthOption } from "@/features/shared/get-month-options";
import { CollapsibleClusterTableCard } from "@/features/operational/components/collapsible-cluster-table-card";

export type OperationalResponse = {
  month: string;
  filters: {
    categories: string[];
    branches: string[];
  };
  filterOptions: {
    categories: string[];
    branches: string[];
  };
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
  }[];
  categoryMetrics: {
    name: string;
    totalMerchant: number;
    uniqueMerchant: number;
    totalPoint: number;
    totalTransaksi: number;
    uniqueRedeemer: number;
    merchantAktif: number;
    merchantProduktif: number;
  }[];
  clusterMetrics: {
    name: string;
    totalMerchant: number;
    uniqueMerchant: number;
    totalPoint: number;
    totalTransaksi: number;
    uniqueRedeemer: number;
    merchantAktif: number;
    merchantProduktif: number;
    children: {
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

type OperationalContentProps = {
  data: OperationalResponse;
  monthOptions: MonthOption[];
  selectedMonth: string;
};

export function OperationalContent({ data, monthOptions, selectedMonth }: OperationalContentProps) {
  const stats: StatCard[] = [
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
  const topMerchantRows = data.topMerchants.map((row) => [
    row.merchant,
    row.uniqMerchant,
    row.keyword,
    row.totalTransactions.toLocaleString("id-ID"),
    row.uniqRedeemer.toLocaleString("id-ID"),
  ]);
  const expiredRuleRows = data.expiredRules.map((row) => [
    row.merchant,
    row.keyword,
    row.startPeriod,
    row.endPeriod,
  ]);
  const categoryMetricRows = data.categoryMetrics.map((row) => [
    row.name,
    row.totalMerchant.toLocaleString("id-ID"),
    row.uniqueMerchant.toLocaleString("id-ID"),
    row.totalPoint.toLocaleString("id-ID"),
    row.totalTransaksi.toLocaleString("id-ID"),
    row.uniqueRedeemer.toLocaleString("id-ID"),
    row.merchantAktif.toLocaleString("id-ID"),
    row.merchantProduktif.toLocaleString("id-ID"),
  ]);

  return (
    <div className="flex flex-col gap-6">
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
            paramKey="branch"
            selectedValues={data.filters.branches}
            options={data.filterOptions.branches.map((branch) => ({
              value: branch,
              label: branch,
            }))}
            className="w-[200px]"
          />
        </div>
      </div>
      <SectionCards
        monthLabel={data.monthLabel}
        previousMonthLabel={data.previousMonthLabel}
        stats={stats}
        className="mx-auto w-full max-w-4xl px-0 sm:grid-cols-2 @xl/main:grid-cols-2 @5xl/main:grid-cols-2"
      />

      <div className="grid gap-6 px-4 lg:px-6">
        <DataTableCard
          className="min-w-0"
          title="Top Merchant"
          headers={[
            "Nama Merchant",
            "Uniq Merchant",
            "Keyword",
            "Jumlah Transaksi",
            "Uniq Redeemer",
          ]}
          rows={topMerchantRows}
          sortableColumns={[true, true, true, true, true]}
          pagination={{ enabled: true, pageSize: 5, pageSizeOptions: [5, 10, 20] }}
          columnClassNames={[
            "font-medium",
            "",
            "",
            "text-right tabular-nums",
            "text-right tabular-nums",
          ]}
        />

        <DataTableCard
          className="min-w-0"
          title="Rule Expired Bulan Ini"
          headers={["Nama Merchant", "Keyword", "Mulai", "Berakhir"]}
          rows={expiredRuleRows}
          sortableColumns={[true, true, true, true]}
          pagination={{ enabled: true, pageSize: 8, pageSizeOptions: [8, 16, 24] }}
          columnClassNames={["font-medium", "", "tabular-nums", "tabular-nums"]}
        />

        <DataTableCard
          className="min-w-0"
          title="Category Metrics"
          headers={[
            "Category",
            "Jumlah Merchant",
            "Unique Merchant",
            "Burning Point",
            "Total Transaksi",
            "Unique Redeemer",
            "Merchant Aktif",
            "Merchant Produktif",
          ]}
          rows={categoryMetricRows}
          sortableColumns={[true, true, true, true, true, true, true, true]}
          pagination={{ enabled: true, pageSize: 8, pageSizeOptions: [8, 16, 24] }}
          columnClassNames={[
            "font-medium",
            "text-right tabular-nums",
            "text-right tabular-nums",
            "text-right tabular-nums",
            "text-right tabular-nums",
            "text-right tabular-nums",
            "text-right tabular-nums",
            "text-right tabular-nums",
          ]}
        />

        <CollapsibleClusterTableCard
          className="min-w-0"
          darkHeader={true}
          title="Cluster Metrics"
          rows={data.clusterMetrics}
        />
      </div>
    </div>
  );
}
