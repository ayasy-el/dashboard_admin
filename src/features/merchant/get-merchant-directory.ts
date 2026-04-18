import { addMonthsUtc, monthLabel, monthToDateUtc, parseMonth } from "@/features/shared/month";
import type { MerchantDirectoryRepository } from "@/features/merchant/merchant-directory.repository";

export async function getMerchantDirectory(
  repo: MerchantDirectoryRepository,
  monthQuery: string | null,
) {
  const month = parseMonth(monthQuery);
  const start = monthToDateUtc(month);
  const end = addMonthsUtc(start, 1);

  const raw = await repo.getMerchantDirectoryRawData({ start, end });

  return {
    month,
    monthLabel: monthLabel(month),
    summary: raw.summary,
    merchants: raw.merchants,
  };
}
