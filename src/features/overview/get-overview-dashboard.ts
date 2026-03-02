import type { OverviewRepository } from "@/features/overview/overview.repository";
import {
  addMonthsUtc,
  formatMonthUtc,
  monthLabel,
  monthToDateUtc,
  parseMonth,
} from "@/features/shared/month";

const MONTHLY_WINDOW = 12;

type BranchChild = {
  id: number;
  name: string;
  totalMerchant: number;
  uniqueMerchant: number;
  totalPoint: number;
  totalTransaksi: number;
  uniqueRedeemer: number;
  merchantAktif: number;
  merchantProduktif: number;
};

type BranchAggregate = {
  id: number;
  name: string;
  children: BranchChild[];
};

export async function getOverviewDashboard(
  repo: OverviewRepository,
  monthQuery: string | null,
  filters: {
    categories: string[];
    branches: string[];
  }
) {
  const month = parseMonth(monthQuery);
  const start = monthToDateUtc(month);
  const end = addMonthsUtc(start, 1);
  const previousStart = addMonthsUtc(start, -1);
  const previousEnd = start;
  const previousMonth = formatMonthUtc(previousStart);

  const filterOptions = await repo.getOverviewFilterOptions();
  const appliedCategories = filters.categories.filter((category) =>
    filterOptions.categories.includes(category),
  );
  const appliedBranches = filters.branches.filter((branch) =>
    filterOptions.branches.includes(branch),
  );
  const selectedCategories = appliedCategories.length > 0 ? appliedCategories : filterOptions.categories;
  const selectedBranches = appliedBranches.length > 0 ? appliedBranches : filterOptions.branches;

  const raw = await repo.getOverviewRawData({
    start,
    end,
    previousStart,
    previousEnd,
    categories: appliedCategories,
    branches: appliedBranches,
  });

  const rangeStart = addMonthsUtc(start, -(MONTHLY_WINDOW - 1));
  const monthlyMap = new Map(raw.monthlyTransactionsRaw.map((row) => [row.month, row.value]));
  const monthlyRedeemerMap = new Map(raw.monthlyRedeemerRaw.map((row) => [row.month, row.value]));
  const monthlyTransactions = Array.from({ length: MONTHLY_WINDOW }, (_, index) => {
    const date = addMonthsUtc(rangeStart, index);
    const monthKey = formatMonthUtc(date);
    return {
      month: monthKey,
      value: monthlyMap.get(monthKey) ?? 0,
    };
  });
  const monthlyRedeemers = Array.from({ length: MONTHLY_WINDOW }, (_, index) => {
    const date = addMonthsUtc(rangeStart, index);
    const monthKey = formatMonthUtc(date);
    return {
      month: monthKey,
      value: monthlyRedeemerMap.get(monthKey) ?? 0,
    };
  });

  const totalCategory = raw.categoryRaw.reduce((total, row) => total + row.value, 0);
  const categoryBreakdown = raw.categoryRaw.map((row) => ({
    name: row.name,
    value: row.value,
    percent: totalCategory ? (row.value / totalCategory) * 100 : 0,
  }));
  const topMerchants = raw.topMerchantsRaw.map((row) => ({
    merchant: row.merchant,
    category: row.category,
    branch: row.branch,
    redeem: row.redeem,
  }));

  const produktifMap = new Map<string, number>();
  for (const row of raw.produktifRows) {
    produktifMap.set(`${row.branch}||${row.cluster}`, row.merchant_productif);
  }

  const branchMap = new Map<string, BranchAggregate>();
  let branchId = 1;
  let clusterId = 1000;

  for (const row of raw.branchClusterRows) {
    if (!branchMap.has(row.branch)) {
      branchMap.set(row.branch, {
        id: branchId++,
        name: row.branch,
        children: [],
      });
    }

    const branchEntry = branchMap.get(row.branch);
    if (!branchEntry) continue;

    const produktif = produktifMap.get(`${row.branch}||${row.cluster}`) ?? 0;
    branchEntry.children.push({
      id: clusterId++,
      name: row.cluster,
      totalMerchant: row.total_merchant,
      uniqueMerchant: row.unique_merchant,
      totalPoint: row.total_point,
      totalTransaksi: row.total_transaksi,
      uniqueRedeemer: row.unique_redeemer,
      merchantAktif: row.merchant_aktif,
      merchantProduktif: produktif,
    });
  }

  const branches = Array.from(branchMap.values()).map((branch) => {
    const children = branch.children ?? [];
    const sum = (selector: (item: BranchChild) => number) =>
      children.reduce((total, item) => total + selector(item), 0);

    return {
      id: branch.id,
      name: branch.name,
      totalMerchant: sum((item) => item.totalMerchant),
      uniqueMerchant: sum((item) => item.uniqueMerchant),
      totalPoint: sum((item) => item.totalPoint),
      totalTransaksi: sum((item) => item.totalTransaksi),
      uniqueRedeemer: sum((item) => item.uniqueRedeemer),
      merchantAktif: sum((item) => item.merchantAktif),
      merchantProduktif: sum((item) => item.merchantProduktif),
      children,
    };
  });

  const categoryProduktifMap = new Map<string, number>();
  for (const row of raw.categoryProduktifRaw) {
    categoryProduktifMap.set(row.category, row.merchant_productif);
  }

  const categoryTable = raw.categoryTableRaw.map((row, index) => ({
    id: index + 1,
    name: row.name,
    totalMerchant: row.total_merchant,
    uniqueMerchant: row.unique_merchant,
    totalPoint: row.total_point,
    totalTransaksi: row.total_transaksi,
    uniqueRedeemer: row.unique_redeemer,
    merchantAktif: row.merchant_aktif,
    merchantProduktif: categoryProduktifMap.get(row.name) ?? 0,
  }));

  const notActiveMerchants = raw.notActiveMerchantRaw.map((row) => ({
    branch: row.branch,
    merchant: row.merchant,
    keyword: row.keyword,
  }));

  const merchantPerMonth = raw.merchantPerMonthRaw.map((row) => ({
    category: row.category,
    branch: row.branch,
    merchant: row.merchant,
    keyword: row.keyword,
    startPeriod: formatDisplayDate(row.startPeriod),
    endPeriod: formatDisplayDate(row.endPeriod),
    point: row.point,
    redeem: row.redeem,
    uniqueRedeem: row.uniqueRedeem,
  }));

  const expiredMerchants = raw.expiredMerchantRaw.map((row) => ({
    branch: row.branch,
    merchant: row.merchant,
    keyword: row.keyword,
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
    cards: {
      totalPoinPelanggan: raw.clusterPointCurrent,
      totalTransaksi: raw.summary.totalTransaksi,
      totalPoin: raw.summary.totalPoint,
      totalRedeemer: raw.summary.totalRedeemer,
      previous: {
        totalPoinPelanggan: raw.clusterPointPrevious,
        totalTransaksi: raw.previousSummary.totalTransaksi,
        totalPoin: raw.previousSummary.totalPoint,
        totalRedeemer: raw.previousSummary.totalRedeemer,
      },
    },
    dailyPoints: raw.dailyPoints,
    dailyTransactions: raw.dailyTransactions,
    dailyRedeemer: raw.dailyRedeemer,
    monthlyTransactions,
    monthlyRedeemers,
    topMerchants,
    categoryBreakdown,
    branchTable: {
      branches,
    },
    categoryTable,
    notActiveMerchants,
    merchantPerMonth,
    expiredMerchants,
  };
}
const formatDisplayDate = (value: string) => {
  if (!value) return "";
  return new Date(value).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};
