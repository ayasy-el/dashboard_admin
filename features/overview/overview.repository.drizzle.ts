import { and, eq, gte, inArray, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { dimCategory, dimCluster, factClusterPoint, vwOverviewTransaction } from "@/lib/db/schema";
import type {
  MonthRange,
  OverviewFilterOptions,
  OverviewFilters,
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

const toUniqueFilters = (values: string[] | undefined) => {
  const normalized = (values ?? []).map((item) => item.trim()).filter(Boolean);
  return Array.from(new Set(normalized));
};

const inClause = (values: string[]) =>
  sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  );

export class OverviewRepositoryDrizzle implements OverviewRepository {
  async getOverviewRawData({
    start,
    end,
    previousStart,
    previousEnd,
    categories,
    branches,
  }: MonthRange & OverviewFilters): Promise<OverviewRawData> {
    const startTs = toSqlTimestamp(start);
    const endTs = toSqlTimestamp(end);
    const previousStartTs = toSqlTimestamp(previousStart);
    const previousEndTs = toSqlTimestamp(previousEnd);
    const startDate = toSqlDate(start);
    const endDate = toSqlDate(end);
    const previousStartDate = toSqlDate(previousStart);

    const selectedCategories = toUniqueFilters(categories);
    const selectedBranches = toUniqueFilters(branches);
    const hasCategoryFilter = selectedCategories.length > 0;
    const hasBranchFilter = selectedBranches.length > 0;

    const buildSuccessWhere = (from: string, to: string) =>
      and(
        eq(vwOverviewTransaction.status, "success"),
        gte(vwOverviewTransaction.transactionAt, from),
        lt(vwOverviewTransaction.transactionAt, to),
        hasCategoryFilter ? inArray(vwOverviewTransaction.category, selectedCategories) : undefined,
        hasBranchFilter ? inArray(vwOverviewTransaction.branch, selectedBranches) : undefined,
      );

    const clusterScopeSubquery = db
      .selectDistinct({ clusterId: dimCluster.clusterId })
      .from(dimCluster)
      .where(hasBranchFilter ? inArray(dimCluster.branch, selectedBranches) : undefined);

    const baseWhere = buildSuccessWhere(startTs, endTs);
    const previousWhere = buildSuccessWhere(previousStartTs, previousEndTs);

    const [summary] = await db
      .select({
        totalTransaksi: sql<number>`count(*)`,
        totalPoint: sql<number>`coalesce(sum(${vwOverviewTransaction.totalPoint}), 0)`,
        totalRedeemer: sql<number>`count(distinct ${vwOverviewTransaction.msisdn})`,
      })
      .from(vwOverviewTransaction)
      .where(baseWhere);

    const [previousSummary] = await db
      .select({
        totalTransaksi: sql<number>`count(*)`,
        totalPoint: sql<number>`coalesce(sum(${vwOverviewTransaction.totalPoint}), 0)`,
        totalRedeemer: sql<number>`count(distinct ${vwOverviewTransaction.msisdn})`,
      })
      .from(vwOverviewTransaction)
      .where(previousWhere);

    const dailyPoints = await db
      .select({
        date: sql<string>`date(${vwOverviewTransaction.transactionAt})`,
        value: sql<number>`coalesce(sum(${vwOverviewTransaction.totalPoint}), 0)`,
      })
      .from(vwOverviewTransaction)
      .where(baseWhere)
      .groupBy(sql`date(${vwOverviewTransaction.transactionAt})`)
      .orderBy(sql`date(${vwOverviewTransaction.transactionAt})`);

    const dailyTransactions = await db
      .select({
        date: sql<string>`date(${vwOverviewTransaction.transactionAt})`,
        value: sql<number>`count(*)`,
      })
      .from(vwOverviewTransaction)
      .where(baseWhere)
      .groupBy(sql`date(${vwOverviewTransaction.transactionAt})`)
      .orderBy(sql`date(${vwOverviewTransaction.transactionAt})`);

    const dailyRedeemer = await db
      .select({
        date: sql<string>`date(${vwOverviewTransaction.transactionAt})`,
        value: sql<number>`count(distinct ${vwOverviewTransaction.msisdn})`,
      })
      .from(vwOverviewTransaction)
      .where(baseWhere)
      .groupBy(sql`date(${vwOverviewTransaction.transactionAt})`)
      .orderBy(sql`date(${vwOverviewTransaction.transactionAt})`);

    const rangeStart = addMonths(start, -(MONTHLY_WINDOW - 1));
    const monthlyWhere = buildSuccessWhere(toSqlTimestamp(rangeStart), endTs);

    const monthlyTransactionsRaw = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${vwOverviewTransaction.transactionAt}), 'YYYY-MM')`,
        value: sql<number>`count(*)`,
      })
      .from(vwOverviewTransaction)
      .where(monthlyWhere)
      .groupBy(sql`date_trunc('month', ${vwOverviewTransaction.transactionAt})`)
      .orderBy(sql`date_trunc('month', ${vwOverviewTransaction.transactionAt})`);

    const monthlyRedeemerRaw = await db
      .select({
        month: sql<string>`to_char(date_trunc('month', ${vwOverviewTransaction.transactionAt}), 'YYYY-MM')`,
        value: sql<number>`count(distinct ${vwOverviewTransaction.msisdn})`,
      })
      .from(vwOverviewTransaction)
      .where(monthlyWhere)
      .groupBy(sql`date_trunc('month', ${vwOverviewTransaction.transactionAt})`)
      .orderBy(sql`date_trunc('month', ${vwOverviewTransaction.transactionAt})`);

    const categoryRaw = await db
      .select({
        name: vwOverviewTransaction.category,
        value: sql<number>`count(*)`,
      })
      .from(vwOverviewTransaction)
      .where(baseWhere)
      .groupBy(vwOverviewTransaction.category)
      .orderBy(sql`count(*) desc`);

    const topMerchantsRaw = await db.execute(sql`
      select
        vt.merchant_name as merchant,
        vt.category as category,
        vt.branch as branch,
        count(*)::int as redeem
      from vw_overview_transaction vt
      where vt.status = 'success'
        and vt.transaction_at >= ${startTs}
        and vt.transaction_at < ${endTs}
        ${hasCategoryFilter ? sql`and vt.category in (${inClause(selectedCategories)})` : sql``}
        ${hasBranchFilter ? sql`and vt.branch in (${inClause(selectedBranches)})` : sql``}
      group by vt.merchant_name, vt.category, vt.branch
      order by redeem desc, vt.merchant_name
      limit 10
    `);

    const branchClusterRows = await db.execute(sql`
      select
        vt.branch as branch,
        vt.cluster as cluster,
        count(distinct vt.merchant_key)::int as total_merchant,
        count(distinct vt.uniq_merchant)::int as unique_merchant,
        coalesce(sum(vt.total_point), 0)::int as total_point,
        count(*)::int as total_transaksi,
        count(distinct vt.msisdn)::int as unique_redeemer,
        count(distinct vt.merchant_key)::int as merchant_aktif
      from vw_overview_transaction vt
      where vt.status = 'success'
        and vt.transaction_at >= ${startTs}
        and vt.transaction_at < ${endTs}
        ${hasCategoryFilter ? sql`and vt.category in (${inClause(selectedCategories)})` : sql``}
        ${hasBranchFilter ? sql`and vt.branch in (${inClause(selectedBranches)})` : sql``}
      group by vt.branch, vt.cluster
      order by vt.branch, vt.cluster
    `);

    const produktifRows = await db.execute(sql`
      select branch, cluster, count(*)::int as merchant_productif
      from (
        select
          vt.branch as branch,
          vt.cluster as cluster,
          vt.merchant_key as merchant_key,
          count(*)::int as tx_count
        from vw_overview_transaction vt
        where vt.status = 'success'
          and vt.transaction_at >= ${startTs}
          and vt.transaction_at < ${endTs}
          ${hasCategoryFilter ? sql`and vt.category in (${inClause(selectedCategories)})` : sql``}
          ${hasBranchFilter ? sql`and vt.branch in (${inClause(selectedBranches)})` : sql``}
        group by vt.branch, vt.cluster, vt.merchant_key
      ) t
      where t.tx_count >= ${PRODUCTIVE_THRESHOLD}
      group by branch, cluster
    `);

    const categoryTableRaw = await db.execute(sql`
      select
        vt.category as name,
        count(distinct vt.merchant_key)::int as total_merchant,
        count(distinct vt.uniq_merchant)::int as unique_merchant,
        coalesce(sum(vt.total_point), 0)::int as total_point,
        count(*)::int as total_transaksi,
        count(distinct vt.msisdn)::int as unique_redeemer,
        count(distinct vt.merchant_key)::int as merchant_aktif
      from vw_overview_transaction vt
      where vt.status = 'success'
        and vt.transaction_at >= ${startTs}
        and vt.transaction_at < ${endTs}
        ${hasCategoryFilter ? sql`and vt.category in (${inClause(selectedCategories)})` : sql``}
        ${hasBranchFilter ? sql`and vt.branch in (${inClause(selectedBranches)})` : sql``}
      group by vt.category
      order by total_transaksi desc
    `);

    const categoryProduktifRaw = await db.execute(sql`
      select category, count(*)::int as merchant_productif
      from (
        select
          vt.category as category,
          vt.merchant_key as merchant_key,
          count(*)::int as tx_count
        from vw_overview_transaction vt
        where vt.status = 'success'
          and vt.transaction_at >= ${startTs}
          and vt.transaction_at < ${endTs}
          ${hasCategoryFilter ? sql`and vt.category in (${inClause(selectedCategories)})` : sql``}
          ${hasBranchFilter ? sql`and vt.branch in (${inClause(selectedBranches)})` : sql``}
        group by vt.category, vt.merchant_key
      ) t
      where t.tx_count >= ${PRODUCTIVE_THRESHOLD}
      group by category
    `);

    const notActiveMerchantRaw = await db.execute(sql`
      with tx as (
        select
          vm.merchant_key as merchant_key,
          coalesce(sum(vm.success_tx_count), 0)::int as trx_count
        from vw_merchant_tx_monthly_agg vm
        where vm.month_year >= ${startDate}::date
          and vm.month_year < ${endDate}::date
        group by vm.merchant_key
      )
      select
        vr.branch as branch,
        vr.merchant_name as merchant,
        vr.keyword_code as keyword
      from vw_rule_merchant_dim vr
      left join tx on tx.merchant_key = vr.merchant_key
      where vr.period && daterange(${startDate}::date, ${endDate}::date, '[)')
        and coalesce(tx.trx_count, 0) = 0
        ${hasCategoryFilter ? sql`and vr.category in (${inClause(selectedCategories)})` : sql``}
        ${hasBranchFilter ? sql`and vr.branch in (${inClause(selectedBranches)})` : sql``}
      order by vr.branch, vr.merchant_name
    `);

    const merchantPerMonthRaw = await db.execute(sql`
      with tx as (
        select
          vt.merchant_key,
          count(*)::int as redeem,
          count(distinct vt.msisdn)::int as unique_redeem
        from vw_overview_transaction vt
        where vt.status = 'success'
          and vt.transaction_at >= ${startTs}::timestamp
          and vt.transaction_at <  ${endTs}::timestamp
        group by vt.merchant_key
      ),
      active_rule as (
        select
          vr.merchant_key,
          min(vr.start_period)::date as start_period,
          max(vr.end_period)::date as end_period,
          max(vr.point_redeem)::int as point,

          min(vr.category) as category,
          min(vr.branch) as branch,
          min(vr.merchant_name) as merchant_name,
          min(vr.keyword_code) as keyword_code
        from vw_rule_merchant_dim vr
        where vr.period && daterange(${startDate}::date, ${endDate}::date, '[)')
          ${hasCategoryFilter ? sql`and vr.category in (${inClause(selectedCategories)})` : sql``}
          ${hasBranchFilter ? sql`and vr.branch in (${inClause(selectedBranches)})` : sql``}
        group by vr.merchant_key
      )
      select
        ar.category as category,
        ar.branch as branch,
        ar.merchant_name as merchant,
        ar.keyword_code as keyword,
        ar.start_period as start_period,
        ar.end_period as end_period,
        ar.point as point,
        coalesce(tx.redeem, 0)::int as redeem,
        coalesce(tx.unique_redeem, 0)::int as unique_redeem
      from active_rule ar
      left join tx on tx.merchant_key = ar.merchant_key
      order by redeem desc, unique_redeem desc, ar.merchant_name
    `);

    const expiredMerchantRaw = await db.execute(sql`
      select
        vr.branch as branch,
        vr.merchant_name as merchant,
        vr.keyword_code as keyword
      from vw_rule_merchant_dim vr
      where upper(vr.period) > ${startDate}::date
        and upper(vr.period) <= ${endDate}::date
        ${hasCategoryFilter ? sql`and vr.category in (${inClause(selectedCategories)})` : sql``}
        ${hasBranchFilter ? sql`and vr.branch in (${inClause(selectedBranches)})` : sql``}
      order by vr.end_period, vr.branch, vr.merchant_name
    `);

    const [clusterPointCurrent] = await db
      .select({
        total: sql<number>`coalesce(sum(${factClusterPoint.totalPoint}), 0)`,
      })
      .from(factClusterPoint)
      .where(
        and(
          eq(factClusterPoint.monthYear, startDate),
          hasBranchFilter ? inArray(factClusterPoint.clusterId, clusterScopeSubquery) : undefined,
        ),
      );

    const [clusterPointPrevious] = await db
      .select({
        total: sql<number>`coalesce(sum(${factClusterPoint.totalPoint}), 0)`,
      })
      .from(factClusterPoint)
      .where(
        and(
          eq(factClusterPoint.monthYear, previousStartDate),
          hasBranchFilter ? inArray(factClusterPoint.clusterId, clusterScopeSubquery) : undefined,
        ),
      );

    const summaryTotalPoint = toNumber(summary?.totalPoint);
    const previousSummaryTotalPoint = toNumber(previousSummary?.totalPoint);

    return {
      summary: {
        totalTransaksi: toNumber(summary?.totalTransaksi),
        totalPoint: summaryTotalPoint,
        totalRedeemer: toNumber(summary?.totalRedeemer),
      },
      previousSummary: {
        totalTransaksi: toNumber(previousSummary?.totalTransaksi),
        totalPoint: previousSummaryTotalPoint,
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
      monthlyRedeemerRaw: monthlyRedeemerRaw.map((row) => ({
        month: row.month,
        value: toNumber(row.value),
      })),
      categoryRaw: categoryRaw.map((row) => ({
        name: String(row.name ?? ""),
        value: toNumber(row.value),
      })),
      topMerchantsRaw: (topMerchantsRaw.rows as Array<Record<string, unknown>>).map((row) => ({
        merchant: String(row.merchant ?? ""),
        category: String(row.category ?? ""),
        branch: String(row.branch ?? ""),
        redeem: toNumber(row.redeem),
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
      categoryProduktifRaw: (categoryProduktifRaw.rows as Array<Record<string, unknown>>).map(
        (row) => ({
          category: String(row.category ?? ""),
          merchant_productif: toNumber(row.merchant_productif),
        }),
      ),
      notActiveMerchantRaw: (notActiveMerchantRaw.rows as Array<Record<string, unknown>>).map(
        (row) => ({
          branch: String(row.branch ?? ""),
          merchant: String(row.merchant ?? ""),
          keyword: String(row.keyword ?? ""),
        }),
      ),
      merchantPerMonthRaw: (merchantPerMonthRaw.rows as Array<Record<string, unknown>>).map(
        (row) => ({
          category: String(row.category ?? ""),
          branch: String(row.branch ?? ""),
          merchant: String(row.merchant ?? ""),
          keyword: String(row.keyword ?? ""),
          startPeriod: String(row.start_period ?? ""),
          endPeriod: String(row.end_period ?? ""),
          point: toNumber(row.point),
          redeem: toNumber(row.redeem),
          uniqueRedeem: toNumber(row.unique_redeem),
        }),
      ),
      expiredMerchantRaw: (expiredMerchantRaw.rows as Array<Record<string, unknown>>).map(
        (row) => ({
          branch: String(row.branch ?? ""),
          merchant: String(row.merchant ?? ""),
          keyword: String(row.keyword ?? ""),
        }),
      ),
      clusterPointCurrent: toNumber(clusterPointCurrent?.total),
      clusterPointPrevious: toNumber(clusterPointPrevious?.total),
    };
  }

  async getOverviewFilterOptions(): Promise<OverviewFilterOptions> {
    const [categoryRows, branchRows] = await Promise.all([
      db
        .selectDistinct({ value: dimCategory.category })
        .from(dimCategory)
        .orderBy(dimCategory.category),
      db.selectDistinct({ value: dimCluster.branch }).from(dimCluster).orderBy(dimCluster.branch),
    ]);

    return {
      categories: categoryRows.map((row) => row.value),
      branches: branchRows.map((row) => row.value),
    };
  }
}
