import { MonthSelect } from "@/features/shared/components/month-select";
import { SectionCards } from "@/features/shared/components/section-cards";
import type { MonthOption } from "@/features/shared/get-month-options";
import { OverviewTransactions } from "@/features/overview/components/overview-transactions";
import {
  ComparisonProgressTableCard,
} from "@/features/shared/components/comparison-progress-table-card";
import { DataTableCard } from "@/features/shared/components/data-table-card";
import { DistributionPieCard } from "@/features/shared/components/distribution-pie-card";
import { RankedMetricsTableCard } from "@/features/shared/components/ranked-metrics-table-card";
import { IconCircleCheck, IconCircleOff, IconSun, IconTrophy, IconWand } from "@tabler/icons-react";
import { buildOverviewContentViewModel } from "@/features/overview/overview-content.viewmodel";
import type { OverviewResponse } from "@/features/overview/overview.types";

type OverviewContentProps = {
  data: OverviewResponse;
  monthOptions: MonthOption[];
  selectedMonth: string;
};

export function OverviewContent({ data, monthOptions, selectedMonth }: OverviewContentProps) {
  const {
    stats,
    categoryData,
    regionRows,
    activeRows,
    productiveRows,
    inactiveRows,
    merchantPerMonthRows,
  } = buildOverviewContentViewModel(data);

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
      <div className="space-y-6 px-4 lg:px-6">
        <div className="grid gap-6 xl:grid-cols-12">
          <DistributionPieCard
            className="xl:col-span-4"
            title="Merchant Categories"
            icon={<IconWand className="size-4 text-secondary" />}
            data={categoryData}
            minLabelPercent={10}
          />
          <ComparisonProgressTableCard
            className="xl:col-span-8"
            title="POIN Redeem Region Jatim"
            icon={<IconSun className="size-4 text-secondary" />}
            headers={["REGION", "KEYWORD", "STATUS REDEEM", "UNIQUE REEDEEM"]}
            rows={regionRows}
            darkHeader
            splitLabel="Branch"
            leftBarClassName="bg-red-400"
            rightBarClassName="bg-yellow-500"
            pagination={{ enabled: true, pageSize: 6, keepFirstRow: true }}
          />
        </div>
        <div className="grid gap-6 md:grid-cols-2 2xl:grid-cols-3">
          <RankedMetricsTableCard
            title="Merchant Active"
            tone="green"
            icon={<IconCircleCheck className="size-4 text-green-500" />}
            headerCols={["BRANCH", "OA", "TRX", "UNIQ REDEEMER"]}
            rows={activeRows}
            pagination={{ enabled: true, pageSize: 6 }}
          />
          <RankedMetricsTableCard
            title="Merchant Productive"
            tone="yellow"
            icon={<IconTrophy className="size-4 text-yellow-500" />}
            headerCols={["BRANCH", "OP", "TRX", "UNIQ REDEEMER"]}
            rows={productiveRows}
            pagination={{ enabled: true, pageSize: 6 }}
          />
          <RankedMetricsTableCard
            title="Merchant Not Active"
            tone="red"
            icon={<IconCircleOff className="size-4 text-primary" />}
            headerCols={["BRANCH", "MERCHANT", "KEYWORD"]}
            rows={inactiveRows}
            pagination={{ enabled: true, pageSize: 6 }}
            paginationInfo={`Total: ${inactiveRows.length}`}
          />
        </div>
        <DataTableCard
          title="Detail List Merchant 🏷️"
          headers={[
            "#",
            "MERCHANT CATEGORY",
            "BRANCH",
            "MERCHANT",
            "KEYWORD",
            "START PERIOD",
            "END PERIOD",
            "POIN",
            "REDEEM",
            "UNIQE REDEEM",
          ]}
          rows={merchantPerMonthRows}
          pagination={{ enabled: true, pageSize: 10 }}
          columnClassNames={[
            "",
            "font-medium",
            "",
            "",
            "font-medium",
            "text-muted-foreground",
            "text-muted-foreground",
            "text-right",
            "text-right font-semibold",
            "text-right font-semibold",
          ]}
        />
      </div>
    </div>
  );
}
