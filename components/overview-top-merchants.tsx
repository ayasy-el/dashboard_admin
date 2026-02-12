"use client"

import * as React from "react"

import { TableCard } from "@/components/table-card"
import { Badge } from "@/components/ui/badge"
import { formatNumber } from "@/lib/dashboard-metrics"

type TopMerchantRow = {
  merchant: string
  category: string
  branch: string
  keyword: string
  redeem: number
}

type TopMerchantRedeemTableProps = {
  data: TopMerchantRow[]
  loading?: boolean
}

export function TopMerchantRedeemTable({ data, loading = false }: TopMerchantRedeemTableProps) {
  const items = data.slice(0, 5)
  const rankEmoji = ["🥇", "🥈", "🥉"]

  return (
    <TableCard
      title="Top Merchant Redeem"
      description="Nama merchant dan kategori teratas"
      headerClassName="[&_div[data-slot=card-title]]:text-lg [&_div[data-slot=card-description]]:text-base"
      contentClassName="px-6 py-4"
    >
      {loading ? (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Memuat data merchant...
        </div>
      ) : items.length ? (
        <div className="grid gap-3">
          {items.map((row, index) => (
            <div
              key={`${row.merchant}-${row.keyword}`}
              className="flex items-center justify-between rounded-xl border bg-muted/20 px-4 py-3"
            >
              <div className="flex items-center gap-3">
                <Badge
                  variant="secondary"
                  className="h-9 w-9 justify-center rounded-full p-0 text-lg"
                >
                  {rankEmoji[index] ?? `${index + 1}`}
                </Badge>
                <div>
                  <div className="text-base font-semibold">{row.merchant}</div>
                  <div className="text-[15px] text-muted-foreground">{row.category}</div>
                </div>
              </div>
              <div className="text-[15px] text-muted-foreground">
                {formatNumber(row.redeem)} trx
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Tidak ada data merchant.
        </div>
      )}
    </TableCard>
  )
}
