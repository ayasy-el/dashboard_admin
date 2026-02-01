import { NextResponse } from "next/server"
import { and, eq, gte, lt, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { category, dimUniqMerchant, factTransaction } from "@/lib/db/schema"

const PRODUCTIVE_THRESHOLD = 5

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

  const baseWhere = and(
    eq(factTransaction.status, "success"),
    gte(factTransaction.timestamp, start),
    lt(factTransaction.timestamp, end)
  )

  const previousWhere = and(
    eq(factTransaction.status, "success"),
    gte(factTransaction.timestamp, previousStart),
    lt(factTransaction.timestamp, previousEnd)
  )

  const [summary] = await db
    .select({
      totalTransaksi: sql<number>`count(*)`,
      totalPoint: sql<number>`coalesce(sum(${factTransaction.qty} * ${factTransaction.pointRedeem}), 0)`,
      totalRedeemer: sql<number>`count(distinct ${factTransaction.msisdn})`,
    })
    .from(factTransaction)
    .where(baseWhere)

  const [previousSummary] = await db
    .select({
      totalTransaksi: sql<number>`count(*)`,
      totalPoint: sql<number>`coalesce(sum(${factTransaction.qty} * ${factTransaction.pointRedeem}), 0)`,
      totalRedeemer: sql<number>`count(distinct ${factTransaction.msisdn})`,
    })
    .from(factTransaction)
    .where(previousWhere)

  const dailyPoints = await db
    .select({
      date: sql<string>`date(${factTransaction.timestamp})`,
      value: sql<number>`coalesce(sum(${factTransaction.qty} * ${factTransaction.pointRedeem}), 0)`,
    })
    .from(factTransaction)
    .where(baseWhere)
    .groupBy(sql`date(${factTransaction.timestamp})`)
    .orderBy(sql`date(${factTransaction.timestamp})`)

  const dailyTransactions = await db
    .select({
      date: sql<string>`date(${factTransaction.timestamp})`,
      value: sql<number>`count(*)`,
    })
    .from(factTransaction)
    .where(baseWhere)
    .groupBy(sql`date(${factTransaction.timestamp})`)
    .orderBy(sql`date(${factTransaction.timestamp})`)

  const dailyRedeemer = await db
    .select({
      date: sql<string>`date(${factTransaction.timestamp})`,
      value: sql<number>`count(distinct ${factTransaction.msisdn})`,
    })
    .from(factTransaction)
    .where(baseWhere)
    .groupBy(sql`date(${factTransaction.timestamp})`)
    .orderBy(sql`date(${factTransaction.timestamp})`)

  const rangeStart = addMonths(start, -5)
  const monthlyTransactionsRaw = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${factTransaction.timestamp}), 'YYYY-MM')`,
      value: sql<number>`count(*)`,
    })
    .from(factTransaction)
    .where(
      and(
        eq(factTransaction.status, "success"),
        gte(factTransaction.timestamp, rangeStart),
        lt(factTransaction.timestamp, end)
      )
    )
    .groupBy(sql`date_trunc('month', ${factTransaction.timestamp})`)
    .orderBy(sql`date_trunc('month', ${factTransaction.timestamp})`)

  const monthlyMap = new Map(
    monthlyTransactionsRaw.map((row) => [row.month, toNumber(row.value)])
  )
  const monthlyTransactions = Array.from({ length: 6 }, (_, index) => {
    const date = addMonths(rangeStart, index)
    const monthKey = formatMonth(date)
    return {
      month: monthKey,
      value: monthlyMap.get(monthKey) ?? 0,
    }
  })

  const categoryRaw = await db
    .select({
      name: category.category,
      value: sql<number>`count(*)`,
    })
    .from(factTransaction)
    .innerJoin(
      dimUniqMerchant,
      eq(dimUniqMerchant.uniqMerchantKey, factTransaction.uniqMerchantKey)
    )
    .innerJoin(category, eq(category.categoryId, dimUniqMerchant.categoryId))
    .where(baseWhere)
    .groupBy(category.categoryId, category.category)
    .orderBy(sql`count(*) desc`)

  const totalCategory = categoryRaw.reduce(
    (total, row) => total + toNumber(row.value),
    0
  )
  const categoryBreakdown = categoryRaw.map((row) => ({
    name: row.name,
    value: toNumber(row.value),
    percent: totalCategory ? (toNumber(row.value) / totalCategory) * 100 : 0,
  }))

  const branchClusterRows = await db.execute(sql`
    select
      dum.branch as branch,
      dum.region as region,
      count(distinct ft.merchant_key)::int as total_merchant,
      count(distinct ft.uniq_merchant_key)::int as unique_merchant,
      coalesce(sum(ft.qty * ft.point_redeem), 0)::int as total_point,
      count(*)::int as total_transaksi,
      count(distinct ft.msisdn)::int as unique_redeemer,
      count(distinct ft.uniq_merchant_key)::int as merchant_aktif
    from fact_transaction ft
    join dim_uniq_merchant dum on dum.uniq_merchant_key = ft.uniq_merchant_key
    where ft.status = 'success'
      and ft.timestamp >= ${start}
      and ft.timestamp < ${end}
    group by dum.branch, dum.region
    order by dum.branch, dum.region
  `)

  const produktifRows = await db.execute(sql`
    select branch, region, count(*)::int as merchant_productif
    from (
      select
        dum.branch as branch,
        dum.region as region,
        ft.uniq_merchant_key as uniq_merchant_key,
        count(*)::int as tx_count
      from fact_transaction ft
      join dim_uniq_merchant dum on dum.uniq_merchant_key = ft.uniq_merchant_key
      where ft.status = 'success'
        and ft.timestamp >= ${start}
        and ft.timestamp < ${end}
      group by dum.branch, dum.region, ft.uniq_merchant_key
    ) t
    where t.tx_count >= ${PRODUCTIVE_THRESHOLD}
    group by branch, region
  `)

  const produktifMap = new Map<string, number>()
  for (const row of produktifRows.rows as any[]) {
    produktifMap.set(`${row.branch}||${row.region}`, toNumber(row.merchant_productif))
  }

  const branchMap = new Map<string, any>()
  let branchId = 1
  let clusterId = 1000

  for (const row of branchClusterRows.rows as any[]) {
    const branchName = row.branch
    const regionName = row.region
    if (!branchMap.has(branchName)) {
      branchMap.set(branchName, {
        id: branchId++,
        name: branchName,
        children: [],
      })
    }

    const produktif = produktifMap.get(`${branchName}||${regionName}`) ?? 0
    branchMap.get(branchName).children.push({
      id: clusterId++,
      name: regionName,
      totalMerchant: toNumber(row.total_merchant),
      uniqueMerchant: toNumber(row.unique_merchant),
      totalPoint: toNumber(row.total_point),
      totalTransaksi: toNumber(row.total_transaksi),
      uniqueRedeemer: toNumber(row.unique_redeemer),
      merchantAktif: toNumber(row.merchant_aktif),
      merchantProduktif: produktif,
    })
  }

  const categoryTableRaw = await db.execute(sql`
    select
      c.category as name,
      count(distinct ft.merchant_key)::int as total_merchant,
      count(distinct ft.uniq_merchant_key)::int as unique_merchant,
      coalesce(sum(ft.qty * ft.point_redeem), 0)::int as total_point,
      count(*)::int as total_transaksi,
      count(distinct ft.msisdn)::int as unique_redeemer,
      count(distinct ft.uniq_merchant_key)::int as merchant_aktif
    from fact_transaction ft
    join dim_uniq_merchant dum on dum.uniq_merchant_key = ft.uniq_merchant_key
    join category c on c.category_id = dum.category_id
    where ft.status = 'success'
      and ft.timestamp >= ${start}
      and ft.timestamp < ${end}
    group by c.category
    order by total_transaksi desc
  `)

  const categoryProduktifRaw = await db.execute(sql`
    select category, count(*)::int as merchant_productif
    from (
      select
        c.category as category,
        ft.uniq_merchant_key as uniq_merchant_key,
        count(*)::int as tx_count
      from fact_transaction ft
      join dim_uniq_merchant dum on dum.uniq_merchant_key = ft.uniq_merchant_key
      join category c on c.category_id = dum.category_id
      where ft.status = 'success'
        and ft.timestamp >= ${start}
        and ft.timestamp < ${end}
      group by c.category, ft.uniq_merchant_key
    ) t
    where t.tx_count >= ${PRODUCTIVE_THRESHOLD}
    group by category
  `)

  const categoryProduktifMap = new Map<string, number>()
  for (const row of categoryProduktifRaw.rows as any[]) {
    categoryProduktifMap.set(row.category, toNumber(row.merchant_productif))
  }

  const categoryTable = (categoryTableRaw.rows as any[]).map((row, index) => ({
    id: index + 1,
    name: row.name,
    totalMerchant: toNumber(row.total_merchant),
    uniqueMerchant: toNumber(row.unique_merchant),
    totalPoint: toNumber(row.total_point),
    totalTransaksi: toNumber(row.total_transaksi),
    uniqueRedeemer: toNumber(row.unique_redeemer),
    merchantAktif: toNumber(row.merchant_aktif),
    merchantProduktif: categoryProduktifMap.get(row.name) ?? 0,
  }))

  const totalPoint = toNumber(summary?.totalPoint)
  const totalPointPrev = toNumber(previousSummary?.totalPoint)
  const totalTransaksi = toNumber(summary?.totalTransaksi)
  const totalTransaksiPrev = toNumber(previousSummary?.totalTransaksi)
  const totalRedeemer = toNumber(summary?.totalRedeemer)
  const totalRedeemerPrev = toNumber(previousSummary?.totalRedeemer)

  const totalPoinPelanggan = Math.round(totalPoint * 0.7)
  const totalPoinPelangganPrev = Math.round(totalPointPrev * 0.7)

  const branches = Array.from(branchMap.values()).map((branch) => {
    const children = branch.children ?? []
    const sum = (key: string) =>
      children.reduce((total: number, item: any) => total + toNumber(item[key]), 0)

    return {
      id: branch.id,
      name: branch.name,
      totalMerchant: sum("totalMerchant"),
      uniqueMerchant: sum("uniqueMerchant"),
      totalPoint: sum("totalPoint"),
      totalTransaksi: sum("totalTransaksi"),
      uniqueRedeemer: sum("uniqueRedeemer"),
      merchantAktif: sum("merchantAktif"),
      merchantProduktif: sum("merchantProduktif"),
      children,
    }
  })

  return NextResponse.json({
    month,
    monthLabel: monthLabel(month),
    previousMonth,
    previousMonthLabel: monthLabel(previousMonth),
    cards: {
      totalPoinPelanggan,
      totalTransaksi,
      totalPoin: totalPoint,
      totalRedeemer,
      previous: {
        totalPoinPelanggan: totalPoinPelangganPrev,
        totalTransaksi: totalTransaksiPrev,
        totalPoin: totalPointPrev,
        totalRedeemer: totalRedeemerPrev,
      },
    },
    dailyPoints: dailyPoints.map((row) => ({
      date: row.date,
      value: toNumber(row.value),
    })),
    dailyTransactions: dailyTransactions.map((row) => ({
      date: row.date,
      value: toNumber(row.value),
    })),
    dailyRedeemer: dailyRedeemer.map((row) => ({
      date: row.date,
      value: toNumber(row.value),
    })),
    monthlyTransactions,
    categoryBreakdown,
    branchTable: {
      branches,
    },
    categoryTable,
  })
}
