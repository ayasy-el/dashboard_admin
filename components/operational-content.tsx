"use client"

import * as React from "react"

import { SectionCards, type StatCard } from "@/components/section-cards"
import { TableCard } from "@/components/table-card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  buildDailySeries,
  formatMonthValue,
  formatNumber,
  getMonthLabel,
  getMonthDays,
  getPreviousMonth,
  sumSeries,
} from "@/lib/dashboard-metrics"

type MonthOption = {
  value: string
  label: string
}

const tableClassName =
  "[&_th]:px-5 [&_td]:px-5 [&_td]:py-3 [&_th]:h-14 [&_th:first-child]:pl-12 [&_td:first-child]:pl-12 [&_th:last-child]:pr-12 [&_td:last-child]:pr-12 [&_th]:text-center [&_td]:text-center [&_th:first-child]:text-left [&_td:first-child]:text-left"

const fallbackMonthOptions = () => {
  const options: MonthOption[] = []
  const now = new Date()

  for (let i = 0; i < 6; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = formatMonthValue(date)
    options.push({
      value,
      label: getMonthLabel(value),
    })
  }

  return options
}

const getOperationalStats = (monthValue: string) => {
  const previousMonth = getPreviousMonth(monthValue)
  const monthLabel = getMonthLabel(monthValue)
  const previousMonthLabel = getMonthLabel(previousMonth)

  const successSeries = buildDailySeries(monthValue, "transaction-success", {
    scale: 1.2,
  })
  const failedSeries = buildDailySeries(monthValue, "transaction-failed", {
    scale: 0.35,
  })
  const successPrevSeries = buildDailySeries(previousMonth, "transaction-success", {
    scale: 1.1,
  })
  const failedPrevSeries = buildDailySeries(previousMonth, "transaction-failed", {
    scale: 0.32,
  })

  const stats: StatCard[] = [
    {
      id: "transaction-success",
      label: "Transaction Success",
      unit: "transaksi",
      currentTotal: sumSeries(successSeries),
      previousTotal: sumSeries(successPrevSeries),
      series: successSeries,
    },
    {
      id: "transaction-failed",
      label: "Transaction Failed",
      unit: "transaksi",
      currentTotal: sumSeries(failedSeries),
      previousTotal: sumSeries(failedPrevSeries),
      series: failedSeries,
    },
  ]

  return { monthLabel, previousMonthLabel, stats }
}

const hashString = (value: string) => {
  let hash = 0
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 10000
  }
  return hash
}

const formatDate = (date: Date) =>
  date.toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })

const buildTopMerchants = (monthValue: string) => {
  const seed = hashString(monthValue)
  const rows = [
    { merchant: "Kopi Senja", keyword: "promo-minum", base: 1800 },
    { merchant: "Saji Nusantara", keyword: "makan-hemat", base: 1520 },
    { merchant: "Urban Mart", keyword: "grocery-sale", base: 1310 },
    { merchant: "Style Avenue", keyword: "fashion-week", base: 1180 },
    { merchant: "Elektronika Plus", keyword: "tech-bonus", base: 990 },
  ]

  return rows.map((row, index) => {
    const offset = (seed + index * 137) % 180
    const totalTransactions = row.base + offset
    const uniqMerchant = Math.max(40, Math.round(totalTransactions * 0.07))
    const uniqRedeemer = Math.max(220, Math.round(totalTransactions * 0.38))
    return {
      merchant: row.merchant,
      uniqMerchant,
      keyword: row.keyword,
      totalTransactions,
      uniqRedeemer,
    }
  })
}

