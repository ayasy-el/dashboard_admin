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
  monthQuery: string | null
) {
  const month = parseMonth(monthQuery);
  const start = monthToDateUtc(month);
  const end = addMonthsUtc(start, 1);
  const previousStart = addMonthsUtc(start, -1);
  const previousEnd = start;
  const previousMonth = formatMonthUtc(previousStart);

  const raw = await repo.getOperationalRawData({
    start,
    end,
    previousStart,
    previousEnd,
  });

  return {
    month,
    monthLabel: monthLabel(month),
    previousMonth,
    previousMonthLabel: monthLabel(previousMonth),
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
    topMerchants: raw.topMerchants,
    expiredRules: raw.expiredRules,
  };
}
