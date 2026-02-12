import { IconCircleCheck, IconCircleOff, IconSun, IconTrophy, IconWand } from "@tabler/icons-react";

import {
  ComparisonProgressTableCard,
  type ComparisonProgressRow,
} from "@/features/shared/components/comparison-progress-table-card";
import {
  DataTableCard,
} from "@/features/shared/components/data-table-card";
import {
  DistributionPieCard,
  type DistributionItem,
} from "@/features/shared/components/distribution-pie-card";
import { RankedMetricsTableCard } from "@/features/shared/components/ranked-metrics-table-card";

type OverviewExtraPanelsProps = {
  monthLabel: string;
  previousMonthLabel: string;
  trendSeries: { date: string; value: number }[];
  trendTotal: number;
};

const categoryData: DistributionItem[] = [
  { name: "Health", value: 150 },
  { name: "Food", value: 80 },
  { name: "Shop", value: 70 },
  { name: "Program", value: 180 },
  { name: "Dining", value: 50 },
];

const regionRows: ComparisonProgressRow[] = [
  {
    id: "jawa-timur",
    label: "Jawa Timur",
    highlightLabel: true,
    metric: 268,
    left: { value: "77.753", width: "85%" },
    right: { value: "67.364", width: "75%" },
  },
  {
    id: "surabaya",
    label: "Surabaya",
    metric: 36,
    left: { value: "30.990", width: "60%" },
    right: { value: "24.015", width: "50%" },
  },
  {
    id: "madiun",
    label: "Madiun",
    metric: 78,
    left: { value: "21.615", width: "45%" },
    right: { value: "20.871", width: "40%" },
  },
  {
    id: "lamongan",
    label: "Lamongan",
    metric: 25,
    left: { value: "14.133", width: "30%" },
    right: { value: "12.752", width: "25%" },
  },
];

const detailRows: string[][] = [
  [
    "1",
    "Sport and Education",
    "Surabaya",
    "Atlas Surabaya",
    "SBYAT102024",
    "5 Des 2024",
    "25 Des 2025",
    "1000",
    "13.681",
    "11.598",
  ],
  [
    "2",
    "Food",
    "Lamongan",
    "Tanah Datar",
    "LMGTD202025",
    "1 Jan 2025",
    "31 Des 2025",
    "2000",
    "10.328",
    "9.306",
  ],
  [
    "3",
    "Shop",
    "Madiun",
    "iLuFA168 Trenggalek",
    "PNGILUFA33024",
    "21 Agu 2024",
    "31 Des 2025",
    "3000",
    "3.249",
    "3.222",
  ],
  [
    "4",
    "Health and Beauty",
    "Surabaya",
    "Prodia Darmo Permai",
    "SBYPROD32024",
    "26 Agu 2024",
    "26 Agu 2026",
    "1000",
    "3.141",
    "2.211",
  ],
  [
    "5",
    "Program",
    "Surabaya",
    "AIOLA EATERY SBY",
    "SBYFES1502025",
    "28 Nov 2025",
    "31 Jan 2026",
    "500",
    "2.978",
    "1.182",
  ],
];

export function OverviewExtraPanels(props: OverviewExtraPanelsProps) {
  void props;

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <DistributionPieCard
          className="lg:col-span-4"
          title="Merchant Categories"
          icon={<IconWand className="size-4 text-secondary" />}
          data={categoryData}
          minLabelPercent={10}
        />

        <ComparisonProgressTableCard
          className="lg:col-span-8"
          title="POIN Redeem Region"
          icon={<IconSun className="size-4 text-secondary" />}
          headers={["Region", "Keyword", "Status Redeem", "Unique Redeem"]}
          rows={regionRows}
        />
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <RankedMetricsTableCard
          title="Merchant Active"
          tone="green"
          icon={<IconCircleCheck className="size-4 text-green-500" />}
          headerCols={["Branch", "OA", "TRX", "Uniq Red"]}
          rows={[
            ["Madiun", "79", "21.609", "20.865"],
            ["Malang", "56", "5.389", "4.761"],
            ["Sidoarjo", "39", "3.890", "3.391"],
            ["Surabaya", "35", "30.505", "23.552"],
          ]}
        />
        <RankedMetricsTableCard
          title="Merchant Productive"
          tone="yellow"
          icon={<IconTrophy className="size-4 text-yellow-500" />}
          headerCols={["Branch", "OP", "TRX", "Uniq Red"]}
          rows={[
            ["Madiun", "75", "21.609", "20.865"],
            ["Malang", "55", "5.389", "4.761"],
            ["Sidoarjo", "38", "3.890", "3.391"],
            ["Surabaya", "31", "30.505", "23.552"],
          ]}
        />
        <RankedMetricsTableCard
          title="Merchant Not Active"
          tone="red"
          icon={<IconCircleOff className="size-4 text-primary" />}
          headerCols={["Branch", "Merchant", "Keyword", ""]}
          rows={[
            ["Sidoarjo", "Prodia Mojokerto", "SDAPROM102", ""],
            ["Sidoarjo", "Prodia Mojokerto", "SDAPROM152", ""],
            ["Lamongan", "Naavagreen Lmg", "LMGNVGTBN", ""],
            ["Jember", "Naavagreen Byw", "JMBNVB3024", ""],
          ]}
        />
      </div>

      <DataTableCard
        title="Detail List Merchant"
        headers={[
          "#",
          "Merchant Category",
          "Branch",
          "Merchant",
          "Keyword",
          "Start Period",
          "End Period",
          "Poin",
          "Redeem",
          "Unique Redeem",
        ]}
        rows={detailRows}
        rowKey={(row) => String(row[0])}
        headerRowClassName="bg-black text-white hover:bg-black"
        headerCellClassName="text-white"
        columnClassNames={[
          "",
          "",
          "",
          "font-medium",
          "font-medium",
          "font-medium",
          "font-medium",
          "text-right",
          "text-right font-semibold",
          "text-right font-semibold",
        ]}
      />
    </div>
  );
}
