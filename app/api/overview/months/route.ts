import { NextResponse } from "next/server"
import { eq, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { factTransaction } from "@/lib/db/schema"

const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  })
}

const formatMonth = (date: Date) => {
  const year = date.getUTCFullYear()
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  return `${year}-${month}`
}

const monthToDateUtc = (value: string) => {
  const [year, month] = value.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, 1))
}

export async function GET() {
  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${factTransaction.transactionAt}), 'YYYY-MM')`,
    })
    .from(factTransaction)
    .where(eq(factTransaction.status, "success"))
    .groupBy(sql`date_trunc('month', ${factTransaction.transactionAt})`)
    .orderBy(sql`date_trunc('month', ${factTransaction.transactionAt}) desc`)

  const now = new Date()
  const currentMonth = formatMonth(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)))
  const earliestDataMonth = rows.at(-1)?.month

  const months: { value: string; label: string }[] = []

  if (!earliestDataMonth) {
    months.push({
      value: currentMonth,
      label: monthLabel(currentMonth),
    })
    return NextResponse.json({ months })
  }

  let cursor = monthToDateUtc(currentMonth)
  const min = monthToDateUtc(earliestDataMonth)

  while (cursor >= min) {
    const monthValue = formatMonth(cursor)
    months.push({
      value: monthValue,
      label: monthLabel(monthValue),
    })
    cursor = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() - 1, 1))
  }

  return NextResponse.json({ months })
}
