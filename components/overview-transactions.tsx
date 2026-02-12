"use client"

import * as React from "react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  Sector,
  XAxis,
} from "recharts"

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatNumber } from "@/lib/dashboard-metrics"

export type CategoryBreakdown = {
  name: string
  value: number
  percent: number
}

type OverviewTransactionsProps = {
  monthLabel: string
  previousMonthLabel: string
  categoryBreakdown: CategoryBreakdown[]
  dailySeries: { date: string; value: number }[]
  dailyRedeemerSeries: { date: string; value: number }[]
  monthlySeries: { month: string; value: number }[]
  monthlyRedeemerSeries: { month: string; value: number }[]
  totalDaily: number
  totalMonthly: number
}

const donutConfig = {
  Fashion: { label: "Fashion", color: "var(--chart-1)" },
  "F&B": { label: "F&B", color: "var(--chart-2)" },
  Grocery: { label: "Grocery", color: "var(--chart-3)" },
  Elektronik: { label: "Elektronik", color: "var(--chart-4)" },
  Lifestyle: { label: "Lifestyle", color: "var(--chart-5)" },
} satisfies ChartConfig

const fallbackColors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

const getCategoryColor = (name: string, index: number) =>
  donutConfig[name as keyof typeof donutConfig]?.color ??
  fallbackColors[index % fallbackColors.length]

const trendConfig = {
  transaksi: { label: "Transaksi", color: "var(--chart-1)" },
  redeemer: { label: "Redeemer", color: "var(--chart-4)" },
  value: { label: "Transaksi", color: "var(--chart-1)" },
} satisfies ChartConfig

