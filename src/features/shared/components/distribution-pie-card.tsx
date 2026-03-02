"use client";

import * as React from "react";
import { Cell, Pie, PieChart, Sector } from "recharts";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { formatNumber } from "@/lib/dashboard-metrics";
import { cn } from "@/lib/utils";

const chartConfig = {
  value: { label: "Value", color: "var(--chart-1)" },
} satisfies ChartConfig;

const BASE_PIE_COLORS = ["#E00024", "#990019", "#FDB813", "#FF6B00", "#FF9F43"];

type PieLabelProps = {
  cx?: number;
  cy?: number;
  midAngle?: number;
  innerRadius?: number;
  outerRadius?: number;
  value?: number;
};

export type DistributionItem = {
  name: string;
  value: number;
};

type DistributionPieCardProps = {
  title: React.ReactNode;
  icon?: React.ReactNode;
  data: DistributionItem[];
  className?: string;
  minLabelPercent?: number;
  valueLabel?: string;
  percentLabel?: string;
  description?: string;
};

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

const mixHex = (from: string, to: string, amount: number) => {
  const left = hexToRgb(from);
  const right = hexToRgb(to);
  return rgbToHex(
    left.r + (right.r - left.r) * amount,
    left.g + (right.g - left.g) * amount,
    left.b + (right.b - left.b) * amount,
  );
};

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

    const interpolated = rgbToHex(
      leftRgb.r + (rightRgb.r - leftRgb.r) * progress,
      leftRgb.g + (rightRgb.g - leftRgb.g) * progress,
      leftRgb.b + (rightRgb.b - leftRgb.b) * progress,
    );

    // Boost contrast while preserving the original palette character.
    if (position <= 0.5) {
      const darkAmount = 0.24 * (1 - position * 2);
      return mixHex(interpolated, "#000000", darkAmount);
    }

    const lightAmount = 0.2 * ((position - 0.5) * 2);
    return mixHex(interpolated, "#ffffff", lightAmount);
  });
};

export function DistributionPieCard({
  title,
  icon,
  data,
  className,
  minLabelPercent = 10,
  valueLabel = "Jumlah",
  percentLabel = "Persentase",
  description,
}: DistributionPieCardProps) {
  const [activeIndex, setActiveIndex] = React.useState<number>(-1);

  const sortedData = React.useMemo(() => [...data].sort((a, b) => b.value - a.value), [data]);
  const total = React.useMemo(
    () => sortedData.reduce((accumulator, item) => accumulator + item.value, 0),
    [sortedData],
  );
  const colors = React.useMemo(() => buildDynamicPieColors(sortedData.length), [sortedData.length]);

  const chartData = React.useMemo(
    () =>
      sortedData.map((item, index) => ({
        ...item,
        amount: item.value,
        percent: total ? (item.value / total) * 100 : 0,
        color: colors[index],
      })),
    [sortedData, total, colors],
  );

  const renderLabel = (props: PieLabelProps) => {
    const { cx = 0, cy = 0, midAngle = 0, innerRadius = 0, outerRadius = 0, value = 0 } = props;
    if (value < minLabelPercent) return null;

    const radians = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * radians);
    const y = cy + radius * Math.sin(-midAngle * radians);

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
    <Card
      className={cn(
        "gap-0 overflow-hidden border border-border/80 py-0 shadow-sm",
        className,
      )}
    >
      <CardHeader className="px-6 pb-2 pt-6">
        <CardTitle className="flex items-center gap-1 text-lg">
          {title}
          {icon}
        </CardTitle>
      </CardHeader>
      <CardContent className="h-full px-4 pb-5 pt-1 sm:px-6 sm:pb-6">
        <div className="flex h-full items-center justify-center">
          <div className="flex w-full max-w-[26rem] flex-col items-center gap-4 sm:gap-6 2xl:flex-row 2xl:items-center 2xl:justify-center">
            <ChartContainer
              config={chartConfig}
              className="h-[190px] w-[190px] shrink-0 sm:h-[220px] sm:w-[220px]"
            >
              <PieChart>
                <ChartTooltip
                  cursor={false}
                  content={
                    <ChartTooltipContent
                      hideIndicator
                      labelFormatter={(_, payload) => payload?.[0]?.payload?.name ?? "Label"}
                      formatter={(_, __, item) => {
                        const amount = Number(item?.payload?.amount ?? 0);
                        const percent = Number(item?.payload?.percent ?? 0);

                        return (
                          <div className="grid min-w-[10rem] gap-1">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">{valueLabel}</span>
                              <span className="font-mono font-medium tabular-nums text-foreground">
                                {formatNumber(amount)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-muted-foreground">{percentLabel}</span>
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
                  data={chartData}
                  dataKey="percent"
                  nameKey="name"
                  innerRadius={46}
                  outerRadius={94}
                  startAngle={90}
                  endAngle={-270}
                  labelLine={false}
                  label={renderLabel}
                  activeIndex={activeIndex}
                  activeShape={(props: React.ComponentProps<typeof Sector>) => (
                    <Sector {...props} outerRadius={(props.outerRadius ?? 0) + 8} />
                  )}
                  onMouseEnter={(_, index) => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(-1)}
                >
                  {chartData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ChartContainer>

            <div className="grid w-full min-w-0 max-w-[240px] gap-1.5 text-sm text-muted-foreground 2xl:w-[150px] 2xl:max-w-none">
              {chartData.map((item, index) => (
                <div
                  key={item.name}
                  className={cn(
                    "flex items-center gap-2",
                    activeIndex === index ? "font-semibold text-foreground" : undefined,
                  )}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(-1)}
                >
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="truncate">{item.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
        {description ? <p className="mb-3 text-xs text-muted-foreground">{description}</p> : null}
      </CardContent>
    </Card>
  );
}
