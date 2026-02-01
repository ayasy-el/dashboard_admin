import { NextResponse } from "next/server"
import { and, eq, gte, lt, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { dimMerchant, dimRule, factTransaction } from "@/lib/db/schema"

const parseMonth = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    const now = new Date()
    const month = String(now.getMonth() + 1).padStart(2, "0")
    return `${now.getFullYear()}-${month}`
  }
  return value
}

const monthToDate = (value: string) => {
  const [year, month] = value.split("-").map(Number)
  return new Date(Date.UTC(year, month - 1, 1))
}

const addMonths = (date: Date, offset: number) => {
  const next = new Date(date)
  next.setUTCMonth(next.getUTCMonth() + offset)
  return next
}

const formatMonth = (date: Date) => {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0")
  return `${date.getUTCFullYear()}-${month}`
}

const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  })
}

const toNumber = (value: unknown) => Number(value ?? 0)

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const month = parseMonth(searchParams.get("month"))
  const start = monthToDate(month)
  const end = addMonths(start, 1)
  const previousStart = addMonths(start, -1)
  const previousEnd = start
  const previousMonth = formatMonth(previousStart)

  const successWhere = and(
    eq(factTransaction.status, "success"),
    gte(factTransaction.transactionAt, start),
    lt(factTransaction.transactionAt, end)
  )

  const failedWhere = and(
    eq(factTransaction.status, "failed"),
    gte(factTransaction.transactionAt, start),
    lt(factTransaction.transactionAt, end)
  )

  const prevSuccessWhere = and(
    eq(factTransaction.status, "success"),
    gte(factTransaction.transactionAt, previousStart),
    lt(factTransaction.transactionAt, previousEnd)
  )

  const prevFailedWhere = and(
    eq(factTransaction.status, "failed"),
    gte(factTransaction.transactionAt, previousStart),
    lt(factTransaction.transactionAt, previousEnd)
  )

  const [successSummary] = await db
    .select({ total: sql<number>`count(*)` })
    .from(factTransaction)
    .where(successWhere)

  const [failedSummary] = await db
    .select({ total: sql<number>`count(*)` })
    .from(factTransaction)
    .where(failedWhere)

  const [prevSuccessSummary] = await db
    .select({ total: sql<number>`count(*)` })
    .from(factTransaction)
    .where(prevSuccessWhere)

  const [prevFailedSummary] = await db
    .select({ total: sql<number>`count(*)` })
    .from(factTransaction)
    .where(prevFailedWhere)

  const dailySuccess = await db
    .select({
      date: sql<string>`date(${factTransaction.transactionAt})`,
      value: sql<number>`count(*)`,
    })
    .from(factTransaction)
    .where(successWhere)
    .groupBy(sql`date(${factTransaction.transactionAt})`)
    .orderBy(sql`date(${factTransaction.transactionAt})`)

  const dailyFailed = await db
    .select({
      date: sql<string>`date(${factTransaction.transactionAt})`,
      value: sql<number>`count(*)`,
    })
    .from(factTransaction)
    .where(failedWhere)
    .groupBy(sql`date(${factTransaction.transactionAt})`)
    .orderBy(sql`date(${factTransaction.transactionAt})`)

  const topMerchants = await db.execute(sql`
    select
      dm.merchant_name as merchant,
      dm.keyword_code as keyword,
      count(*)::int as total_transactions,
      count(distinct dm.uniq_merchant)::int as uniq_merchant,
      count(distinct ft.msisdn)::int as uniq_redeemer
    from fact_transaction ft
    join dim_merchant dm on dm.merchant_key = ft.merchant_key
    where ft.status = 'success'
      and ft.transaction_at >= ${start}
      and ft.transaction_at < ${end}
    group by dm.merchant_name, dm.keyword_code
    order by total_transactions desc
    limit 5
  `)

  const expiredRules = await db.execute(sql`
    select
      dm.merchant_name as merchant,
      dm.keyword_code as keyword,
      dr.start_period as start_period,
      dr.end_period as end_period
    from dim_rule dr
    join dim_merchant dm on dm.merchant_key = dr.rule_merchant
    where dr.end_period >= ${start}
      and dr.end_period < ${end}
    order by dr.end_period desc
    limit 8
  `)

  return NextResponse.json({
    month,
    monthLabel: monthLabel(month),
    previousMonth,
    previousMonthLabel: monthLabel(previousMonth),
    cards: {
      success: {
        current: toNumber(successSummary?.total),
        previous: toNumber(prevSuccessSummary?.total),
        series: dailySuccess.map((row) => ({
          date: row.date,
          value: toNumber(row.value),
        })),
      },
      failed: {
        current: toNumber(failedSummary?.total),
        previous: toNumber(prevFailedSummary?.total),
        series: dailyFailed.map((row) => ({
          date: row.date,
          value: toNumber(row.value),
        })),
      },
    },
    topMerchants: (topMerchants.rows as any[]).map((row) => ({
      merchant: row.merchant,
      keyword: row.keyword,
      totalTransactions: toNumber(row.total_transactions),
      uniqMerchant: toNumber(row.uniq_merchant),
      uniqRedeemer: toNumber(row.uniq_redeemer),
    })),
    expiredRules: (expiredRules.rows as any[]).map((row) => ({
      merchant: row.merchant,
      keyword: row.keyword,
      startPeriod: new Date(row.start_period).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
      endPeriod: new Date(row.end_period).toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }),
    })),
  })
}
