"use client"

import { Area, AreaChart, CartesianGrid, XAxis } from "recharts"
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardFooter,
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
  formatPercent,
  getMonthLabel,
  getPreviousMonth,
  sumSeries,
} from "@/lib/dashboard-metrics"

type SectionCardsProps = {
  month: string
}

type StatDefinition = {
  id: string
  label: string
  unit: string
  scale: number
}

const stats: StatDefinition[] = [
  {
    id: "customer-points",
    label: "Total Poin Pelanggan",
    unit: "poin",
    scale: 6.5,
  },
  {
    id: "transactions",
    label: "Total Transaksi",
    unit: "transaksi",
    scale: 3.2,
  },
  {
    id: "total-points",
    label: "Total Poin",
    unit: "poin",
    scale: 9.5,
  },
  {
    id: "redeemers",
    label: "Total Redeemer",
    unit: "redeemer",
    scale: 1.8,
  },
]

export function SectionCards({ month }: SectionCardsProps) {
  const previousMonth = getPreviousMonth(month)
  const monthLabel = getMonthLabel(month)
  const previousMonthLabel = getMonthLabel(previousMonth)

  return (
    <div className="*:data-[slot=card]:from-primary/5 *:data-[slot=card]:to-card dark:*:data-[slot=card]:bg-card grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-gradient-to-t *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4">
      {stats.map((stat) => {
        const currentSeries = buildDailySeries(month, stat.id, {
          scale: stat.scale,
        })
        const previousSeries = buildDailySeries(previousMonth, stat.id, {
          scale: stat.scale,
        })
        const currentTotal = sumSeries(currentSeries)
        const previousTotal = sumSeries(previousSeries)
        const delta = previousTotal
          ? ((currentTotal - previousTotal) / previousTotal) * 100
          : 0
        const isPositive = delta >= 0
        const TrendIcon = isPositive ? IconTrendingUp : IconTrendingDown
        const chartConfig: ChartConfig = {
          value: {
            label: stat.label,
            color: "var(--chart-3)",
          },
        }

        return (
          <Card className="@container/card" key={stat.id}>
            <CardHeader>
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                {formatNumber(currentTotal)}
              </CardTitle>
              <CardAction>
                <Badge variant="outline">
                  <TrendIcon />
                  {isPositive ? "+" : ""}
                  {formatPercent(Math.abs(delta))}%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardFooter className="flex-col items-start gap-1 text-xs">
              <div className="flex w-full items-center justify-between gap-2 font-medium text-foreground/90">
                <span className="truncate">{monthLabel}</span>
                <span className="tabular-nums">
                  {formatNumber(currentTotal)} {stat.unit}
                </span>
              </div>
              <div className="flex w-full items-center justify-between gap-2 text-muted-foreground">
                <span className="truncate">{previousMonthLabel}</span>
                <span className="tabular-nums">
                  {formatNumber(previousTotal)} {stat.unit}
                </span>
              </div>
              <ChartContainer
                config={chartConfig}
                className="mt-2 h-[56px] w-full"
              >
                <AreaChart data={currentSeries} margin={{ left: 0, right: 0 }}>
                  <defs>
                    <linearGradient
                      id={`fill-${stat.id}`}
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="0%"
                        stopColor="var(--color-value)"
                        stopOpacity={0.18}
                      />
                      <stop
                        offset="100%"
                        stopColor="var(--color-value)"
                        stopOpacity={0}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid vertical={false} horizontal={false} />
                  <XAxis dataKey="date" hide />
                  <ChartTooltip
                    cursor={false}
                    content={
                      <ChartTooltipContent
                        labelFormatter={(value) =>
                          new Date(value).toLocaleDateString("id-ID", {
                            month: "short",
                            day: "numeric",
                          })
                        }
                        indicator="dot"
                      />
                    }
                  />
                  <Area
                    dataKey="value"
                    type="monotone"
                    fill={`url(#fill-${stat.id})`}
                    stroke="var(--color-value)"
                    strokeWidth={1.25}
                    dot={false}
                    activeDot={false}
                  />
                </AreaChart>
              </ChartContainer>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
