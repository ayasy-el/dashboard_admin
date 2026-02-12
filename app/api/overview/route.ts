import { NextResponse } from "next/server"
import { and, eq, gte, lt, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import {
  dimCategory,
  dimCluster,
  dimMerchant,
  factClusterPoint,
  factTransaction,
} from "@/lib/db/schema"

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
    gte(factTransaction.transactionAt, start),
    lt(factTransaction.transactionAt, end)
  )

  const previousWhere = and(
    eq(factTransaction.status, "success"),
    gte(factTransaction.transactionAt, previousStart),
    lt(factTransaction.transactionAt, previousEnd)
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
      date: sql<string>`date(${factTransaction.transactionAt})`,
      value: sql<number>`coalesce(sum(${factTransaction.qty} * ${factTransaction.pointRedeem}), 0)`,
    })
    .from(factTransaction)
    .where(baseWhere)
    .groupBy(sql`date(${factTransaction.transactionAt})`)
    .orderBy(sql`date(${factTransaction.transactionAt})`)

  const dailyTransactions = await db
    .select({
      date: sql<string>`date(${factTransaction.transactionAt})`,
      value: sql<number>`count(*)`,
    })
    .from(factTransaction)
    .where(baseWhere)
    .groupBy(sql`date(${factTransaction.transactionAt})`)
    .orderBy(sql`date(${factTransaction.transactionAt})`)

  const dailyRedeemer = await db
    .select({
      date: sql<string>`date(${factTransaction.transactionAt})`,
      value: sql<number>`count(distinct ${factTransaction.msisdn})`,
    })
    .from(factTransaction)
    .where(baseWhere)
    .groupBy(sql`date(${factTransaction.transactionAt})`)
    .orderBy(sql`date(${factTransaction.transactionAt})`)

  const rangeStart = addMonths(start, -5)
  const monthlyTransactionsRaw = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${factTransaction.transactionAt}), 'YYYY-MM')`,
      value: sql<number>`count(*)`,
    })
    .from(factTransaction)
    .where(
      and(
        eq(factTransaction.status, "success"),
        gte(factTransaction.transactionAt, rangeStart),
        lt(factTransaction.transactionAt, end)
      )
    )
    .groupBy(sql`date_trunc('month', ${factTransaction.transactionAt})`)
    .orderBy(sql`date_trunc('month', ${factTransaction.transactionAt})`)

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
      name: dimCategory.category,
      value: sql<number>`count(*)`,
    })
    .from(factTransaction)
    .innerJoin(
      dimMerchant,
      eq(dimMerchant.merchantKey, factTransaction.merchantKey)
    )
    .innerJoin(dimCategory, eq(dimCategory.categoryId, dimMerchant.categoryId))
    .where(baseWhere)
    .groupBy(dimCategory.categoryId, dimCategory.category)
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
      dc.branch as branch,
      dc.cluster as cluster,
      count(distinct ft.merchant_key)::int as total_merchant,
      count(distinct dm.uniq_merchant)::int as unique_merchant,
      coalesce(sum(ft.qty * ft.point_redeem), 0)::int as total_point,
      count(*)::int as total_transaksi,
      count(distinct ft.msisdn)::int as unique_redeemer,
      count(distinct ft.merchant_key)::int as merchant_aktif
    from fact_transaction ft
    join dim_merchant dm on dm.merchant_key = ft.merchant_key
    join dim_cluster dc on dc.cluster_id = dm.cluster_id
    where ft.status = 'success'
      and ft.transaction_at >= ${start}
      and ft.transaction_at < ${end}
    group by dc.branch, dc.cluster
    order by dc.branch, dc.cluster
  `)

  const produktifRows = await db.execute(sql`
    select branch, cluster, count(*)::int as merchant_productif
    from (
      select
        dc.branch as branch,
        dc.cluster as cluster,
        ft.merchant_key as merchant_key,
        count(*)::int as tx_count
      from fact_transaction ft
      join dim_merchant dm on dm.merchant_key = ft.merchant_key
      join dim_cluster dc on dc.cluster_id = dm.cluster_id
      where ft.status = 'success'
        and ft.transaction_at >= ${start}
        and ft.transaction_at < ${end}
      group by dc.branch, dc.cluster, ft.merchant_key
    ) t
    where t.tx_count >= ${PRODUCTIVE_THRESHOLD}
    group by branch, cluster
  `)

  const produktifMap = new Map<string, number>()
  for (const row of produktifRows.rows as any[]) {
    produktifMap.set(`${row.branch}||${row.cluster}`, toNumber(row.merchant_productif))
  }

  const branchMap = new Map<string, any>()
  let branchId = 1
  let clusterId = 1000

  for (const row of branchClusterRows.rows as any[]) {
    const branchName = row.branch
    const clusterName = row.cluster
    if (!branchMap.has(branchName)) {
      branchMap.set(branchName, {
        id: branchId++,
        name: branchName,
        children: [],
      })
    }

    const produktif = produktifMap.get(`${branchName}||${clusterName}`) ?? 0
    branchMap.get(branchName).children.push({
      id: clusterId++,
      name: clusterName,
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
      dc.category as name,
      count(distinct ft.merchant_key)::int as total_merchant,
      count(distinct dm.uniq_merchant)::int as unique_merchant,
      coalesce(sum(ft.qty * ft.point_redeem), 0)::int as total_point,
      count(*)::int as total_transaksi,
      count(distinct ft.msisdn)::int as unique_redeemer,
      count(distinct ft.merchant_key)::int as merchant_aktif
    from fact_transaction ft
    join dim_merchant dm on dm.merchant_key = ft.merchant_key
    join dim_category dc on dc.category_id = dm.category_id
    where ft.status = 'success'
      and ft.transaction_at >= ${start}
      and ft.transaction_at < ${end}
    group by dc.category
    order by total_transaksi desc
  `)

  const categoryProduktifRaw = await db.execute(sql`
    select category, count(*)::int as merchant_productif
    from (
      select
        dc.category as category,
        ft.merchant_key as merchant_key,
        count(*)::int as tx_count
      from fact_transaction ft
      join dim_merchant dm on dm.merchant_key = ft.merchant_key
      join dim_category dc on dc.category_id = dm.category_id
      where ft.status = 'success'
        and ft.transaction_at >= ${start}
        and ft.transaction_at < ${end}
      group by dc.category, ft.merchant_key
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

  const [clusterPointCurrent] = await db
    .select({
      total: sql<number>`coalesce(sum(${factClusterPoint.totalPoint}), 0)`,
    })
    .from(factClusterPoint)
    .where(eq(factClusterPoint.monthYear, start))

  const [clusterPointPrevious] = await db
    .select({
      total: sql<number>`coalesce(sum(${factClusterPoint.totalPoint}), 0)`,
    })
    .from(factClusterPoint)
    .where(eq(factClusterPoint.monthYear, previousStart))

  const totalPoint = toNumber(summary?.totalPoint)
  const totalPointPrev = toNumber(previousSummary?.totalPoint)
  const totalTransaksi = toNumber(summary?.totalTransaksi)
  const totalTransaksiPrev = toNumber(previousSummary?.totalTransaksi)
  const totalRedeemer = toNumber(summary?.totalRedeemer)
  const totalRedeemerPrev = toNumber(previousSummary?.totalRedeemer)

  const totalPoinPelanggan = toNumber(clusterPointCurrent?.total)
  const totalPoinPelangganPrev = toNumber(clusterPointPrevious?.total)

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
