import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { dimCategory, dimCluster, vwOverviewTransaction } from "@/lib/db/schema";
import type {
  OperationalFilterOptions,
  OperationalFilters,
  MonthRange,
  OperationalRawData,
  OperationalRepository,
} from "@/features/operational/operational.repository";
import { toSqlDate, toSqlTimestamp } from "@/features/shared/month";

const toNumber = (value: unknown) => Number(value ?? 0);
const PRODUCTIVE_THRESHOLD = 5;

const formatDisplayDate = (value: unknown) => {
  const normalized = String(value ?? "");
  if (!normalized) return "";
  return new Date(normalized).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

const toUniqueFilters = (values: string[] | undefined) => {
  const normalized = (values ?? []).map((item) => item.trim()).filter(Boolean);
  return Array.from(new Set(normalized));
};

const inClause = (values: string[]) => sql.join(values.map((value) => sql`${value}`), sql`, `);

export class OperationalRepositoryDrizzle implements OperationalRepository {
  async getOperationalRawData({
    start,
    end,
    previousStart,
    previousEnd,
    categories,
    branches,
  }: MonthRange & OperationalFilters): Promise<OperationalRawData> {
    const startTs = toSqlTimestamp(start);
    const endTs = toSqlTimestamp(end);
    const startDate = toSqlDate(start);
    const endDate = toSqlDate(end);
    const previousStartTs = toSqlTimestamp(previousStart);
    const previousEndTs = toSqlTimestamp(previousEnd);
    const selectedCategories = toUniqueFilters(categories);
    const selectedBranches = toUniqueFilters(branches);
    const hasCategoryFilter = selectedCategories.length > 0;
    const hasBranchFilter = selectedBranches.length > 0;

    const buildTxWhere = (status: "success" | "failed", from: string, to: string) =>
      and(
        eq(vwOverviewTransaction.status, status),
        sql`${vwOverviewTransaction.transactionAt} <@ tsrange(${from}::timestamp, ${to}::timestamp, '[)')`,
        hasCategoryFilter ? inArray(vwOverviewTransaction.category, selectedCategories) : undefined,
        hasBranchFilter ? inArray(vwOverviewTransaction.branch, selectedBranches) : undefined,
      );

    const successWhere = buildTxWhere("success", startTs, endTs);
    const failedWhere = buildTxWhere("failed", startTs, endTs);
    const prevSuccessWhere = buildTxWhere("success", previousStartTs, previousEndTs);
    const prevFailedWhere = buildTxWhere("failed", previousStartTs, previousEndTs);

    const [successSummary] = await db
      .select({ total: sql<number>`count(*)` })
      .from(vwOverviewTransaction)
      .where(successWhere);

    const [failedSummary] = await db
      .select({ total: sql<number>`count(*)` })
      .from(vwOverviewTransaction)
      .where(failedWhere);

    const [prevSuccessSummary] = await db
      .select({ total: sql<number>`count(*)` })
      .from(vwOverviewTransaction)
      .where(prevSuccessWhere);

    const [prevFailedSummary] = await db
      .select({ total: sql<number>`count(*)` })
      .from(vwOverviewTransaction)
      .where(prevFailedWhere);

    const compactSummaryResult = await db.execute(sql`
      with active_merchants as (
        select distinct vr.merchant_key as merchant_key
        from vw_rule_merchant_dim vr
        where vr.period && daterange(${startDate}::date, ${endDate}::date, '[)')
          ${hasCategoryFilter ? sql`and vr.category in (${inClause(selectedCategories)})` : sql``}
          ${hasBranchFilter ? sql`and vr.branch in (${inClause(selectedBranches)})` : sql``}
      ),
      merchant_tx as (
        select
          vm.merchant_key as merchant_key,
          coalesce(sum(vm.tx_count), 0)::int as tx_count
        from vw_merchant_tx_monthly_agg vm
        join active_merchants am on am.merchant_key = vm.merchant_key
        where vm.month_year <@ daterange(${startDate}::date, ${endDate}::date, '[)')
        group by vm.merchant_key
      ),
      expired_merchants as (
        select distinct vr.merchant_key as merchant_key
        from vw_rule_merchant_dim vr
        where upper(vr.period)::date <@ daterange((${startDate}::date + 1), (${endDate}::date + 1), '[)')
          ${hasCategoryFilter ? sql`and vr.category in (${inClause(selectedCategories)})` : sql``}
          ${hasBranchFilter ? sql`and vr.branch in (${inClause(selectedBranches)})` : sql``}
      )
      select
        (select count(*)::int from active_merchants) as total_merchant,
        (select count(*)::int from merchant_tx where tx_count >= 1) as merchant_aktif,
        (select count(*)::int from merchant_tx where tx_count >= ${PRODUCTIVE_THRESHOLD}) as merchant_productif,
        (
          (select count(*)::int from active_merchants) -
          (select count(*)::int from merchant_tx where tx_count >= 1)
        ) as merchant_not_active,
        (select count(*)::int from expired_merchants) as merchant_expired
    `);

    const compactSummary = (compactSummaryResult.rows as Array<Record<string, unknown>>)[0];

    const dailySuccess = await db
      .select({
        date: sql<string>`date(${vwOverviewTransaction.transactionAt})`,
        value: sql<number>`count(*)`,
      })
      .from(vwOverviewTransaction)
      .where(successWhere)
      .groupBy(sql`date(${vwOverviewTransaction.transactionAt})`)
      .orderBy(sql`date(${vwOverviewTransaction.transactionAt})`);

    const dailyFailed = await db
      .select({
        date: sql<string>`date(${vwOverviewTransaction.transactionAt})`,
        value: sql<number>`count(*)`,
      })
      .from(vwOverviewTransaction)
      .where(failedWhere)
      .groupBy(sql`date(${vwOverviewTransaction.transactionAt})`)
      .orderBy(sql`date(${vwOverviewTransaction.transactionAt})`);

    const merchantStatusRows = await db.execute(sql`
      with active_merchants as (
        select
          vr.merchant_key as merchant_key,
          min(lower(vr.period))::date as start_period,
          max((upper(vr.period) - interval '1 day')::date)::date as end_period,
          max(vr.branch) as branch,
          max(vr.merchant_name) as merchant,
          max(vr.keyword_code) as keyword
        from vw_rule_merchant_dim vr
        where vr.period && daterange(${startDate}::date, ${endDate}::date, '[)')
          ${hasCategoryFilter ? sql`and vr.category in (${inClause(selectedCategories)})` : sql``}
          ${hasBranchFilter ? sql`and vr.branch in (${inClause(selectedBranches)})` : sql``}
        group by vr.merchant_key
      ),
      merchant_tx as (
        select
          vt.merchant_key as merchant_key,
          count(*)::int as tx_count,
          count(distinct vt.msisdn)::int as uniq_redeemer
        from vw_overview_transaction vt
        join active_merchants am on am.merchant_key = vt.merchant_key
        where vt.transaction_at <@ tsrange(${startTs}::timestamp, ${endTs}::timestamp, '[)')
        group by vt.merchant_key
      )
      select
        am.branch as branch,
        am.merchant as merchant,
        am.keyword as keyword,
        coalesce(mt.tx_count, 0)::int as tx_count,
        coalesce(mt.uniq_redeemer, 0)::int as uniq_redeemer
      from active_merchants am
      left join merchant_tx mt on mt.merchant_key = am.merchant_key
      order by am.branch, am.merchant
    `);

    const expiredRules = await db.execute(sql`
      select
        vr.branch as branch,
        vr.merchant_name as merchant,
        vr.keyword_code as keyword,
        vr.start_period as start_period,
        vr.end_period as end_period
      from vw_rule_merchant_dim vr
      where upper(vr.period)::date <@ daterange((${startDate}::date + 1), (${endDate}::date + 1), '[)')
        ${hasCategoryFilter ? sql`and vr.category in (${inClause(selectedCategories)})` : sql``}
        ${hasBranchFilter ? sql`and vr.branch in (${inClause(selectedBranches)})` : sql``}
      order by vr.end_period desc
    `);

    const categoryMetrics = await db.execute(sql`
      with active_merchants as (
        select distinct
          vr.merchant_key as merchant_key,
          vr.category as category,
          vr.uniq_merchant as uniq_merchant
        from vw_rule_merchant_dim vr
        where vr.period && daterange(${startDate}::date, ${endDate}::date, '[)')
          ${hasCategoryFilter ? sql`and vr.category in (${inClause(selectedCategories)})` : sql``}
          ${hasBranchFilter ? sql`and vr.branch in (${inClause(selectedBranches)})` : sql``}
      ),
      tx_success as (
        select
          vt.merchant_key as merchant_key,
          vt.category as category,
          vt.msisdn as msisdn,
          vt.total_point::int as point_value
        from vw_overview_transaction vt
        join active_merchants am on am.merchant_key = vt.merchant_key
        where vt.status = 'success'
          and vt.transaction_at <@ tsrange(${startTs}::timestamp, ${endTs}::timestamp, '[)')
      ),
      productive as (
        select
          tx.category as category,
          tx.merchant_key as merchant_key
        from tx_success tx
        group by tx.category, tx.merchant_key
        having count(*) >= ${PRODUCTIVE_THRESHOLD}
      )
      select
        am.category as name,
        count(distinct am.merchant_key)::int as total_merchant,
        count(distinct am.uniq_merchant)::int as unique_merchant,
        coalesce(sum(tx.point_value), 0)::int as total_point,
        count(tx.merchant_key)::int as total_transaksi,
        count(distinct tx.msisdn)::int as unique_redeemer,
        count(distinct tx.merchant_key)::int as merchant_aktif,
        count(distinct productive.merchant_key)::int as merchant_productif
      from active_merchants am
      left join tx_success tx on tx.merchant_key = am.merchant_key
      left join productive
        on productive.category = am.category
        and productive.merchant_key = am.merchant_key
      group by am.category
      order by total_transaksi desc
    `);

    const branchClusterBase = await db.execute(sql`
      with cluster_scope as (
        select
          dcl.cluster_id as cluster_id,
          dcl.branch as branch,
          dcl.cluster as cluster
        from dim_cluster dcl
        where 1 = 1
          ${hasBranchFilter ? sql`and dcl.branch in (${inClause(selectedBranches)})` : sql``}
      ),
      active_merchants as (
        select distinct
          vr.merchant_key as merchant_key,
          vr.cluster_id as cluster_id,
          vr.uniq_merchant as uniq_merchant
        from vw_rule_merchant_dim vr
        where vr.period && daterange(${startDate}::date, ${endDate}::date, '[)')
          ${hasCategoryFilter ? sql`and vr.category in (${inClause(selectedCategories)})` : sql``}
          ${hasBranchFilter ? sql`and vr.branch in (${inClause(selectedBranches)})` : sql``}
      ),
      tx_success as (
        select
          vt.merchant_key as merchant_key,
          vt.cluster_id as cluster_id,
          vt.msisdn as msisdn,
          vt.total_point::int as point_value
        from vw_overview_transaction vt
        join active_merchants am on am.merchant_key = vt.merchant_key
        where vt.status = 'success'
          and vt.transaction_at <@ tsrange(${startTs}::timestamp, ${endTs}::timestamp, '[)')
      ),
      productive as (
        select
          tx.cluster_id as cluster_id,
          tx.merchant_key as merchant_key
        from tx_success tx
        group by tx.cluster_id, tx.merchant_key
        having count(*) >= ${PRODUCTIVE_THRESHOLD}
      )
      select
        cs.branch as branch,
        cs.cluster as cluster,
        count(distinct am.merchant_key)::int as total_merchant,
        count(distinct am.uniq_merchant)::int as unique_merchant,
        coalesce(sum(tx.point_value), 0)::int as total_point,
        count(tx.merchant_key)::int as total_transaksi,
        count(distinct tx.msisdn)::int as unique_redeemer,
        count(distinct tx.merchant_key)::int as merchant_aktif,
        count(distinct productive.merchant_key)::int as merchant_productif
      from cluster_scope cs
      left join active_merchants am on am.cluster_id = cs.cluster_id
      left join tx_success tx on tx.merchant_key = am.merchant_key
      left join productive
        on productive.cluster_id = cs.cluster_id
        and productive.merchant_key = am.merchant_key
      group by cs.branch, cs.cluster
      order by cs.branch, cs.cluster
    `);

    return {
      compactStats: {
        totalMerchant: toNumber(compactSummary?.total_merchant),
        merchantAktif: toNumber(compactSummary?.merchant_aktif),
        merchantProduktif: toNumber(compactSummary?.merchant_productif),
        merchantNotActive: toNumber(compactSummary?.merchant_not_active),
        merchantExpired: toNumber(compactSummary?.merchant_expired),
      },
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
      merchantStatusRows: (merchantStatusRows.rows as Array<Record<string, unknown>>).map((row) => ({
        branch: String(row.branch ?? ""),
        merchant: String(row.merchant ?? ""),
        keyword: String(row.keyword ?? ""),
        transactionCount: toNumber(row.tx_count),
        uniqRedeemer: toNumber(row.uniq_redeemer),
      })),
      expiredRules: (expiredRules.rows as Array<Record<string, unknown>>).map((row) => ({
        branch: String(row.branch ?? ""),
        merchant: String(row.merchant ?? ""),
        keyword: String(row.keyword ?? ""),
        startPeriod: formatDisplayDate(row.start_period),
        endPeriod: formatDisplayDate(row.end_period),
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

  async getOperationalFilterOptions(): Promise<OperationalFilterOptions> {
    const [categoryRows, branchRows] = await Promise.all([
      db
        .selectDistinct({ value: dimCategory.category })
        .from(dimCategory)
        .orderBy(dimCategory.category),
      db
        .selectDistinct({ value: dimCluster.branch })
        .from(dimCluster)
        .orderBy(dimCluster.branch),
    ]);

    return {
      categories: categoryRows.map((row) => row.value),
      branches: branchRows.map((row) => row.value),
    };
  }
}
