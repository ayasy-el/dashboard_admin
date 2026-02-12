import type { OverviewRepository } from "@/features/overview/overview.repository";
import {
  addMonthsUtc,
  formatMonthUtc,
  monthLabel,
  monthToDateUtc,
  parseMonth,
} from "@/features/shared/month";

const MONTHLY_WINDOW = 12;

export async function getOverviewDashboard(
  repo: OverviewRepository,
  monthQuery: string | null
) {
  const month = parseMonth(monthQuery);
  const start = monthToDateUtc(month);
  const end = addMonthsUtc(start, 1);
  const previousStart = addMonthsUtc(start, -1);
  const previousEnd = start;
  const previousMonth = formatMonthUtc(previousStart);

  const raw = await repo.getOverviewRawData({
    start,
    end,
    previousStart,
    previousEnd,
  });

  const rangeStart = addMonthsUtc(start, -(MONTHLY_WINDOW - 1));
  const monthlyMap = new Map(raw.monthlyTransactionsRaw.map((row) => [row.month, row.value]));
  const monthlyTransactions = Array.from({ length: MONTHLY_WINDOW }, (_, index) => {
    const date = addMonthsUtc(rangeStart, index);
    const monthKey = formatMonthUtc(date);
    return {
      month: monthKey,
      value: monthlyMap.get(monthKey) ?? 0,
    };
  });

  const totalCategory = raw.categoryRaw.reduce((total, row) => total + row.value, 0);
  const categoryBreakdown = raw.categoryRaw.map((row) => ({
    name: row.name,
    value: row.value,
    percent: totalCategory ? (row.value / totalCategory) * 100 : 0,
  }));

  const produktifMap = new Map<string, number>();
  for (const row of raw.produktifRows) {
    produktifMap.set(`${row.branch}||${row.cluster}`, row.merchant_productif);
  }

  const branchMap = new Map<string, any>();
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

    const produktif = produktifMap.get(`${row.branch}||${row.cluster}`) ?? 0;
    branchMap.get(row.branch).children.push({
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
    const sum = (key: string) =>
      children.reduce((total: number, item: any) => total + Number(item[key] ?? 0), 0);

    return {
      id: branch.id,
      name: branch.name,
      totalMerchant: sum("totalMerchant"),
      uniqueMerchant: sum("uniqueMerchant"),
      totalPoint: sum("totalPoint"),
      totalTransaksi: sum("totalTransaksi"),
      uniqueRedeemer: sum("uniqueRedeemer"),
      merchantAktif: sum("merchantAktif"),
      merchantProduktif: sum("merchantProduktif"),
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

  return {
    month,
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
    categoryBreakdown,
    branchTable: {
      branches,
    },
    categoryTable,
  };
}
