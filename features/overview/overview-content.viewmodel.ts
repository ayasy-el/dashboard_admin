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
  const branchTotals = new Map(branches.map((branch) => [branch.name, branch]));

  const merchantKeyByBranch = new Map<string, Set<string>>();
  const activeMerchantKeyByBranch = new Map<string, Set<string>>();
  for (const merchant of data.merchantPerMonth) {
    const merchantKey = `${merchant.branch}||${merchant.keyword}`;
    if (!merchantKeyByBranch.has(merchant.branch)) {
      merchantKeyByBranch.set(merchant.branch, new Set<string>());
    }
    merchantKeyByBranch.get(merchant.branch)?.add(merchantKey);

    if (merchant.redeem > 0) {
      if (!activeMerchantKeyByBranch.has(merchant.branch)) {
        activeMerchantKeyByBranch.set(merchant.branch, new Set<string>());
      }
      activeMerchantKeyByBranch.get(merchant.branch)?.add(merchantKey);
    }
  }

  const keywordByBranch = Object.fromEntries(
    Array.from(merchantKeyByBranch.entries()).map(([branch, merchants]) => [branch, merchants.size]),
  ) as Record<string, number>;

  const oaByBranch = Object.fromEntries(
    Array.from(activeMerchantKeyByBranch.entries()).map(([branch, merchants]) => [branch, merchants.size]),
  ) as Record<string, number>;

  const branchNames = Array.from(
    new Set<string>([...Object.keys(keywordByBranch), ...Array.from(branchTotals.keys())]),
  );

  const branchesByStatusRedeem = branchNames
    .map((branchName) => ({
      name: branchName,
      keyword: keywordByBranch[branchName] ?? 0,
      totalTransaksi: branchTotals.get(branchName)?.totalTransaksi ?? 0,
      uniqueRedeemer: branchTotals.get(branchName)?.uniqueRedeemer ?? 0,
    }))
    .sort((a, b) => b.totalTransaksi - a.totalTransaksi);

  const totalRegionMerchant = Object.values(keywordByBranch).reduce((sum, value) => sum + value, 0);
  const totalRegionTransaksi = branches.reduce((sum, branch) => sum + branch.totalTransaksi, 0);
  const totalRegionUniqueRedeemer = branches.reduce((sum, branch) => sum + branch.uniqueRedeemer, 0);
  const maxTransaksi = Math.max(totalRegionTransaksi, ...branchesByStatusRedeem.map((item) => item.totalTransaksi), 1);
  const maxUniqueRedeemer = Math.max(totalRegionUniqueRedeemer, ...branchesByStatusRedeem.map((item) => item.uniqueRedeemer), 1);

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
    ...branchesByStatusRedeem.map((branch) => ({
      id: branch.name,
      label: branch.name,
      metric: formatNumber(branch.keyword),
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

  const activeRows: RankedRow[] = branchNames
    .map((branchName) => [branchName, oaByBranch[branchName] ?? 0] as const)
    .sort(([, leftCount], [, rightCount]) => rightCount - leftCount)
    .map(([branchName, oa]) => [
      branchName,
      formatNumber(oa),
      formatNumber(branchTotals.get(branchName)?.totalTransaksi ?? 0),
      formatNumber(branchTotals.get(branchName)?.uniqueRedeemer ?? 0),
    ]);

  const productiveRows: RankedRow[] = [...branches]
    .sort((a, b) => b.merchantProduktif - a.merchantProduktif)
    .map((branch) => [
      branch.name,
      formatNumber(branch.merchantProduktif),
      formatNumber(branch.totalTransaksi),
      formatNumber(branch.uniqueRedeemer),
    ]);

  const inactiveCountByBranch = data.notActiveMerchants.reduce<Record<string, number>>(
    (accumulator, merchant) => {
      accumulator[merchant.branch] = (accumulator[merchant.branch] ?? 0) + 1;
      return accumulator;
    },
    {},
  );

  const expiredCountByBranch = data.expiredMerchants.reduce<Record<string, number>>(
    (accumulator, merchant) => {
      accumulator[merchant.branch] = (accumulator[merchant.branch] ?? 0) + 1;
      return accumulator;
    },
    {},
  );

  const alertBranches = Array.from(
    new Set([...Object.keys(inactiveCountByBranch), ...Object.keys(expiredCountByBranch)]),
  );

  const inactiveRows: RankedRow[] = alertBranches
    .map((branch) => ({
      branch,
      notActive: inactiveCountByBranch[branch] ?? 0,
      expired: expiredCountByBranch[branch] ?? 0,
    }))
    .sort((left, right) => right.notActive + right.expired - (left.notActive + left.expired))
    .map((row) => [row.branch, formatNumber(row.notActive), formatNumber(row.expired)]);

  const inactiveDetailRows: RankedRow[] = data.notActiveMerchants.map((merchant) => [
    merchant.branch,
    merchant.merchant,
    merchant.keyword,
  ]);

  const expiredRows: RankedRow[] = data.expiredMerchants.map((merchant) => [
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
    inactiveDetailRows,
    expiredRows,
    totalExpiredMerchants: data.expiredMerchants.length,
    merchantPerMonthRows,
  };
}
