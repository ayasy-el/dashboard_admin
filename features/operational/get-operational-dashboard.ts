import type { OperationalRepository } from "@/features/operational/operational.repository";
import {
  addMonthsUtc,
  formatMonthUtc,
  monthLabel,
  monthToDateUtc,
  parseMonth,
} from "@/features/shared/month";

export async function getOperationalDashboard(
  repo: OperationalRepository,
  monthQuery: string | null,
  filters: {
    categories: string[];
    branches: string[];
  },
) {
  const month = parseMonth(monthQuery);
  const start = monthToDateUtc(month);
  const end = addMonthsUtc(start, 1);
  const previousStart = addMonthsUtc(start, -1);
  const previousEnd = start;
  const previousMonth = formatMonthUtc(previousStart);

  const filterOptions = await repo.getOperationalFilterOptions();
  const appliedCategories = filters.categories.filter((category) =>
    filterOptions.categories.includes(category),
  );
  const appliedBranches = filters.branches.filter((branch) =>
    filterOptions.branches.includes(branch),
  );
  const selectedCategories = appliedCategories.length > 0 ? appliedCategories : filterOptions.categories;
  const selectedBranches = appliedBranches.length > 0 ? appliedBranches : filterOptions.branches;

  const raw = await repo.getOperationalRawData({
    start,
    end,
    previousStart,
    previousEnd,
    categories: appliedCategories,
    branches: appliedBranches,
  });

  const branchMap = new Map<
    string,
    {
      name: string;
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
    }
  >();

  for (const row of raw.branchClusterMetrics) {
    if (!branchMap.has(row.branch)) {
      branchMap.set(row.branch, { name: row.branch, children: [] });
    }
    branchMap.get(row.branch)?.children.push({
      name: row.cluster,
      totalMerchant: row.totalMerchant,
      uniqueMerchant: row.uniqueMerchant,
      totalPoint: row.totalPoint,
      totalTransaksi: row.totalTransaksi,
      uniqueRedeemer: row.uniqueRedeemer,
      merchantAktif: row.merchantAktif,
      merchantProduktif: row.merchantProduktif,
    });
  }

  const clusterMetrics = Array.from(branchMap.values()).map((branch) => {
    const sum = (
      selector: (row: {
        name: string;
        totalMerchant: number;
        uniqueMerchant: number;
        totalPoint: number;
        totalTransaksi: number;
        uniqueRedeemer: number;
        merchantAktif: number;
        merchantProduktif: number;
      }) => number,
    ) => branch.children.reduce((total, row) => total + selector(row), 0);

    return {
      name: branch.name,
      totalMerchant: sum((row) => row.totalMerchant),
      uniqueMerchant: sum((row) => row.uniqueMerchant),
      totalPoint: sum((row) => row.totalPoint),
      totalTransaksi: sum((row) => row.totalTransaksi),
      uniqueRedeemer: sum((row) => row.uniqueRedeemer),
      merchantAktif: sum((row) => row.merchantAktif),
      merchantProduktif: sum((row) => row.merchantProduktif),
      children: branch.children,
    };
  });

  const activeMerchants = raw.merchantStatusRows
    .filter((row) => row.transactionCount >= 1)
    .map((row) => ({
      branch: row.branch,
      merchant: row.merchant,
      keyword: row.keyword,
      transactionCount: row.transactionCount,
      uniqRedeemer: row.uniqRedeemer,
    }));

  const productiveMerchants = raw.merchantStatusRows
    .filter((row) => row.transactionCount >= 5)
    .map((row) => ({
      branch: row.branch,
      merchant: row.merchant,
      keyword: row.keyword,
      transactionCount: row.transactionCount,
      uniqRedeemer: row.uniqRedeemer,
    }));

  const notActiveMerchants = raw.merchantStatusRows
    .filter((row) => row.transactionCount === 0)
    .map((row) => ({
      branch: row.branch,
      merchant: row.merchant,
      keyword: row.keyword,
      transactionCount: row.transactionCount,
    }));

  return {
    month,
    filters: {
      categories: selectedCategories,
      branches: selectedBranches,
    },
    filterOptions,
    monthLabel: monthLabel(month),
    previousMonth,
    previousMonthLabel: monthLabel(previousMonth),
    compactStats: raw.compactStats,
    cards: {
      success: {
        current: raw.successCurrent,
        previous: raw.successPrevious,
        series: raw.dailySuccess,
      },
      failed: {
        current: raw.failedCurrent,
        previous: raw.failedPrevious,
        series: raw.dailyFailed,
      },
    },
    activeMerchants,
    productiveMerchants,
    notActiveMerchants,
    expiredRules: raw.expiredRules,
    categoryMetrics: raw.categoryMetrics,
    clusterMetrics,
  };
}
