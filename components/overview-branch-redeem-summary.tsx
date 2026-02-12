"use client"

import * as React from "react"
import { Bar, BarChart, CartesianGrid, Cell, XAxis, YAxis } from "recharts"

import { TableCard } from "@/components/table-card"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { formatNumber } from "@/lib/dashboard-metrics"

type BranchRedeemRow = {
  branch: string
  keywordCount: number
  redeemTotal: number
  uniqueRedeem: number
}

type BranchRedeemSummaryProps = {
  data: BranchRedeemRow[]
  loading?: boolean
  totalTransactions?: number
  successRate?: number
}

const colors = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "#f97316",
  "#0ea5e9",
]

export function BranchRedeemSummary({
  data,
  loading = false,
  totalTransactions = 0,
  successRate = 0,
}: BranchRedeemSummaryProps) {
  const topData = data.slice(0, 6)
  const totalRedeem = topData.reduce((sum, row) => sum + row.redeemTotal, 0)

  return (
    <TableCard
      title="POIN Redeem Region"
      description="Perbandingan redeem per branch"
      headerClassName="[&_div[data-slot=card-title]]:text-lg [&_div[data-slot=card-description]]:text-base"
      contentClassName="px-6 py-4"
    >
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Memuat data branch...
        </div>
      ) : topData.length ? (
        <div className="grid gap-4">
          <ChartContainer
            config={{ redeemTotal: { label: "Redeem", color: "var(--chart-1)" } }}
            className="h-[240px] w-full"
          >
            <BarChart data={topData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <ChartTooltip
                cursor={false}
                content={<ChartTooltipContent indicator="dot" />}
              />
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="branch"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                interval={0}
                tick={{ fontSize: 12 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickMargin={6}
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => formatNumber(value)}
              />
              <Bar dataKey="redeemTotal" radius={[6, 6, 0, 0]}>
                {topData.map((entry, index) => (
                  <Cell key={entry.branch} fill={colors[index % colors.length]} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>Total Redeem</span>
            <span className="tabular-nums">{formatNumber(totalRedeem)}</span>
          </div>
          <div className="text-sm text-muted-foreground">
            Total Transaction: {formatNumber(totalTransactions)} • Success Rate: {successRate.toFixed(2)}%
          </div>
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Tidak ada data branch.
        </div>
      )}
    </TableCard>
  )
}
