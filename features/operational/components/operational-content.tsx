"use client";

import * as React from "react";
import {
  MultiFilterDropdown,
  SingleFilterDropdown,
} from "@/features/shared/components/filter-dropdown";
import { DataTableCard } from "@/features/shared/components/data-table-card";
import { SectionCards, type StatCard } from "@/features/shared/components/section-cards";
import type { MonthOption } from "@/features/shared/get-month-options";
import { CollapsibleClusterTableCard } from "@/features/operational/components/collapsible-cluster-table-card";
import { Card, CardContent } from "@/components/ui/card";
import { formatNumber } from "@/lib/dashboard-metrics";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
  compactStats: {
    totalMerchant: number;
    merchantAktif: number;
    merchantProduktif: number;
    merchantNotActive: number;
    merchantExpired: number;
  };
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
  activeMerchants: {
    branch: string;
    merchant: string;
    keyword: string;
    transactionCount: number;
    uniqRedeemer: number;
  }[];
  productiveMerchants: {
    branch: string;
    merchant: string;
    keyword: string;
    transactionCount: number;
    uniqRedeemer: number;
  }[];
  notActiveMerchants: {
    branch: string;
    merchant: string;
    keyword: string;
    transactionCount: number;
  }[];
  expiredRules: {
    branch: string;
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

type MerchantStatusTab = "active" | "productive" | "not-active" | "expired";
const formatShare = (value: number, total: number) => {
  if (total <= 0) return `${value.toLocaleString("id-ID")} (0%)`;
  const percent = (value / total) * 100;
  return `${value.toLocaleString("id-ID")} (${percent.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%)`;
};

export function OperationalContent({ data, monthOptions, selectedMonth }: OperationalContentProps) {
  const [merchantStatusTab, setMerchantStatusTab] = React.useState<MerchantStatusTab>("active");
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
  const activeMerchantRows = data.activeMerchants.map((row) => [
    row.branch,
    row.merchant,
    row.keyword,
    row.transactionCount.toLocaleString("id-ID"),
    row.uniqRedeemer.toLocaleString("id-ID"),
  ]);
  const productiveMerchantRows = data.productiveMerchants.map((row) => [
    row.branch,
    row.merchant,
    row.keyword,
    row.transactionCount.toLocaleString("id-ID"),
    row.uniqRedeemer.toLocaleString("id-ID"),
  ]);
  const notActiveMerchantRows = data.notActiveMerchants.map((row) => [
    row.branch,
    row.merchant,
    row.keyword,
    row.transactionCount.toLocaleString("id-ID"),
  ]);
  const expiredRuleRows = data.expiredRules.map((row) => [
    row.branch,
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
    formatShare(row.merchantAktif, row.totalMerchant),
    formatShare(row.merchantProduktif, row.totalMerchant),
  ]);
  const merchantStatusTable = React.useMemo(() => {
    if (merchantStatusTab === "active") {
      return {
        headers: ["Branch", "Nama Merchant", "Keyword", "Jumlah Transaksi", "Uniq Redeem"],
        rows: activeMerchantRows,
        sortableColumns: [true, true, true, true, true],
        columnClassNames: [
          "",
          "font-medium",
          "",
          "w-[88px] text-right tabular-nums",
          "w-[88px] text-right tabular-nums",
        ],
      };
    }
    if (merchantStatusTab === "productive") {
      return {
        headers: ["Branch", "Nama Merchant", "Keyword", "Jumlah Transaksi", "Uniq Redeem"],
        rows: productiveMerchantRows,
        sortableColumns: [true, true, true, true, true],
        columnClassNames: [
          "",
          "font-medium",
          "",
          "w-[88px] text-right tabular-nums",
          "w-[88px] text-right tabular-nums",
        ],
      };
    }
    if (merchantStatusTab === "not-active") {
      return {
        headers: ["Branch", "Nama Merchant", "Keyword", "Jumlah Transaksi"],
        rows: notActiveMerchantRows,
        sortableColumns: [true, true, true, true],
        columnClassNames: ["", "font-medium", "", "w-[88px] text-right tabular-nums"],
      };
    }
    return {
      headers: ["Branch", "Nama Merchant", "Keyword", "Mulai", "Berakhir"],
      rows: expiredRuleRows,
      sortableColumns: [true, true, true, true, true],
      columnClassNames: ["", "font-medium", "", "tabular-nums", "tabular-nums"],
    };
  }, [
    merchantStatusTab,
    activeMerchantRows,
    productiveMerchantRows,
    notActiveMerchantRows,
    expiredRuleRows,
  ]);
  const merchantStatusTitleMap: Record<MerchantStatusTab, string> = {
    active: "Merchant Active Bulan Ini",
    productive: "Merchant Productive Bulan Ini",
    "not-active": "Merchant Not Active Bulan Ini",
    expired: "Merchant Expired Bulan Ini",
  };
  const compactStatItems = [
    {
      id: "total-merchant",
      label: "Jumlah Merchant",
      value: data.compactStats.totalMerchant,
      helper: "dalam Periode Berjalan Bulan Ini",
    },
    {
      id: "merchant-aktif",
      label: "Merchant Aktif",
      value: data.compactStats.merchantAktif,
      helper: "Minimal 1 transaksi",
    },
    {
      id: "merchant-produktif",
      label: "Merchant Produktif",
      value: data.compactStats.merchantProduktif,
      helper: "Minimal 5 transaksi",
    },
    {
      id: "merchant-not-active",
      label: "Merchant Not Active",
      value: data.compactStats.merchantNotActive,
      helper: "Tanpa transaksi",
    },
    {
      id: "merchant-expired",
      label: "Merchant Expired",
      value: data.compactStats.merchantExpired,
      helper: "Expired di bulan ini",
    },
  ];

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
        className="mx-auto w-full max-w-4xl px-4 lg:px-6 sm:grid-cols-2 @xl/main:grid-cols-2 @5xl/main:grid-cols-2"
      />
      <div className="grid grid-cols-1 gap-3 px-4 sm:grid-cols-2 lg:px-6 xl:grid-cols-5">
        {compactStatItems.map((item) => (
          <Card key={item.id} className="gap-0 border-border/80 py-0 shadow-sm">
            <CardContent className="space-y-1 px-4 py-4">
              <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
                {item.label}
              </div>
              <div className="text-2xl font-semibold tabular-nums">{formatNumber(item.value)}</div>
              <div className="text-xs text-muted-foreground">{item.helper}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 px-4 lg:px-6">
        <DataTableCard
          className="min-w-0"
          title={
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              <span>{merchantStatusTitleMap[merchantStatusTab]}</span>
              <Tabs
                value={merchantStatusTab}
                onValueChange={(next) => setMerchantStatusTab(next as MerchantStatusTab)}
                className="gap-0"
              >
                <TabsList>
                  <TabsTrigger value="active">Active</TabsTrigger>
                  <TabsTrigger value="productive">Productive</TabsTrigger>
                  <TabsTrigger value="not-active">Not Active</TabsTrigger>
                  <TabsTrigger value="expired">Expired</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          }
          headers={merchantStatusTable.headers}
          rows={merchantStatusTable.rows}
          sortableColumns={merchantStatusTable.sortableColumns}
          pagination={{ enabled: true, pageSize: 8, pageSizeOptions: [8, 16, 24] }}
          columnClassNames={merchantStatusTable.columnClassNames}
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
          pagination={{ enabled: true, pageSize: 10, pageSizeOptions: [10, 16, 24] }}
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
