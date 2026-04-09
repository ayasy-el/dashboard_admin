import { sql } from "drizzle-orm";

import type {
  MerchantDetailMonthRange,
  MerchantDetailRawData,
  MerchantDetailRepository,
} from "@/features/merchant-detail/merchant-detail.repository";
import { toSqlDate, toSqlTimestamp } from "@/features/shared/month";
import { db } from "@/lib/db";

const toInt = (value: unknown) => Number(value ?? 0);

export class MerchantDetailRepositoryDrizzle implements MerchantDetailRepository {
  async getMerchantDetailRawData(
    keyword: string,
    { start, end, previousStart, previousEnd }: MerchantDetailMonthRange,
  ): Promise<MerchantDetailRawData> {
    const startTs = toSqlTimestamp(start);
    const endTs = toSqlTimestamp(end);
    const previousStartTs = toSqlTimestamp(previousStart);
    const previousEndTs = toSqlTimestamp(previousEnd);
    const yearStart = new Date(Date.UTC(start.getUTCFullYear(), 0, 1));
    const yearEnd = new Date(Date.UTC(start.getUTCFullYear() + 1, 0, 1));
    const monthStartDate = toSqlDate(start);
    const monthEndDate = toSqlDate(end);

    const identityRows = await db.execute(sql`
      select
        dm.keyword_code as keyword,
        dm.merchant_name as merchant,
        dm.uniq_merchant as uniq_merchant,
        dcat.category as category,
        dcl.branch as branch,
        dcl.cluster as cluster,
        dcl.region as region
      from dim_merchant dm
      join dim_category dcat on dcat.category_id = dm.category_id
      join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
      where dm.keyword_code = ${keyword}
      limit 1
    `);
    const identityRow = identityRows.rows[0];

    if (!identityRow) {
      return {
        identity: null,
        currentSummary: { totalTransactions: 0, uniqueRedeemer: 0, totalPoint: 0 },
        previousSummary: { totalTransactions: 0, uniqueRedeemer: 0, totalPoint: 0 },
        monthlyPerformance: [],
        keywordComposition: [],
        dailyTrend: [],
        ruleStatuses: [],
        transactions: [],
      };
    }

    const uniqMerchant = String(identityRow.uniq_merchant ?? "");
    const today = new Date().toISOString().slice(0, 10);

    const [currentSummaryRows, previousSummaryRows, monthlyPerformanceRows, keywordCompositionRows, dailyTrendRows] =
      await Promise.all([
        db.execute(sql`
          select
            count(*)::int as total_transactions,
            count(distinct vt.msisdn)::int as unique_redeemer,
            coalesce(sum(vt.total_point), 0)::int as total_point
          from vw_overview_transaction vt
          where vt.status = 'success'
            and vt.uniq_merchant = ${uniqMerchant}
            and vt.transaction_at >= ${startTs}
            and vt.transaction_at < ${endTs}
        `),
        db.execute(sql`
          select
            count(*)::int as total_transactions,
            count(distinct vt.msisdn)::int as unique_redeemer,
            coalesce(sum(vt.total_point), 0)::int as total_point
          from vw_overview_transaction vt
          where vt.status = 'success'
            and vt.uniq_merchant = ${uniqMerchant}
            and vt.transaction_at >= ${previousStartTs}
            and vt.transaction_at < ${previousEndTs}
        `),
        db.execute(sql`
          select
            to_char(date_trunc('month', vt.transaction_at), 'YYYY-MM') as month,
            count(*)::int as redeem,
            count(distinct vt.msisdn)::int as unique_redeem
          from vw_overview_transaction vt
          where vt.status = 'success'
            and vt.uniq_merchant = ${uniqMerchant}
            and vt.transaction_at >= ${toSqlTimestamp(yearStart)}
            and vt.transaction_at < ${toSqlTimestamp(yearEnd)}
          group by date_trunc('month', vt.transaction_at)
          order by date_trunc('month', vt.transaction_at)
        `),
        db.execute(sql`
          select
            vt.keyword_code as keyword,
            count(*)::int as redeem
          from vw_overview_transaction vt
          where vt.status = 'success'
            and vt.uniq_merchant = ${uniqMerchant}
            and vt.transaction_at >= ${startTs}
            and vt.transaction_at < ${endTs}
          group by vt.keyword_code
          order by redeem desc, vt.keyword_code
        `),
        db.execute(sql`
          select
            date(vt.transaction_at)::text as date,
            count(*)::int as redeem,
            count(distinct vt.msisdn)::int as unique_redeemer,
            coalesce(sum(vt.total_point), 0)::int as total_point
          from vw_overview_transaction vt
          where vt.status = 'success'
            and vt.uniq_merchant = ${uniqMerchant}
            and vt.transaction_at >= ${startTs}
            and vt.transaction_at < ${endTs}
          group by date(vt.transaction_at)
          order by date(vt.transaction_at)
        `),
      ]);

    const [ruleStatusesRows, transactionsRows] = await Promise.all([
      db.execute(sql`
        select distinct on (vr.keyword_code)
          vr.keyword_code as keyword,
          case
            when vr.end_period < ${today}::date then 'expired'
            when vr.start_period > ${today}::date then 'scheduled'
            else 'active'
          end as status,
          vr.start_period::text as start_period,
          vr.end_period::text as end_period,
          greatest((vr.end_period - ${today}::date), 0)::int as days_left
        from vw_rule_merchant_dim vr
        where vr.uniq_merchant = ${uniqMerchant}
          and vr.period && daterange(${monthStartDate}::date, ${monthEndDate}::date, '[)')
        order by vr.keyword_code, vr.end_period desc, vr.start_period desc
      `),
      db.execute(sql`
        select
          vt.transaction_at::text as transaction_at,
          vt.keyword_code as keyword,
          vt.status::text as status,
          vt.qty::int as qty,
          vt.total_point::int as total_point,
          vt.branch as branch
        from vw_overview_transaction vt
        where vt.uniq_merchant = ${uniqMerchant}
          and vt.transaction_at >= ${startTs}
          and vt.transaction_at < ${endTs}
        order by vt.transaction_at desc
      `),
    ]);

    const currentRow = currentSummaryRows.rows[0];
    const previousRow = previousSummaryRows.rows[0];

    return {
      identity: {
        keyword: String(identityRow.keyword ?? ""),
        merchant: String(identityRow.merchant ?? ""),
        uniqMerchant,
        category: String(identityRow.category ?? ""),
        branch: String(identityRow.branch ?? ""),
        cluster: String(identityRow.cluster ?? ""),
        region: String(identityRow.region ?? ""),
      },
      currentSummary: {
        totalTransactions: toInt(currentRow?.total_transactions),
        uniqueRedeemer: toInt(currentRow?.unique_redeemer),
        totalPoint: toInt(currentRow?.total_point),
      },
      previousSummary: {
        totalTransactions: toInt(previousRow?.total_transactions),
        uniqueRedeemer: toInt(previousRow?.unique_redeemer),
        totalPoint: toInt(previousRow?.total_point),
      },
      monthlyPerformance: monthlyPerformanceRows.rows.map((row) => ({
        month: String(row.month ?? ""),
        redeem: toInt(row.redeem),
        uniqueRedeem: toInt(row.unique_redeem),
      })),
      keywordComposition: keywordCompositionRows.rows.map((row) => ({
        keyword: String(row.keyword ?? ""),
        redeem: toInt(row.redeem),
      })),
      dailyTrend: dailyTrendRows.rows.map((row) => ({
        date: String(row.date ?? ""),
        redeem: toInt(row.redeem),
        uniqueRedeemer: toInt(row.unique_redeemer),
        totalPoint: toInt(row.total_point),
      })),
      ruleStatuses: ruleStatusesRows.rows.map((row) => ({
        keyword: String(row.keyword ?? ""),
        status: String(row.status ?? ""),
        startPeriod: String(row.start_period ?? ""),
        endPeriod: String(row.end_period ?? ""),
        daysLeft: toInt(row.days_left),
      })),
      transactions: transactionsRows.rows.map((row) => ({
        transactionAt: String(row.transaction_at ?? ""),
        keyword: String(row.keyword ?? ""),
        status: String(row.status ?? ""),
        qty: toInt(row.qty),
        totalPoint: toInt(row.total_point),
        branch: String(row.branch ?? ""),
      })),
    };
  }
}
