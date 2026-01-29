"use client";

import * as React from "react";

import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { OverviewTransactions } from "@/components/overview-transactions";
import { SectionCards } from "@/components/section-cards";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMonthValue, getMonthLabel } from "@/lib/dashboard-metrics";

const buildMonthOptions = (count: number) => {
  const options = [];
  const now = new Date();

  for (let i = 0; i < count; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    options.push({
      value: formatMonthValue(date),
      label: getMonthLabel(formatMonthValue(date)),
    });
  }

  return options;
};

export function OverviewContent() {
  const monthOptions = React.useMemo(() => buildMonthOptions(6), []);
  const [selectedMonth, setSelectedMonth] = React.useState(
    monthOptions[0]?.value ?? formatMonthValue(new Date()),
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 lg:px-6">
        <div className="text-sm font-medium text-muted-foreground">Ringkasan bulan</div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]" size="sm" aria-label="Pilih bulan">
            <SelectValue placeholder="Pilih bulan" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {monthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value} className="rounded-lg">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <SectionCards month={selectedMonth} />
      {/* <div className="px-4 lg:px-6">
        <ChartAreaInteractive month={selectedMonth} />
      </div> */}
      <OverviewTransactions month={selectedMonth} />
    </>
  );
}
