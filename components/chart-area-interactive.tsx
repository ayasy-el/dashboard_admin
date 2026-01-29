"use client"

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"

import { Badge } from "@/components/ui/badge"
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
import {
  buildDailySeries,
  formatNumber,
  getMonthLabel,
  sumSeries,
} from "@/lib/dashboard-metrics"

export const description = "An interactive area chart"

type ChartAreaInteractiveProps = {
  month: string
}

const chartConfig = {
  value: {
    label: "Total Poin",
    color: "var(--chart-1)",
  },
} satisfies ChartConfig

export function ChartAreaInteractive({ month }: ChartAreaInteractiveProps) {
  const chartData = buildDailySeries(month, "overview-trend", { scale: 8.5 })
  const total = sumSeries(chartData)
  const monthLabel = getMonthLabel(month)

  return (
    <Card className="@container/card">
      <CardHeader>
        <CardTitle>Trend Poin Harian</CardTitle>
        <CardDescription>Per hari • {monthLabel}</CardDescription>
        <CardAction>
          <Badge variant="secondary">Total {formatNumber(total)}</Badge>
        </CardAction>
      </CardHeader>
      <CardContent className="px-2 pt-4 sm:px-6 sm:pt-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <AreaChart data={chartData}>
            <defs>
              <linearGradient id="fillValue" x1="0" y1="0" x2="0" y2="1">
                <stop
                  offset="5%"
                  stopColor="var(--color-value)"
                  stopOpacity={0.9}
                />
                <stop
                  offset="95%"
                  stopColor="var(--color-value)"
                  stopOpacity={0.1}
                />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={24}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString("id-ID", {
                  day: "numeric",
                })
              }}
            />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(value) =>
                    new Date(value).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "short",
                    })
                  }
                  indicator="dot"
                />
              }
            />
            <Area
              dataKey="value"
              type="natural"
              fill="url(#fillValue)"
              stroke="var(--color-value)"
            />
          </AreaChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
