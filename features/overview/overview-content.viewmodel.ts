import type { ComparisonProgressRow } from "@/features/shared/components/comparison-progress-table-card";
import type { DistributionItem } from "@/features/shared/components/distribution-pie-card";
import type { StatCard } from "@/features/shared/components/section-cards";
import { formatNumber } from "@/lib/dashboard-metrics";

import type { OverviewResponse } from "@/features/overview/overview.types";

type RankedRow = string[];

const clampProgressWidth = (value: number, max: number) => {
  if (max <= 0) return "8%";
  return `${Math.max(8, Math.round((value / max) * 100))}%`;
};

export function buildOverviewContentViewModel(data: OverviewResponse) {
  const stats: StatCard[] = [
    {
      id: "customer-points",
      label: "Poin Pelanggan",
      unit: "poin",
      currentTotal: data.cards.totalPoinPelanggan,
      previousTotal: data.cards.previous.totalPoinPelanggan,
    },
    {
      id: "transactions",
      label: "Total Transaksi",
      unit: "transaksi",
      currentTotal: data.cards.totalTransaksi,
      previousTotal: data.cards.previous.totalTransaksi,
      series: data.dailyTransactions,
    },
    {
      id: "burning-points",
      label: "Burning Poin",
      unit: "poin",
      currentTotal: data.cards.totalPoin,
      previousTotal: data.cards.previous.totalPoin,
      series: data.dailyPoints,
    },
    {
      id: "redeemers",
      label: "Unique Redeemer",
      unit: "redeemer",
      currentTotal: data.cards.totalRedeemer,
      previousTotal: data.cards.previous.totalRedeemer,
      series: data.dailyRedeemer,
    },
  ];

  const categoryData: DistributionItem[] = data.categoryBreakdown.map((item) => ({
    name: item.name,
    value: item.value,
  }));

  const branches = data.branchTable.branches;
  const branchesByPoint = [...branches].sort((a, b) => b.totalPoint - a.totalPoint);
  const totalRegionMerchant = branches.reduce((sum, branch) => sum + branch.totalMerchant, 0);
  const totalRegionTransaksi = branches.reduce((sum, branch) => sum + branch.totalTransaksi, 0);
  const totalRegionUniqueRedeemer = branches.reduce((sum, branch) => sum + branch.uniqueRedeemer, 0);
  const maxTransaksi = Math.max(totalRegionTransaksi, ...branchesByPoint.map((item) => item.totalTransaksi), 1);
  const maxUniqueRedeemer = Math.max(
    totalRegionUniqueRedeemer,
    ...branchesByPoint.map((item) => item.uniqueRedeemer),
    1,
  );

  const regionRows: ComparisonProgressRow[] = [
    {
      id: "region-total-jatim",
      label: "Jawa Timur",
      highlightLabel: true,
      metric: formatNumber(totalRegionMerchant),
      left: {
        value: formatNumber(totalRegionTransaksi),
        width: clampProgressWidth(totalRegionTransaksi, maxTransaksi),
      },
      right: {
        value: formatNumber(totalRegionUniqueRedeemer),
        width: clampProgressWidth(totalRegionUniqueRedeemer, maxUniqueRedeemer),
      },
    },
    ...branchesByPoint.map((branch) => ({
      id: String(branch.id),
      label: branch.name,
      metric: formatNumber(branch.totalMerchant),
      left: {
        value: formatNumber(branch.totalTransaksi),
        width: clampProgressWidth(branch.totalTransaksi, maxTransaksi),
      },
      right: {
        value: formatNumber(branch.uniqueRedeemer),
        width: clampProgressWidth(branch.uniqueRedeemer, maxUniqueRedeemer),
      },
    })),
  ];

  const activeRows: RankedRow[] = [...branches]
    .sort((a, b) => b.merchantAktif - a.merchantAktif)
    .map((branch) => [
      branch.name,
      formatNumber(branch.merchantAktif),
      formatNumber(branch.totalTransaksi),
      formatNumber(branch.uniqueRedeemer),
    ]);

  const productiveRows: RankedRow[] = [...branches]
    .sort((a, b) => b.merchantProduktif - a.merchantProduktif)
    .map((branch) => [
      branch.name,
      formatNumber(branch.merchantProduktif),
      formatNumber(branch.totalTransaksi),
      formatNumber(branch.uniqueRedeemer),
    ]);

  const inactiveRows: RankedRow[] = data.notActiveMerchants.map((merchant) => [
    merchant.branch,
    merchant.merchant,
    merchant.keyword,
  ]);

  const merchantPerMonthRows: string[][] = [...data.merchantPerMonth]
    .sort((a, b) => b.redeem - a.redeem)
    .map((row, index) => [
      String(index + 1),
      row.category,
      row.branch,
      row.merchant,
      row.keyword,
      row.startPeriod,
      row.endPeriod,
      formatNumber(row.point),
      formatNumber(row.redeem),
      formatNumber(row.uniqueRedeem),
    ]);

  return {
    stats,
    categoryData,
    regionRows,
    activeRows,
    productiveRows,
    inactiveRows,
    merchantPerMonthRows,
  };
}
