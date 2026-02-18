"use client";

import * as React from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import { IconAdjustmentsHorizontal, IconDotsVertical, IconRocket, IconStars, IconTrophy } from "@tabler/icons-react";

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatNumber } from "@/lib/dashboard-metrics";

type OverviewTransactionsProps = {
  monthLabel: string;
  previousMonthLabel: string;
  dailySeries: { date: string; value: number }[];
  monthlySeries: { month: string; value: number }[];
  totalDaily: number;
  totalMonthly: number;
  topMerchants: {
    merchant: string;
    category: string;
    branch: string;
    redeem: number;
  }[];
};

const trendConfig = {
  value: { label: "Redeem", color: "var(--chart-1)" },
  unique: { label: "Unique Redeem", color: "var(--chart-2)" },
} satisfies ChartConfig;

export function OverviewTransactions({
  monthLabel,
  previousMonthLabel,
  dailySeries,
  monthlySeries,
  totalDaily,
  totalMonthly,
  topMerchants,
}: OverviewTransactionsProps) {
  const monthlyStackedSeries = React.useMemo(
    () =>
      monthlySeries.map((item) => ({
        month: item.month,
        redeem: item.value,
        uniqueRedeem: Math.round(item.value * 0.86),
      })),
    [monthlySeries],
  );
  const dailyDualSeries = React.useMemo(
    () =>
      dailySeries.map((item) => ({
        date: item.date,
        redeem: item.value,
        uniqueRedeem: Math.round(item.value * 0.84),
      })),
    [dailySeries],
  );

  return (
    <div className="grid gap-4 px-4 lg:px-6 xl:grid-cols-12">
      <Card className="min-w-0 gap-0 border border-border/80 py-0 shadow-sm xl:col-span-5">
        <Tabs defaultValue="monthly">
          <CardHeader className="border-b px-6 py-5">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-start sm:gap-4">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-1">
                  Merchant Analytics
                  <IconRocket className="size-4 text-primary" />
                </CardTitle>
                <CardDescription>{monthLabel}</CardDescription>
              </div>
              <CardAction className="w-full sm:w-auto">
                <TabsList className="h-auto rounded-lg bg-muted p-1">
                  <TabsTrigger value="monthly" className="rounded-md px-3 py-1 text-xs">
                    Monthly
                  </TabsTrigger>
                  <TabsTrigger value="daily" className="rounded-md px-3 py-1 text-xs">
                    Daily
                  </TabsTrigger>
                </TabsList>
              </CardAction>
            </div>
          </CardHeader>
          <CardContent className="px-6 py-5">
            <div className="mb-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
              <div>
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Redeem</p>
                <p className="text-2xl font-bold">{formatNumber(totalMonthly)}</p>
              </div>
              <div>
                <p className="text-xs tracking-wide text-muted-foreground uppercase">Unique Redeem</p>
                <p className="text-2xl font-bold">{formatNumber(totalDaily)}</p>
              </div>
            </div>
            <div className="mb-4 flex items-center gap-4 text-xs">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-primary" />
                <span>Redeem</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded bg-secondary" />
                <span>Unique Redeem</span>
              </div>
            </div>
            <TabsContent value="monthly" className="mt-0">
              <ChartContainer config={trendConfig} className="h-[260px] w-full">
                <BarChart
                  data={monthlyStackedSeries}
                  margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                    tickFormatter={(value) =>
                      new Date(value + "-01").toLocaleDateString("id-ID", {
                        month: "short",
                      })
                    }
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        labelFormatter={(value) =>
                          new Date(value + "-01").toLocaleDateString("id-ID", {
                            month: "long",
                            year: "numeric",
                          })
                        }
                      />
                    }
                  />
                  <Bar dataKey="redeem" fill="var(--chart-1)" stackId="merchant" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="uniqueRedeem" fill="var(--chart-2)" stackId="merchant" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </TabsContent>
            <TabsContent value="daily" className="mt-0">
              <ChartContainer config={trendConfig} className="h-[260px] w-full">
                <AreaChart data={dailyDualSeries} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="fillDailyRedeem" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--chart-1)" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="var(--chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="date"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={6}
                    minTickGap={28}
                    tickFormatter={(value) =>
                      new Date(value).toLocaleDateString("id-ID", {
                        day: "numeric",
                      })
                    }
                  />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        indicator="dot"
                        labelFormatter={(value) =>
                          new Date(value).toLocaleDateString("id-ID", {
                            day: "numeric",
                            month: "short",
                          })
                        }
                      />
                    }
                  />
                  <Area
                    dataKey="redeem"
                    type="monotone"
                    fill="url(#fillDailyRedeem)"
                    stroke="var(--chart-1)"
                    strokeWidth={1.8}
                    dot={false}
                  />
                  <Area
                    dataKey="uniqueRedeem"
                    type="monotone"
                    fill="transparent"
                    stroke="var(--chart-2)"
                    strokeWidth={1.8}
                    strokeDasharray="5 5"
                    dot={false}
                  />
                </AreaChart>
              </ChartContainer>
            </TabsContent>
            <p className="mt-3 text-xs text-muted-foreground">Dibanding {previousMonthLabel}</p>
          </CardContent>
        </Tabs>
      </Card>

      <Card className="min-w-0 gap-0 border border-border/80 py-0 shadow-sm xl:col-span-7">
        <CardHeader className="border-b px-6 py-5">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-1">
              Top Merchant Redeem
              <IconStars className="size-4 text-secondary" />
            </CardTitle>
            <div className="flex items-center gap-1 text-muted-foreground">
              <IconAdjustmentsHorizontal className="size-4" />
              <IconDotsVertical className="size-4" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="no-scrollbar overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-12 px-3" />
                  <TableHead className="px-3">Merchant</TableHead>
                  <TableHead className="px-3">Category</TableHead>
                  <TableHead className="px-3">Branch</TableHead>
                  <TableHead className="px-3 text-right">Redeem</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topMerchants.map((item, index) => (
                  <TableRow key={`${item.merchant}-${item.branch}-${index}`} className="hover:bg-red-50/40">
                    <TableCell className="px-3 text-muted-foreground">
                      {index < 3 ? (
                        <IconTrophy
                          className={`size-4 ${index === 0 ? "text-yellow-500" : index === 1 ? "text-gray-400" : "text-orange-400"}`}
                        />
                      ) : (
                        String(index + 1)
                      )}
                    </TableCell>
                    <TableCell className="px-3 font-medium">{item.merchant}</TableCell>
                    <TableCell className="px-3">{item.category}</TableCell>
                    <TableCell className="px-3">{item.branch}</TableCell>
                    <TableCell className="px-3 text-right font-semibold">{formatNumber(item.redeem)}</TableCell>
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
