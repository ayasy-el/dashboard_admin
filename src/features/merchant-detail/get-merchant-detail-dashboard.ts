import {
  addMonthsUtc,
  formatMonthUtc,
  monthLabel,
  monthToDateUtc,
  parseMonth,
} from "@/features/shared/month";
import type { MerchantDetailRepository } from "@/features/merchant-detail/merchant-detail.repository";

const pad = (value: number) => String(value).padStart(2, "0");

const buildYearMonths = (year: number) =>
  Array.from({ length: 12 }, (_, index) => `${year}-${pad(index + 1)}`);

const buildMonthDays = (month: string) => {
  const [year, monthIndex] = month.split("-").map(Number);
  const dayCount = new Date(year, monthIndex, 0).getDate();
  return Array.from({ length: dayCount }, (_, index) => `${month}-${pad(index + 1)}`);
};

export async function getMerchantDetailDashboard(
  repo: MerchantDetailRepository,
  keyword: string,
  monthQuery: string | null,
) {
  const month = parseMonth(monthQuery);
  const start = monthToDateUtc(month);
  const end = addMonthsUtc(start, 1);
  const previousStart = addMonthsUtc(start, -1);
  const previousEnd = start;
  const previousMonth = formatMonthUtc(previousStart);

  const raw = await repo.getMerchantDetailRawData(keyword, {
    start,
    end,
    previousStart,
    previousEnd,
  });

  if (!raw.identity) {
    return null;
  }

  const monthMap = new Map(raw.monthlyPerformance.map((row) => [row.month, row]));
  const dailyMap = new Map(raw.dailyTrend.map((row) => [row.date, row]));
  const yearMonths = buildYearMonths(start.getUTCFullYear());
  const monthDays = buildMonthDays(month);

  return {
    month,
    monthLabel: monthLabel(month),
    previousMonthLabel: monthLabel(previousMonth),
    identity: raw.identity,
    cards: {
      totalTransactions: {
        current: raw.currentSummary.totalTransactions,
        previous: raw.previousSummary.totalTransactions,
      },
      uniqueRedeemer: {
        current: raw.currentSummary.uniqueRedeemer,
        previous: raw.previousSummary.uniqueRedeemer,
      },
      totalPoint: {
        current: raw.currentSummary.totalPoint,
        previous: raw.previousSummary.totalPoint,
      },
    },
    monthlyPerformance: yearMonths.map((value) => ({
      month: value,
      redeem: monthMap.get(value)?.redeem ?? 0,
      uniqueRedeem: monthMap.get(value)?.uniqueRedeem ?? 0,
    })),
    keywordComposition: raw.keywordComposition.map((row) => ({
      name: row.keyword,
      value: row.redeem,
    })),
    dailyTrend: monthDays
      .map((value) => {
        const row = dailyMap.get(value);
        return {
          date: value,
          redeem: row?.redeem ?? 0,
          uniqueRedeemer: row?.uniqueRedeemer ?? 0,
          totalPoint: row?.totalPoint ?? 0,
        };
      })
      .filter((row) => row.redeem > 0 || row.uniqueRedeemer > 0 || row.totalPoint > 0),
    ruleStatuses: raw.ruleStatuses,
    transactions: raw.transactions,
  };
}
