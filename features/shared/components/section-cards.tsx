"use client"

import { Area, AreaChart, XAxis } from "recharts"
import { IconTrendingDown, IconTrendingUp } from "@tabler/icons-react"

import { Badge } from "@/components/ui/badge"
import {
  Card,
  CardAction,
  CardContent,
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
import { formatNumber, formatPercent } from "@/lib/dashboard-metrics"
import { cn } from "@/lib/utils"

export type StatCard = {
  id: string
  label: string
  unit: string
  currentTotal: number
  previousTotal: number
  series?: { date: string; value: number }[]
}

type SectionCardsProps = {
  monthLabel: string
  previousMonthLabel: string
  stats: StatCard[]
  className?: string
}

export function SectionCards({
  monthLabel,
  previousMonthLabel,
  stats,
  className,
}: SectionCardsProps) {
  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-4 px-4 *:data-[slot=card]:bg-card *:data-[slot=card]:shadow-xs lg:px-6 @xl/main:grid-cols-2 @5xl/main:grid-cols-4",
        className
      )}
    >
      {stats.map((stat, index) => {
        const delta = stat.previousTotal
          ? ((stat.currentTotal - stat.previousTotal) / stat.previousTotal) * 100
          : 0
        const hasSeries = Boolean(stat.series?.length)
        const isPositive = delta >= 0
        const TrendIcon = isPositive ? IconTrendingUp : IconTrendingDown
        const chartConfig: ChartConfig = {
          value: {
            label: stat.label,
            color: "var(--chart-3)",
          },
        }

        return (
          <Card
            className={cn(
              "@container/card border-t-4",
              index % 2 === 0 ? "border-t-primary" : "border-t-secondary"
            )}
            key={stat.id}
          >
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              {hasSeries ? (
                <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {formatNumber(stat.currentTotal)}
                </CardTitle>
              ) : null}
              <CardAction>
                <Badge className="border-green-100 bg-green-50 text-green-700" variant="outline">
                  <TrendIcon />
                  {isPositive ? "+" : ""}
                  {formatPercent(Math.abs(delta))}%
                </Badge>
              </CardAction>
            </CardHeader>
            <CardContent className="px-6 pt-0">
              {hasSeries ? (
                <ChartContainer config={chartConfig} className="h-[64px] w-full">
                  <AreaChart data={stat.series}>
                    <defs>
                      <linearGradient
                        id={`fill-${stat.id}`}
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="10%"
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
              ) : (
                <div className="flex h-[64px] items-center justify-center text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
                  {formatNumber(stat.currentTotal)}
                </div>
              )}
            </CardContent>
            <CardFooter className="flex-col items-start gap-1 text-xs">
              <div className="flex w-full items-center justify-between gap-2 font-medium text-foreground/90">
                <span className="truncate">{monthLabel}</span>
                <span className="tabular-nums">
                  {formatNumber(stat.currentTotal)} {stat.unit}
                </span>
              </div>
              <div className="flex w-full items-center justify-between gap-2 text-muted-foreground">
                <span className="truncate">{previousMonthLabel}</span>
                <span className="tabular-nums">
                  {formatNumber(stat.previousTotal)} {stat.unit}
                </span>
              </div>
            </CardFooter>
          </Card>
        )
      })}
    </div>
  )
}
