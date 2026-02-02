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

type MonthOption = {
  value: string
  label: string
}

type OperationalResponse = {
  month: string
  monthLabel: string
  previousMonth: string
  previousMonthLabel: string
  cards: {
    success: {
      current: number
      previous: number
      series: { date: string; value: number }[]
    }
    failed: {
      current: number
      previous: number
      series: { date: string; value: number }[]
    }
  }
  topMerchants: {
    merchant: string
    keyword: string
    totalTransactions: number
    uniqMerchant: string
    uniqRedeemer: number
  }[]
  expiredRules: {
    merchant: string
    keyword: string
    startPeriod: string
    endPeriod: string
  }[]
}

const tableClassName =
  "[&_th]:px-5 [&_td]:px-5 [&_td]:py-3 [&_th]:h-14 [&_th:first-child]:pl-12 [&_td:first-child]:pl-12 [&_th:last-child]:pr-12 [&_td:last-child]:pr-12"

const fallbackMonthOptions = () => {
  const options: MonthOption[] = []
  const now = new Date()

  for (let i = 0; i < 6; i += 1) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
    options.push({
      value,
      label: date.toLocaleDateString("id-ID", { month: "long", year: "numeric" }),
    })
  }

  return options
}

export function OperationalContent() {
  const [monthOptions, setMonthOptions] = React.useState<MonthOption[]>(() =>
    fallbackMonthOptions()
  )
  const [selectedMonth, setSelectedMonth] = React.useState(
    monthOptions[0]?.value ?? monthOptions[0]?.value
  )
  const [data, setData] = React.useState<OperationalResponse | null>(null)
  const [loading, setLoading] = React.useState(false)

  React.useEffect(() => {
    let active = true

    const loadMonths = async () => {
      try {
        const response = await fetch("/api/overview/months")
        if (!response.ok) {
          throw new Error("Failed to load month options")
        }
        const payload = (await response.json()) as { months: MonthOption[] }
        if (active && payload.months.length) {
          setMonthOptions(payload.months)
          setSelectedMonth(payload.months[0].value)
        }
      } catch (error) {
        if (active) {
          console.error(error)
        }
      }
    }

    loadMonths()

    return () => {
      active = false
    }
  }, [])

  React.useEffect(() => {
    let active = true
    const controller = new AbortController()

    const load = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/operational?month=${selectedMonth}`, {
          signal: controller.signal,
        })
        if (!response.ok) {
          throw new Error("Failed to load operational data")
        }
        const payload = (await response.json()) as OperationalResponse
        if (active) {
          setData(payload)
        }
      } catch (error) {
        if (active) {
          console.error(error)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    if (selectedMonth) {
      load()
    }

    return () => {
      active = false
      controller.abort()
    }
  }, [selectedMonth])

  const stats: StatCard[] = React.useMemo(() => {
    if (!data) return []
    return [
      {
        id: "transaction-success",
        label: "Transaction Success",
        unit: "transaksi",
        currentTotal: data.cards.success.current,
        previousTotal: data.cards.success.previous,
        series: data.cards.success.series,
      },
      {
        id: "transaction-failed",
        label: "Transaction Failed",
        unit: "transaksi",
        currentTotal: data.cards.failed.current,
        previousTotal: data.cards.failed.previous,
        series: data.cards.failed.series,
      },
    ]
  }, [data])

  if (!data) {
    return (
      <div className="px-4 text-sm text-muted-foreground lg:px-6">
        {loading ? "Memuat data..." : "Tidak ada data"}
      </div>
    )
  }

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
        monthLabel={data.monthLabel}
        previousMonthLabel={data.previousMonthLabel}
        stats={stats}
        className="mx-auto w-full max-w-4xl px-0 sm:grid-cols-2 @xl/main:grid-cols-2 @5xl/main:grid-cols-2"
      />

      <div className="grid gap-6 px-4 lg:px-6">
        <TableCard title="Top Merchant">
          <Table className={tableClassName}>
            <TableHeader className="bg-muted/60 text-muted-foreground">
              <TableRow>
                <TableHead>Nama Merchant</TableHead>
                <TableHead>Uniq Merchant</TableHead>
                <TableHead>Keyword</TableHead>
                <TableHead>Jumlah Transaksi</TableHead>
                <TableHead>Uniq Redeemer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topMerchants.map((row) => (
                <TableRow key={`${row.merchant}-${row.keyword}`}>
                  <TableCell className="font-medium">{row.merchant}</TableCell>
                  <TableCell>{row.uniqMerchant}</TableCell>
                  <TableCell>{row.keyword}</TableCell>
                  <TableCell>{row.totalTransactions}</TableCell>
                  <TableCell>{row.uniqRedeemer}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>

        <TableCard title="Rule Expired Bulan Ini">
          <Table className={tableClassName}>
            <TableHeader className="bg-muted/60 text-muted-foreground">
              <TableRow>
                <TableHead>Nama Merchant</TableHead>
                <TableHead>Keyword</TableHead>
                <TableHead>Mulai</TableHead>
                <TableHead>Berakhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.expiredRules.map((row) => (
                <TableRow key={`${row.merchant}-${row.keyword}-${row.endPeriod}`}>
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