const buildExpiredThisMonth = (monthValue: string) => {
  const [year, month] = monthValue.split("-").map(Number)
  const totalDays = getMonthDays(monthValue)
  const starts = [2, 5, 8, 11, 15]
  const ends = [10, 17, 20, 23, 27]
  const rows = [
    { merchant: "Nusa Grill", keyword: "weekend-bbq" },
    { merchant: "Daily Fresh", keyword: "fresh-morning" },
    { merchant: "Gadget Hub", keyword: "new-year-tech" },
    { merchant: "Kopi Tengah", keyword: "coffee-boost" },
    { merchant: "Rasa Timur", keyword: "spice-up" },
  ]

  return rows.map((row, index) => {
    const startDay = Math.min(starts[index], totalDays)
    const endDay = Math.min(ends[index], totalDays)
    const startPeriod = formatDate(new Date(year, month - 1, startDay))
    const endPeriod = formatDate(new Date(year, month - 1, endDay))
    return {
      merchant: row.merchant,
      keyword: row.keyword,
      startPeriod,
      endPeriod,
    }
  })
}

export function OperationalContent() {
  const [monthOptions] = React.useState<MonthOption[]>(() => fallbackMonthOptions())
  const [selectedMonth, setSelectedMonth] = React.useState(
    monthOptions[0]?.value ?? formatMonthValue(new Date())
  )

  const { monthLabel, previousMonthLabel, stats } = React.useMemo(
    () => getOperationalStats(selectedMonth),
    [selectedMonth]
  )
  const topMerchants = React.useMemo(
    () => buildTopMerchants(selectedMonth),
    [selectedMonth]
  )
  const expiredThisMonth = React.useMemo(
    () => buildExpiredThisMonth(selectedMonth),
    [selectedMonth]
  )

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 lg:px-6">
        <div className="text-sm font-medium text-muted-foreground">Ringkasan bulan</div>
        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
          <SelectTrigger className="w-[200px]" size="sm" aria-label="Pilih bulan">
            <SelectValue placeholder="Pilih bulan" />
          </SelectTrigger>
          <SelectContent className="rounded-xl">
            {monthOptions.map((option) => (
              <SelectItem key={option.value} value={option.value} className="rounded-lg">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <SectionCards
        monthLabel={monthLabel}
        previousMonthLabel={previousMonthLabel}
        stats={stats}
        className="mx-auto w-full max-w-4xl px-0 sm:grid-cols-2 @xl/main:grid-cols-2 @5xl/main:grid-cols-2"
      />

      <div className="grid gap-6 px-4 lg:px-6">
        <TableCard title="Top Merchant">
          <Table className={tableClassName}>
            <TableHeader className="bg-muted/60 text-muted-foreground">
              <TableRow>
                <TableHead><b>Nama Merchant</b></TableHead>
                <TableHead><b>Uniq Merchant</b></TableHead>
                <TableHead><b>Keyword</b></TableHead>
                <TableHead><b>Jumlah Transaksi</b></TableHead>
                <TableHead><b>Uniq Redeemer</b></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {topMerchants.map((row) => (
                <TableRow key={`${row.merchant}-${row.keyword}`}>
                  <TableCell className="font-medium">{row.merchant}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatNumber(row.uniqMerchant)}
                  </TableCell>
                  <TableCell>{row.keyword}</TableCell>
                  <TableCell className="tabular-nums">
                    {formatNumber(row.totalTransactions)}
                  </TableCell>
                  <TableCell className="tabular-nums">
                    {formatNumber(row.uniqRedeemer)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>

        <TableCard title="Expired This Month">
          <Table className={tableClassName}>
            <TableHeader className="bg-muted/60 text-muted-foreground">
              <TableRow>
                <TableHead><b>Merchant</b></TableHead>
                <TableHead><b>Keyword</b></TableHead>
                <TableHead><b>Start Period</b></TableHead>
                <TableHead><b>End Period</b></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {expiredThisMonth.map((row) => (
                <TableRow key={`${row.merchant}-${row.keyword}`}>
                  <TableCell className="font-medium">{row.merchant}</TableCell>
                  <TableCell>{row.keyword}</TableCell>
                  <TableCell>{row.startPeriod}</TableCell>
                  <TableCell>{row.endPeriod}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      </div>
    </div>
  )
}