export function CategoryBreakdownCard({
  monthLabel,
  categoryBreakdown,
  totalDaily,
}: Pick<OverviewTransactionsProps, "monthLabel" | "categoryBreakdown" | "totalDaily">) {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null)

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">Transaksi per Kategori 🧩</CardTitle>
        <CardDescription className="text-base">{monthLabel}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid items-center gap-4">
          <ChartContainer
            config={donutConfig}
            className="mx-auto aspect-square h-[220px] sm:h-[280px] lg:h-[320px] w-full max-w-[360px]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <Pie
                data={categoryBreakdown}
                dataKey="value"
                nameKey="name"
                innerRadius="48%"
                outerRadius="82%"
                strokeWidth={0}
                activeIndex={activeIndex ?? -1}
                activeShape={
                  ((props: { outerRadius?: number } & Record<string, unknown>) => (
                    <Sector
                      {...(props as any)}
                      outerRadius={(props.outerRadius ?? 0) + 8}
                    />
                  )) as any
                }
                onMouseLeave={() => setActiveIndex(null)}
                onMouseEnter={(_, index) => setActiveIndex(index)}
              >
                {categoryBreakdown.map((entry, index) => (
                  <Cell
                    key={entry.name}
                    fill={getCategoryColor(entry.name, index)}
                  />
                ))}
              </Pie>
              <text
                x="50%"
                y="48%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-foreground text-lg font-semibold"
              >
                {formatNumber(totalDaily)}
              </text>
              <text
                x="50%"
                y="58%"
                textAnchor="middle"
                dominantBaseline="middle"
                className="fill-muted-foreground text-[13px]"
              >
                Total
              </text>
            </PieChart>
          </ChartContainer>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {categoryBreakdown.map((item, index) => (
              <div
                key={item.name}
                className="flex items-center gap-2"
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              >
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor: getCategoryColor(item.name, index),
                  }}
                />
                <span className="text-foreground/80">{item.name}</span>
                <span className="tabular-nums text-muted-foreground/80">
                  {item.percent.toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function TransactionAnalyticsCard({
  monthLabel,
  dailySeries,
  dailyRedeemerSeries,
  monthlySeries,
  monthlyRedeemerSeries,
  totalDaily,
  totalMonthly,
}: Pick<
  OverviewTransactionsProps,
  | "monthLabel"
  | "dailySeries"
  | "dailyRedeemerSeries"
  | "monthlySeries"
  | "monthlyRedeemerSeries"
  | "totalDaily"
  | "totalMonthly"
>) {
  const dailyStacked = React.useMemo(() => {
    const map = new Map<string, { date: string; transaksi: number; redeemer: number }>()
    dailySeries.forEach((row) => {
      map.set(row.date, { date: row.date, transaksi: row.value, redeemer: 0 })
    })
    dailyRedeemerSeries.forEach((row) => {
      const existing = map.get(row.date)
      if (existing) {
        existing.redeemer = row.value
      } else {
        map.set(row.date, { date: row.date, transaksi: 0, redeemer: row.value })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date))
  }, [dailySeries, dailyRedeemerSeries])

  const monthlyStacked = React.useMemo(() => {
    const map = new Map<string, { month: string; transaksi: number; redeemer: number }>()
    monthlySeries.forEach((row) => {
      map.set(row.month, { month: row.month, transaksi: row.value, redeemer: 0 })
    })
    monthlyRedeemerSeries.forEach((row) => {
      const existing = map.get(row.month)
      if (existing) {
        existing.redeemer = row.value
      } else {
        map.set(row.month, { month: row.month, transaksi: 0, redeemer: row.value })
      }
    })
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month))
  }, [monthlySeries, monthlyRedeemerSeries])

  return (
    <Card className="@container/card">
      <Tabs defaultValue="daily">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <CardTitle className="text-2xl md:text-3xl">Transaction Analytics 📊</CardTitle>
              <CardDescription className="text-base">{monthLabel}</CardDescription>
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--chart-1)]" />
                  Transaksi
                </span>
                <span className="inline-flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-[var(--chart-4)]" />
                  Redeemer
                </span>
              </div>
            </div>
            <CardAction>
              <TabsList className="rounded-full bg-muted p-1">
                <TabsTrigger
                  value="daily"
                  className="rounded-full px-3 py-1 text-sm font-medium"
                >
                  Daily
                </TabsTrigger>
                <TabsTrigger
                  value="monthly"
                  className="rounded-full px-3 py-1 text-sm font-medium"
                >
                  Monthly
                </TabsTrigger>
              </TabsList>
            </CardAction>
          </div>
        </CardHeader>
        <CardContent className="pb-0 pt-0">
          <TabsContent value="daily" className="mt-0">
            <div className="mb-1 text-base font-semibold tabular-nums">
              {formatNumber(totalDaily)} transaksi
            </div>
            <ChartContainer
              config={trendConfig}
              className="aspect-auto h-[280px] w-full"
            >
              <BarChart data={dailyStacked} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  minTickGap={28}
                  tick={{ fontSize: 12 }}
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
                <Bar dataKey="transaksi" stackId="daily" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="redeemer" stackId="daily" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </TabsContent>
          <TabsContent value="monthly" className="mt-0">
            <div className="mb-1 text-base font-semibold tabular-nums">
              {formatNumber(totalMonthly)} transaksi
            </div>
            <ChartContainer
              config={trendConfig}
              className="aspect-auto h-[280px] w-full"
            >
              <BarChart data={monthlyStacked} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                <CartesianGrid vertical={false} />
                <XAxis
                  dataKey="month"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={6}
                  tick={{ fontSize: 12 }}
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
                <Bar dataKey="transaksi" stackId="monthly" fill="var(--chart-1)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="redeemer" stackId="monthly" fill="var(--chart-4)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  )
}

export function OverviewTransactions(props: OverviewTransactionsProps) {
  return (
    <div className="grid gap-4 px-4 lg:grid-cols-2 lg:px-6">
      <CategoryBreakdownCard
        monthLabel={props.monthLabel}
        categoryBreakdown={props.categoryBreakdown}
        totalDaily={props.totalDaily}
      />
      <TransactionAnalyticsCard
        monthLabel={props.monthLabel}
        dailySeries={props.dailySeries}
        dailyRedeemerSeries={props.dailyRedeemerSeries}
        monthlySeries={props.monthlySeries}
        monthlyRedeemerSeries={props.monthlyRedeemerSeries}
        totalDaily={props.totalDaily}
        totalMonthly={props.totalMonthly}
      />
    </div>
  )
}
