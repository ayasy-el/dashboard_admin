"use client";

import * as React from "react";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, XAxis } from "recharts";
import { IconCircleCheck, IconCircleOff, IconSun, IconTrophy, IconWand } from "@tabler/icons-react";
import { Sector } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatNumber } from "@/lib/dashboard-metrics";

type OverviewExtraPanelsProps = {
  monthLabel: string;
  previousMonthLabel: string;
  trendSeries: { date: string; value: number }[];
  trendTotal: number;
};

const categoryData = [
  { name: "Health", value: 150 },
  { name: "Food", value: 80 },
  { name: "Shop", value: 70 },
  { name: "Program", value: 180 },
  { name: "Dining", value: 50 },
  { name: "Dining", value: 50 },
];

const categoryConfig = {
  value: { label: "Kategori", color: "var(--chart-1)" },
} satisfies ChartConfig;

const BASE_PIE_COLORS = ["#E00024", "#990019", "#FDB813", "#FF6B00", "#FF9F43"];
const MIN_LABEL_PERCENT = 10;

const hexToRgb = (hex: string) => {
  const cleaned = hex.replace("#", "");
  const normalized =
    cleaned.length === 3
      ? cleaned
          .split("")
          .map((char) => char + char)
          .join("")
      : cleaned;

  const value = Number.parseInt(normalized, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((channel) => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;

const luminance = (hex: string) => {
  const { r, g, b } = hexToRgb(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};

const buildDynamicPieColors = (count: number) => {
  if (count <= 0) return [];

  const sortedStops = [...BASE_PIE_COLORS].sort((a, b) => luminance(a) - luminance(b));
  if (count === 1) return [sortedStops[0]];
  if (sortedStops.length === 1) return Array.from({ length: count }, () => sortedStops[0]);

  return Array.from({ length: count }, (_, index) => {
    const position = index / (count - 1);
    const segment = position * (sortedStops.length - 1);
    const left = Math.floor(segment);
    const right = Math.min(left + 1, sortedStops.length - 1);
    const progress = segment - left;

    const leftRgb = hexToRgb(sortedStops[left]);
    const rightRgb = hexToRgb(sortedStops[right]);

    return rgbToHex(
      leftRgb.r + (rightRgb.r - leftRgb.r) * progress,
      leftRgb.g + (rightRgb.g - leftRgb.g) * progress,
      leftRgb.b + (rightRgb.b - leftRgb.b) * progress,
    );
  });
};

type PieLabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  value?: number;
};

const trendConfig = {
  value: { label: "Transaksi", color: "var(--chart-1)" },
} satisfies ChartConfig;

const regionRows = [
  {
    region: "Jawa Timur",
    keyword: 268,
    statusRedeem: "77.753",
    statusWidth: "85%",
    uniqueRedeem: "67.364",
    uniqueWidth: "75%",
    bold: true,
  },
  {
    region: "Surabaya",
    keyword: 36,
    statusRedeem: "30.990",
    statusWidth: "60%",
    uniqueRedeem: "24.015",
    uniqueWidth: "50%",
  },
  {
    region: "Madiun",
    keyword: 78,
    statusRedeem: "21.615",
    statusWidth: "45%",
    uniqueRedeem: "20.871",
    uniqueWidth: "40%",
  },
  {
    region: "Lamongan",
    keyword: 25,
    statusRedeem: "14.133",
    statusWidth: "30%",
    uniqueRedeem: "12.752",
    uniqueWidth: "25%",
  },
];

const detailRows = [
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

function ProgressBar({ width, color }: { width: string; color: string }) {
  return (
    <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
      <div className={`h-full ${color}`} style={{ width }} />
    </div>
  );
}

function StatusCard({
  title,
  tone,
  icon,
  headerCols,
  rows,
}: {
  title: string;
  tone: "green" | "yellow" | "red";
  icon: React.ReactNode;
  headerCols: [string, string, string, string];
  rows: [string, string, string, string][];
}) {
  const toneClass =
    tone === "green" ? "bg-green-50/40" : tone === "yellow" ? "bg-yellow-50/40" : "bg-red-50/40";

  return (
    <Card className="gap-0 overflow-hidden border border-border/80 py-0 shadow-sm">
      <CardHeader className={`border-b px-4 py-4 ${toneClass}`}>
        <CardTitle className="flex items-center gap-1 text-base">
          {title}
          {icon}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="px-3">{headerCols[0]}</TableHead>
              <TableHead className="px-3 text-right">{headerCols[1]}</TableHead>
              <TableHead className="px-3 text-right">{headerCols[2]}</TableHead>
              <TableHead className="px-3 text-right">{headerCols[3]}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={`${title}-${row[0]}`}>
                <TableCell className="px-3 font-medium">{row[0]}</TableCell>
                <TableCell className="px-3 text-right">{row[1]}</TableCell>
                <TableCell className="px-3 text-right">{row[2]}</TableCell>
                <TableCell className="px-3 text-right">{row[3]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

export function OverviewExtraPanels({
  monthLabel,
  previousMonthLabel,
  trendSeries,
  trendTotal,
}: OverviewExtraPanelsProps) {
  const [activeCategoryIndex, setActiveCategoryIndex] = React.useState<number>(-1);
  const sortedCategoryData = React.useMemo(
    () => [...categoryData].sort((a, b) => b.value - a.value),
    [],
  );

  const total = sortedCategoryData.reduce((acc, d) => acc + d.value, 0);
  const pieColors = React.useMemo(
    () => buildDynamicPieColors(sortedCategoryData.length),
    [sortedCategoryData.length],
  );
  const categoryChartData = React.useMemo(
    () =>
      sortedCategoryData.map((item, index) => ({
        ...item,
        amount: item.value,
        percent: total ? (item.value / total) * 100 : 0,
        color: pieColors[index],
      })),
    [sortedCategoryData, total, pieColors],
  );

  // Urut searah jarum jam dari jam 12: terbesar -> terkecil.
  const startAngle = 90;
  const endAngle = -270;

  const renderCategoryLabel = (props: PieLabelProps) => {
    const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, value = 0 } = props;

    if (value < MIN_LABEL_PERCENT) return null;

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="#ffffff"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-[10px] font-semibold"
      >
        {Number(value).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
      </text>
    );
  };

  return (
    <div className="space-y-6 px-4 lg:px-6">
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="gap-0 border border-border/80 py-0 shadow-sm lg:col-span-4">
          <CardHeader className="px-6 pb-2 pt-6">
            <CardTitle className="flex items-center gap-1 text-lg">
              Merchant Categories
              <IconWand className="size-4 text-secondary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="px-6 pb-6 pt-1">
            <div className="flex items-center justify-between gap-3">
              <ChartContainer config={categoryConfig} className="h-[230px] w-[230px] shrink-0">
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        hideIndicator
                        labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? "Kategori"}
                        formatter={(_, __, ___, ____, payload) => {
                          const amount = Number(payload?.amount ?? 0);
                          const percent = Number(payload?.percent ?? 0);

                          return (
                            <div className="grid min-w-[10rem] gap-1">
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Jumlah</span>
                                <span className="font-mono font-medium tabular-nums text-foreground">
                                  {formatNumber(amount)}
                                </span>
                              </div>
                              <div className="flex items-center justify-between gap-3">
                                <span className="text-muted-foreground">Persentase</span>
                                <span className="font-mono font-medium tabular-nums text-foreground">
                                  {percent.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%
                                </span>
                              </div>
                            </div>
                          );
                        }}
                      />
                    }
                  />
                  <Pie
                    data={categoryChartData}
                    dataKey="percent"
                    nameKey="name"
                    innerRadius={46}
                    outerRadius={94}
                    startAngle={startAngle}
                    endAngle={endAngle}
                    labelLine={false}
                    label={renderCategoryLabel}
                    activeIndex={activeCategoryIndex}
                    activeShape={(props: React.ComponentProps<typeof Sector>) => (
                      <Sector {...props} outerRadius={(props.outerRadius ?? 0) + 8} />
                    )}
                    onMouseEnter={(_, index) => setActiveCategoryIndex(index)}
                    onMouseLeave={() => setActiveCategoryIndex(-1)}
                  >
                    {categoryChartData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
              <div className="grid w-[130px] gap-1.5 text-sm text-muted-foreground">
                {categoryChartData.map((item, index) => (
                  <div
                    key={item.name}
                    className={`flex items-center gap-2 ${activeCategoryIndex === index ? "font-semibold text-foreground" : ""}`}
                    onMouseEnter={() => setActiveCategoryIndex(index)}
                    onMouseLeave={() => setActiveCategoryIndex(-1)}
                  >
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span>{item.name}</span>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="gap-0 border border-border/80 py-0 shadow-sm lg:col-span-8">
          <CardHeader className="px-6 py-5">
            <CardTitle className="flex items-center gap-1 text-lg">
              POIN Redeem Region
              <IconSun className="size-4 text-secondary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="px-4">Region</TableHead>
                    <TableHead className="px-4 text-center">Keyword</TableHead>
                    <TableHead className="px-4">Status Redeem</TableHead>
                    <TableHead className="px-4">Unique Redeem</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regionRows.map((row, idx) => (
                    <TableRow key={row.region}>
                      <TableCell
                        className={`px-4 ${row.bold ? "font-bold" : "font-medium text-muted-foreground"}`}
                      >
                        {row.region}
                      </TableCell>
                      <TableCell className="px-4 text-center">{row.keyword}</TableCell>
                      <TableCell className="px-4">
                        <div className="flex items-center gap-2">
                          <span className="w-14 text-right tabular-nums">{row.statusRedeem}</span>
                          <ProgressBar
                            width={row.statusWidth}
                            color={idx === 0 ? "bg-primary" : "bg-primary/70"}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="px-4">
                        <div className="flex items-center gap-2">
                          <span className="w-14 text-right tabular-nums">{row.uniqueRedeem}</span>
                          <ProgressBar
                            width={row.uniqueWidth}
                            color={idx === 0 ? "bg-secondary" : "bg-secondary/80"}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <StatusCard
          title="Merchant Active"
          tone="green"
          icon={<IconCircleCheck className="size-4 text-green-500" />}
          headerCols={["Branch", "OA", "TRX", "Uniq Red"]}
          rows={[
            ["1. Madiun", "79", "21.609", "20.865"],
            ["2. Malang", "56", "5.389", "4.761"],
            ["3. Sidoarjo", "39", "3.890", "3.391"],
            ["4. Surabaya", "35", "30.505", "23.552"],
          ]}
        />
        <StatusCard
          title="Merchant Productive"
          tone="yellow"
          icon={<IconTrophy className="size-4 text-yellow-500" />}
          headerCols={["Branch", "OP", "TRX", "Uniq Red"]}
          rows={[
            ["1. Madiun", "75", "21.609", "20.865"],
            ["2. Malang", "55", "5.389", "4.761"],
            ["3. Sidoarjo", "38", "3.890", "3.391"],
            ["4. Surabaya", "31", "30.505", "23.552"],
          ]}
        />
        <StatusCard
          title="Merchant Not Active"
          tone="red"
          icon={<IconCircleOff className="size-4 text-primary" />}
          headerCols={["Branch", "Merchant", "Keyword", ""]}
          rows={[
            ["1. Sidoarjo", "Prodia Mojokerto", "SDAPROM102", ""],
            ["2. Sidoarjo", "Prodia Mojokerto", "SDAPROM152", ""],
            ["3. Lamongan", "Naavagreen Lmg", "LMGNVGTBN", ""],
            ["4. Jember", "Naavagreen Byw", "JMBNVB3024", ""],
          ]}
        />
      </div>

      <Card className="gap-0 overflow-hidden border border-border/80 py-0 shadow-sm">
        <CardHeader className="border-b px-6 py-5">
          <CardTitle className="text-lg">Detail List Merchant</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-black text-white hover:bg-black">
                  <TableHead className="px-4 text-white">#</TableHead>
                  <TableHead className="px-4 text-white">Merchant Category</TableHead>
                  <TableHead className="px-4 text-white">Branch</TableHead>
                  <TableHead className="px-4 text-white">Merchant</TableHead>
                  <TableHead className="px-4 text-white">Keyword</TableHead>
                  <TableHead className="px-4 text-white">Start Period</TableHead>
                  <TableHead className="px-4 text-white">End Period</TableHead>
                  <TableHead className="px-4 text-right text-white">Poin</TableHead>
                  <TableHead className="px-4 text-right text-white">Redeem</TableHead>
                  <TableHead className="px-4 text-right text-white">Unique Redeem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detailRows.map((row) => (
                  <TableRow key={row[0]}>
                    <TableCell className="px-4">{row[0]}</TableCell>
                    <TableCell className="px-4">{row[1]}</TableCell>
                    <TableCell className="px-4">{row[2]}</TableCell>
                    <TableCell className="px-4 font-medium">{row[3]}</TableCell>
                    <TableCell className="px-4 text-muted-foreground">{row[4]}</TableCell>
                    <TableCell className="px-4 text-muted-foreground">{row[5]}</TableCell>
                    <TableCell className="px-4 text-muted-foreground">{row[6]}</TableCell>
                    <TableCell className="px-4 text-right">{row[7]}</TableCell>
                    <TableCell className="px-4 text-right font-semibold">{row[8]}</TableCell>
                    <TableCell className="px-4 text-right font-semibold">{row[9]}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
