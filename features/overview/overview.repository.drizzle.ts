import { and, eq, gte, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import {
  dimCategory,
  dimMerchant,
  factClusterPoint,
  factTransaction,
} from "@/lib/db/schema";
import type {
  MonthRange,
  OverviewRawData,
  OverviewRepository,
} from "@/features/overview/overview.repository";
import { toSqlDate, toSqlTimestamp } from "@/features/shared/month";

const PRODUCTIVE_THRESHOLD = 5;
const MONTHLY_WINDOW = 12;

const addMonths = (date: Date, offset: number) => {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + offset);
  return next;
};

const toNumber = (value: unknown) => Number(value ?? 0);

export class OverviewRepositoryDrizzle implements OverviewRepository {
  async getOverviewRawData({
    start,
    end,
    previousStart,
    previousEnd,
  }: MonthRange): Promise<OverviewRawData> {
    const startTs = toSqlTimestamp(start);
    const endTs = toSqlTimestamp(end);
    const previousStartTs = toSqlTimestamp(previousStart);
    const previousEndTs = toSqlTimestamp(previousEnd);
    const startDate = toSqlDate(start);
    const endDate = toSqlDate(end);
    const previousStartDate = toSqlDate(previousStart);

    const baseWhere = and(
      eq(factTransaction.status, "success"),
      gte(factTransaction.transactionAt, startTs),
      lt(factTransaction.transactionAt, endTs)
    );

    const previousWhere = and(
      eq(factTransaction.status, "success"),
      gte(factTransaction.transactionAt, previousStartTs),
      lt(factTransaction.transactionAt, previousEndTs)
    );

    const [summary] = await db
      .select({
        totalTransaksi: sql<number>`count(*)`,
        totalPoint: sql<number>`coalesce(sum(${factTransaction.qty} * ${factTransaction.pointRedeem}), 0)`,
        totalRedeemer: sql<number>`count(distinct ${factTransaction.msisdn})`,
      })
      .from(factTransaction)
      .where(baseWhere);

    const [previousSummary] = await db
      .select({
        totalTransaksi: sql<number>`count(*)`,
        totalPoint: sql<number>`coalesce(sum(${factTransaction.qty} * ${factTransaction.pointRedeem}), 0)`,
        totalRedeemer: sql<number>`count(distinct ${factTransaction.msisdn})`,
      })
      .from(factTransaction)
      .where(previousWhere);

    const dailyPoints = await db
      .select({
        date: sql<string>`date(${factTransaction.transactionAt})`,
        value: sql<number>`coalesce(sum(${factTransaction.qty} * ${factTransaction.pointRedeem}), 0)`,
      })
      .from(factTransaction)
      .where(baseWhere)
      .groupBy(sql`date(${factTransaction.transactionAt})`)
      .orderBy(sql`date(${factTransaction.transactionAt})`);

    const dailyTransactions = await db
      .select({
        date: sql<string>`date(${factTransaction.transactionAt})`,
        value: sql<number>`count(*)`,
      })
      .from(factTransaction)
      .where(baseWhere)
      .groupBy(sql`date(${factTransaction.transactionAt})`)
      .orderBy(sql`date(${factTransaction.transactionAt})`);

    const dailyRedeemer = await db
      .select({
        date: sql<string>`date(${factTransaction.transactionAt})`,
        value: sql<number>`count(distinct ${factTransaction.msisdn})`,
      })
      .from(factTransaction)
      .where(baseWhere)
      .groupBy(sql`date(${factTransaction.transactionAt})`)
      .orderBy(sql`date(${factTransaction.transactionAt})`);

    const rangeStart = addMonths(start, -(MONTHLY_WINDOW - 1));
    const monthlyTransactionsRaw = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${factTransaction.transactionAt}), 'YYYY-MM')`,
        value: sql<number>`count(*)`,
      })
      .from(factTransaction)
      .where(
        and(
          eq(factTransaction.status, "success"),
          gte(factTransaction.transactionAt, toSqlTimestamp(rangeStart)),
          lt(factTransaction.transactionAt, endTs)
        )
      )
      .groupBy(sql`date_trunc('month', ${factTransaction.transactionAt})`)
      .orderBy(sql`date_trunc('month', ${factTransaction.transactionAt})`);

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
      .orderBy(sql`count(*) desc`);

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
        and ft.transaction_at >= ${startTs}
        and ft.transaction_at < ${endTs}
      group by dc.branch, dc.cluster
      order by dc.branch, dc.cluster
    `);

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
          and ft.transaction_at >= ${startTs}
          and ft.transaction_at < ${endTs}
        group by dc.branch, dc.cluster, ft.merchant_key
      ) t
      where t.tx_count >= ${PRODUCTIVE_THRESHOLD}
      group by branch, cluster
    `);

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
        and ft.transaction_at >= ${startTs}
        and ft.transaction_at < ${endTs}
      group by dc.category
      order by total_transaksi desc
    `);

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
          and ft.transaction_at >= ${startTs}
          and ft.transaction_at < ${endTs}
        group by dc.category, ft.merchant_key
      ) t
      where t.tx_count >= ${PRODUCTIVE_THRESHOLD}
      group by category
    `);

    const notActiveMerchantRaw = await db.execute(sql`
      with tx as (
        select
          ft.merchant_key as merchant_key,
          count(*)::int as trx_count
        from fact_transaction ft
        where ft.status = 'success'
          and ft.transaction_at >= ${startTs}
          and ft.transaction_at < ${endTs}
        group by ft.merchant_key
      )
      select
        dc.branch as branch,
        dm.merchant_name as merchant,
        dm.keyword_code as keyword
      from dim_rule dr
      join dim_merchant dm on dm.merchant_key = dr.rule_merchant
      join dim_cluster dc on dc.cluster_id = dm.cluster_id
      left join tx on tx.merchant_key = dm.merchant_key
      where dr.start_period < ${endDate}
        and dr.end_period >= ${startDate}
        and coalesce(tx.trx_count, 0) = 0
      order by dc.branch, dm.merchant_name
    `);

    const merchantPerMonthRaw = await db.execute(sql`
      with tx as (
        select
          ft.merchant_key as merchant_key,
          count(*)::int as redeem,
          count(distinct ft.msisdn)::int as unique_redeem
        from fact_transaction ft
        where ft.status = 'success'
          and ft.transaction_at >= ${startTs}
          and ft.transaction_at < ${endTs}
        group by ft.merchant_key
      ),
      active_rule as (
        select
          dr.rule_merchant as merchant_key,
          min(dr.start_period)::date as start_period,
          max(dr.end_period)::date as end_period,
          max(dr.point_redeem)::int as point
        from dim_rule dr
        where dr.start_period < ${endDate}
          and dr.end_period >= ${startDate}
        group by dr.rule_merchant
      )
      select
        dc.category as category,
        dcl.branch as branch,
        dm.merchant_name as merchant,
        dm.keyword_code as keyword,
        ar.start_period as start_period,
        ar.end_period as end_period,
        ar.point as point,
        coalesce(tx.redeem, 0)::int as redeem,
        coalesce(tx.unique_redeem, 0)::int as unique_redeem
      from active_rule ar
      join dim_merchant dm on dm.merchant_key = ar.merchant_key
      join dim_category dc on dc.category_id = dm.category_id
      join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
      left join tx on tx.merchant_key = dm.merchant_key
      order by redeem desc, unique_redeem desc, dm.merchant_name
      limit 200
    `);

    const [clusterPointCurrent] = await db
      .select({
        total: sql<number>`coalesce(sum(${factClusterPoint.totalPoint}), 0)`,
      })
      .from(factClusterPoint)
      .where(eq(factClusterPoint.monthYear, startDate));

    const [clusterPointPrevious] = await db
      .select({
        total: sql<number>`coalesce(sum(${factClusterPoint.totalPoint}), 0)`,
      })
      .from(factClusterPoint)
      .where(eq(factClusterPoint.monthYear, previousStartDate));

    return {
      summary: {
        totalTransaksi: toNumber(summary?.totalTransaksi),
        totalPoint: toNumber(summary?.totalPoint),
        totalRedeemer: toNumber(summary?.totalRedeemer),
      },
      previousSummary: {
        totalTransaksi: toNumber(previousSummary?.totalTransaksi),
        totalPoint: toNumber(previousSummary?.totalPoint),
        totalRedeemer: toNumber(previousSummary?.totalRedeemer),
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
      monthlyTransactionsRaw: monthlyTransactionsRaw.map((row) => ({
        month: row.month,
        value: toNumber(row.value),
      })),
      categoryRaw: categoryRaw.map((row) => ({
        name: row.name,
        value: toNumber(row.value),
      })),
      branchClusterRows: (branchClusterRows.rows as Array<Record<string, unknown>>).map((row) => ({
        branch: String(row.branch ?? ""),
        cluster: String(row.cluster ?? ""),
        total_merchant: toNumber(row.total_merchant),
        unique_merchant: toNumber(row.unique_merchant),
        total_point: toNumber(row.total_point),
        total_transaksi: toNumber(row.total_transaksi),
        unique_redeemer: toNumber(row.unique_redeemer),
        merchant_aktif: toNumber(row.merchant_aktif),
      })),
      produktifRows: (produktifRows.rows as Array<Record<string, unknown>>).map((row) => ({
        branch: String(row.branch ?? ""),
        cluster: String(row.cluster ?? ""),
        merchant_productif: toNumber(row.merchant_productif),
      })),
      categoryTableRaw: (categoryTableRaw.rows as Array<Record<string, unknown>>).map((row) => ({
        name: String(row.name ?? ""),
        total_merchant: toNumber(row.total_merchant),
        unique_merchant: toNumber(row.unique_merchant),
        total_point: toNumber(row.total_point),
        total_transaksi: toNumber(row.total_transaksi),
        unique_redeemer: toNumber(row.unique_redeemer),
        merchant_aktif: toNumber(row.merchant_aktif),
      })),
      categoryProduktifRaw: (categoryProduktifRaw.rows as Array<Record<string, unknown>>).map((row) => ({
        category: String(row.category ?? ""),
        merchant_productif: toNumber(row.merchant_productif),
      })),
      notActiveMerchantRaw: (notActiveMerchantRaw.rows as Array<Record<string, unknown>>).map((row) => ({
        branch: String(row.branch ?? ""),
        merchant: String(row.merchant ?? ""),
        keyword: String(row.keyword ?? ""),
      })),
      merchantPerMonthRaw: (merchantPerMonthRaw.rows as Array<Record<string, unknown>>).map((row) => ({
        category: String(row.category ?? ""),
        branch: String(row.branch ?? ""),
        merchant: String(row.merchant ?? ""),
        keyword: String(row.keyword ?? ""),
        startPeriod: String(row.start_period ?? ""),
        endPeriod: String(row.end_period ?? ""),
        point: toNumber(row.point),
        redeem: toNumber(row.redeem),
        uniqueRedeem: toNumber(row.unique_redeem),
      })),
      clusterPointCurrent: toNumber(clusterPointCurrent?.total),
      clusterPointPrevious: toNumber(clusterPointPrevious?.total),
    };
  }
}
