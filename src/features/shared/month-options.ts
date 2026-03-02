import { formatMonthValue, getMonthLabel } from "@/lib/dashboard-metrics";

export type MonthOption = {
  value: string;
  label: string;
};

export const buildFallbackMonthOptions = (count = 6): MonthOption[] => {
  const options: MonthOption[] = [];
  const now = new Date();

  for (let i = 0; i < count; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = formatMonthValue(date);
    options.push({
      value,
      label: getMonthLabel(value),
    });
  }

  return options;
};
