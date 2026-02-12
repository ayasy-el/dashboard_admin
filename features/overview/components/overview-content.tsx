import { MonthSelect } from "@/features/shared/components/month-select";
import { SectionCards, type StatCard } from "@/features/shared/components/section-cards";
import type { MonthOption } from "@/features/shared/get-month-options";
import { OverviewExtraPanels } from "@/features/overview/components/overview-extra-panels";
import { OverviewTransactions } from "@/features/overview/components/overview-transactions";

export type OverviewResponse = {
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

type OverviewContentProps = {
  data: OverviewResponse;
  monthOptions: MonthOption[];
  selectedMonth: string;
};

export function OverviewContent({ data, monthOptions, selectedMonth }: OverviewContentProps) {
  const stats: StatCard[] = [
    {
      id: "customer-points",
      label: "Poin Pelanggan",
      unit: "poin",
      currentTotal: data.cards.totalPoinPelanggan,
      previousTotal: data.cards.previous.totalPoinPelanggan,
      // series: ,
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

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 lg:px-6">
        <div className="text-sm font-medium text-muted-foreground">Ringkasan bulan</div>
        <MonthSelect value={selectedMonth} options={monthOptions} />
      </div>
      <SectionCards
        monthLabel={data.monthLabel}
        previousMonthLabel={data.previousMonthLabel}
        stats={stats}
        className="[&_[data-slot=card]]:border-border/80 [&_[data-slot=card]]:shadow-sm [&_[data-slot=card]]:transition [&_[data-slot=card]]:hover:shadow-md"
      />
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
    </div>
  );
}
