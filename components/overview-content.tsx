"use client";

import * as React from "react";

// import { ChartAreaInteractive } from "@/components/chart-area-interactive";
import { OverviewExtraPanels } from "@/components/overview-extra-panels";
import { OverviewTransactions } from "@/components/overview-transactions";
import { SectionCards, type StatCard } from "@/components/section-cards";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatMonthValue, getMonthLabel } from "@/lib/dashboard-metrics";

type MonthOption = {
  value: string;
  label: string;
};

type OverviewResponse = {
  month: string;
  monthLabel: string;
  previousMonth: string;
  previousMonthLabel: string;
  cards: {
    totalPoinPelanggan: number;
    totalTransaksi: number;
    totalPoin: number;
    totalRedeemer: number;
    previous: {
      totalPoinPelanggan: number;
      totalTransaksi: number;
      totalPoin: number;
      totalRedeemer: number;
    };
  };
  dailyPoints: { date: string; value: number }[];
  dailyTransactions: { date: string; value: number }[];
  dailyRedeemer: { date: string; value: number }[];
  monthlyTransactions: { month: string; value: number }[];
  categoryBreakdown: { name: string; value: number; percent: number }[];
  branchTable: {
    branches: {
      id: number;
      name: string;
      totalMerchant: number;
      uniqueMerchant: number;
      totalPoint: number;
      totalTransaksi: number;
      uniqueRedeemer: number;
      merchantAktif: number;
      merchantProduktif: number;
      children: {
        id: number;
        name: string;
        totalMerchant: number;
        uniqueMerchant: number;
        totalPoint: number;
        totalTransaksi: number;
        uniqueRedeemer: number;
        merchantAktif: number;
        merchantProduktif: number;
      }[];
    }[];
  };
  categoryTable: {
    id: number;
    name: string;
    totalMerchant: number;
    uniqueMerchant: number;
    totalPoint: number;
    totalTransaksi: number;
    uniqueRedeemer: number;
    merchantAktif: number;
    merchantProduktif: number;
  }[];
};

const fallbackMonthOptions = () => {
  const options: MonthOption[] = [];
  const now = new Date();

  for (let i = 0; i < 6; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = formatMonthValue(date);
    options.push({
      value,
      label: getMonthLabel(value),
    });
  }

  return options;
};

export function OverviewContent() {
  const [monthOptions, setMonthOptions] = React.useState<MonthOption[]>(() =>
    fallbackMonthOptions(),
  );
  const [selectedMonth, setSelectedMonth] = React.useState(
    monthOptions[0]?.value ?? formatMonthValue(new Date()),
  );
  const [data, setData] = React.useState<OverviewResponse | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let active = true;

    const loadMonths = async () => {
      try {
        const response = await fetch("/api/overview/months");
        if (!response.ok) {
          throw new Error("Failed to load month options");
        }
        const payload = (await response.json()) as { months: MonthOption[] };
        if (active && payload.months.length) {
          setMonthOptions(payload.months);
          setSelectedMonth(payload.months[0].value);
        }
      } catch (error) {
        if (active) {
          console.error(error);
        }
      }
    };

    loadMonths();

    return () => {
      active = false;
    };
  }, []);

  React.useEffect(() => {
    let active = true;
    const controller = new AbortController();

    const load = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/overview?month=${selectedMonth}`, {
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Failed to load overview data");
        }
        const payload = (await response.json()) as OverviewResponse;
        if (active) {
          setData(payload);
        }
      } catch (error) {
        if (active) {
          console.error(error);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (selectedMonth) {
      load();
    }

    return () => {
      active = false;
      controller.abort();
    };
  }, [selectedMonth]);

  const stats: StatCard[] = React.useMemo(() => {
    if (!data) return [];
    return [
      {
        id: "customer-points",
        label: "Total Poin Pelanggan",
        unit: "poin",
        currentTotal: data.cards.totalPoinPelanggan,
        previousTotal: data.cards.previous.totalPoinPelanggan,
        series: data.dailyPoints,
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
        id: "total-points",
        label: "Total Poin",
        unit: "poin",
        currentTotal: data.cards.totalPoin,
        previousTotal: data.cards.previous.totalPoin,
        series: data.dailyPoints,
      },
      {
        id: "redeemers",
        label: "Total Redeemer",
        unit: "redeemer",
        currentTotal: data.cards.totalRedeemer,
        previousTotal: data.cards.previous.totalRedeemer,
        series: data.dailyRedeemer,
      },
    ];
  }, [data]);

  return (
    <div className="space-y-6 pb-8">
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
      {data ? (
        <>
          <SectionCards
            monthLabel={data.monthLabel}
            previousMonthLabel={data.previousMonthLabel}
            stats={stats}
            className="[&_[data-slot=card]]:border-border/80 [&_[data-slot=card]]:shadow-sm [&_[data-slot=card]]:transition [&_[data-slot=card]]:hover:shadow-md"
          />
          {/* <div className="px-4 lg:px-6">
            <ChartAreaInteractive
              monthLabel={data.monthLabel}
              total={data.cards.totalPoin}
              series={data.dailyPoints}
            />
          </div> */}
          <OverviewTransactions
            monthLabel={data.monthLabel}
            previousMonthLabel={data.previousMonthLabel}
            dailySeries={data.dailyTransactions}
            monthlySeries={data.monthlyTransactions}
            totalDaily={data.cards.totalTransaksi}
            totalMonthly={data.monthlyTransactions.at(-1)?.value ?? 0}
          />
          <OverviewExtraPanels
            monthLabel={data.monthLabel}
            previousMonthLabel={data.previousMonthLabel}
            trendSeries={data.dailyTransactions}
            trendTotal={data.cards.totalTransaksi}
          />
        </>
      ) : (
        <div className="px-4 text-sm text-muted-foreground lg:px-6">
          {loading ? "Memuat data..." : "Tidak ada data"}
        </div>
      )}
    </div>
  );
}
