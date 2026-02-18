import { and, eq, gte, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { factTransaction } from "@/lib/db/schema";
import type {
  MonthRange,
  OperationalRawData,
  OperationalRepository,
} from "@/features/operational/operational.repository";
import { toSqlDate, toSqlTimestamp } from "@/features/shared/month";

const toNumber = (value: unknown) => Number(value ?? 0);
const PRODUCTIVE_THRESHOLD = 5;

export class OperationalRepositoryDrizzle implements OperationalRepository {
  async getOperationalRawData({
    start,
    end,
    previousStart,
    previousEnd,
  }: MonthRange): Promise<OperationalRawData> {
    const startTs = toSqlTimestamp(start);
    const endTs = toSqlTimestamp(end);
    const startDate = toSqlDate(start);
    const endDate = toSqlDate(end);
    const previousStartTs = toSqlTimestamp(previousStart);
    const previousEndTs = toSqlTimestamp(previousEnd);

    const successWhere = and(
      eq(factTransaction.status, "success"),
      gte(factTransaction.transactionAt, startTs),
      lt(factTransaction.transactionAt, endTs)
    );

    const failedWhere = and(
      eq(factTransaction.status, "failed"),
      gte(factTransaction.transactionAt, startTs),
      lt(factTransaction.transactionAt, endTs)
    );

    const prevSuccessWhere = and(
      eq(factTransaction.status, "success"),
      gte(factTransaction.transactionAt, previousStartTs),
      lt(factTransaction.transactionAt, previousEndTs)
    );

    const prevFailedWhere = and(
      eq(factTransaction.status, "failed"),
      gte(factTransaction.transactionAt, previousStartTs),
      lt(factTransaction.transactionAt, previousEndTs)
    );

    const [successSummary] = await db
      .select({ total: sql<number>`count(*)` })
      .from(factTransaction)
      .where(successWhere);

    const [failedSummary] = await db
      .select({ total: sql<number>`count(*)` })
      .from(factTransaction)
      .where(failedWhere);

    const [prevSuccessSummary] = await db
      .select({ total: sql<number>`count(*)` })
      .from(factTransaction)
      .where(prevSuccessWhere);

    const [prevFailedSummary] = await db
      .select({ total: sql<number>`count(*)` })
      .from(factTransaction)
      .where(prevFailedWhere);

    const dailySuccess = await db
      .select({
        date: sql<string>`date(${factTransaction.transactionAt})`,
        value: sql<number>`count(*)`,
      })
      .from(factTransaction)
      .where(successWhere)
      .groupBy(sql`date(${factTransaction.transactionAt})`)
      .orderBy(sql`date(${factTransaction.transactionAt})`);

    const dailyFailed = await db
      .select({
        date: sql<string>`date(${factTransaction.transactionAt})`,
        value: sql<number>`count(*)`,
      })
      .from(factTransaction)
      .where(failedWhere)
      .groupBy(sql`date(${factTransaction.transactionAt})`)
      .orderBy(sql`date(${factTransaction.transactionAt})`);

    const topMerchants = await db.execute(sql`
      select
        dm.merchant_name as merchant,
        dm.keyword_code as keyword,
        count(*)::int as total_transactions,
        dm.uniq_merchant as uniq_merchant,
        count(distinct ft.msisdn)::int as uniq_redeemer
      from fact_transaction ft
      join dim_merchant dm on dm.merchant_key = ft.merchant_key
      where ft.status = 'success'
        and ft.transaction_at >= ${startTs}
        and ft.transaction_at < ${endTs}
      group by dm.merchant_name, dm.keyword_code, dm.uniq_merchant
      order by total_transactions desc
      limit 5
    `);

    const expiredRules = await db.execute(sql`
      select
        dm.merchant_name as merchant,
        dm.keyword_code as keyword,
        dr.start_period as start_period,
        dr.end_period as end_period
      from dim_rule dr
      join dim_merchant dm on dm.merchant_key = dr.rule_merchant
      where dr.end_period >= ${startTs}
        and dr.end_period < ${endTs}
      order by dr.end_period desc
      limit 8
    `);

    const categoryMetrics = await db.execute(sql`
      with active_merchants as (
        select distinct dr.rule_merchant as merchant_key
        from dim_rule dr
        where dr.start_period < ${endDate}
          and dr.end_period >= ${startDate}
      ),
      tx_success as (
        select
          ft.merchant_key as merchant_key,
          ft.msisdn as msisdn,
          (ft.qty * ft.point_redeem)::int as point_value
        from fact_transaction ft
        join active_merchants am on am.merchant_key = ft.merchant_key
        where ft.status = 'success'
          and ft.transaction_at >= ${startTs}
          and ft.transaction_at < ${endTs}
      ),
      productive as (
        select
          dcat.category as category,
          tx.merchant_key as merchant_key
        from tx_success tx
        join dim_merchant dm on dm.merchant_key = tx.merchant_key
        join dim_category dcat on dcat.category_id = dm.category_id
        group by dcat.category, tx.merchant_key
        having count(*) >= ${PRODUCTIVE_THRESHOLD}
      )
      select
        dcat.category as name,
        count(distinct am.merchant_key)::int as total_merchant,
        count(distinct dm.uniq_merchant)::int as unique_merchant,
        coalesce(sum(tx.point_value), 0)::int as total_point,
        count(tx.merchant_key)::int as total_transaksi,
        count(distinct tx.msisdn)::int as unique_redeemer,
        count(distinct tx.merchant_key)::int as merchant_aktif,
        count(distinct productive.merchant_key)::int as merchant_productif
      from active_merchants am
      join dim_merchant dm on dm.merchant_key = am.merchant_key
      join dim_category dcat on dcat.category_id = dm.category_id
      left join tx_success tx on tx.merchant_key = am.merchant_key
      left join productive
        on productive.category = dcat.category
        and productive.merchant_key = am.merchant_key
      group by dcat.category
      order by total_transaksi desc
    `);

    const branchClusterBase = await db.execute(sql`
      with active_merchants as (
        select distinct dr.rule_merchant as merchant_key
        from dim_rule dr
        where dr.start_period < ${endDate}
          and dr.end_period >= ${startDate}
      ),
      tx_success as (
        select
          ft.merchant_key as merchant_key,
          ft.msisdn as msisdn,
          (ft.qty * ft.point_redeem)::int as point_value
        from fact_transaction ft
        join active_merchants am on am.merchant_key = ft.merchant_key
        where ft.status = 'success'
          and ft.transaction_at >= ${startTs}
          and ft.transaction_at < ${endTs}
      ),
      productive as (
        select
          dcl.branch as branch,
          dcl.cluster as cluster,
          tx.merchant_key as merchant_key
        from tx_success tx
        join dim_merchant dm on dm.merchant_key = tx.merchant_key
        join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
        group by dcl.branch, dcl.cluster, tx.merchant_key
        having count(*) >= ${PRODUCTIVE_THRESHOLD}
      )
      select
        dcl.branch as branch,
        dcl.cluster as cluster,
        count(distinct am.merchant_key)::int as total_merchant,
        count(distinct dm.uniq_merchant)::int as unique_merchant,
        coalesce(sum(tx.point_value), 0)::int as total_point,
        count(tx.merchant_key)::int as total_transaksi,
        count(distinct tx.msisdn)::int as unique_redeemer,
        count(distinct tx.merchant_key)::int as merchant_aktif,
        count(distinct productive.merchant_key)::int as merchant_productif
      from active_merchants am
      join dim_merchant dm on dm.merchant_key = am.merchant_key
      join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
      left join tx_success tx on tx.merchant_key = am.merchant_key
      left join productive
        on productive.branch = dcl.branch
        and productive.cluster = dcl.cluster
        and productive.merchant_key = am.merchant_key
      group by dcl.branch, dcl.cluster
      order by dcl.branch, dcl.cluster
    `);

    return {
      successCurrent: toNumber(successSummary?.total),
      failedCurrent: toNumber(failedSummary?.total),
      successPrevious: toNumber(prevSuccessSummary?.total),
      failedPrevious: toNumber(prevFailedSummary?.total),
      dailySuccess: dailySuccess.map((row) => ({
        date: row.date,
        value: toNumber(row.value),
      })),
      dailyFailed: dailyFailed.map((row) => ({
        date: row.date,
        value: toNumber(row.value),
      })),
      topMerchants: (topMerchants.rows as any[]).map((row) => ({
        merchant: row.merchant,
        keyword: row.keyword,
        totalTransactions: toNumber(row.total_transactions),
        uniqMerchant: row.uniq_merchant,
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
      categoryMetrics: (categoryMetrics.rows as Array<Record<string, unknown>>).map((row) => ({
        name: String(row.name ?? ""),
        totalMerchant: toNumber(row.total_merchant),
        uniqueMerchant: toNumber(row.unique_merchant),
        totalPoint: toNumber(row.total_point),
        totalTransaksi: toNumber(row.total_transaksi),
        uniqueRedeemer: toNumber(row.unique_redeemer),
        merchantAktif: toNumber(row.merchant_aktif),
        merchantProduktif: toNumber(row.merchant_productif),
      })),
      branchClusterMetrics: (branchClusterBase.rows as Array<Record<string, unknown>>).map((row) => {
        const branch = String(row.branch ?? "");
        const cluster = String(row.cluster ?? "");
        return {
          branch,
          cluster,
          totalMerchant: toNumber(row.total_merchant),
          uniqueMerchant: toNumber(row.unique_merchant),
          totalPoint: toNumber(row.total_point),
          totalTransaksi: toNumber(row.total_transaksi),
          uniqueRedeemer: toNumber(row.unique_redeemer),
          merchantAktif: toNumber(row.merchant_aktif),
          merchantProduktif: toNumber(row.merchant_productif),
        };
      }),
    };
  }
}
