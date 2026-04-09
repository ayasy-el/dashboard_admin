import { sql } from "drizzle-orm";

import type {
  MerchantDirectoryRawData,
  MerchantDirectoryRepository,
  MerchantDirectoryMonthRange,
} from "@/features/merchant/merchant-directory.repository";
import { toSqlDate, toSqlTimestamp } from "@/features/shared/month";
import { db } from "@/lib/db";

const PRODUCTIVE_THRESHOLD = 5;
const toInt = (value: unknown) => Number(value ?? 0);

export class MerchantDirectoryRepositoryDrizzle implements MerchantDirectoryRepository {
  async getMerchantDirectoryRawData({
    start,
    end,
  }: MerchantDirectoryMonthRange): Promise<MerchantDirectoryRawData> {
    const startTs = toSqlTimestamp(start);
    const endTs = toSqlTimestamp(end);
    const monthStartDate = toSqlDate(start);
    const monthEndDate = toSqlDate(end);

    const rows = await db.execute(sql`
      with monthly_tx as (
        select
          vt.keyword_code as keyword,
          count(*)::int as redeem,
          count(distinct vt.msisdn)::int as unique_redeemer,
          coalesce(sum(vt.total_point), 0)::int as total_point,
          max(vt.transaction_at)::text as last_transaction_at
        from vw_overview_transaction vt
        where vt.status = 'success'
          and vt.transaction_at >= ${startTs}
          and vt.transaction_at < ${endTs}
        group by vt.keyword_code
      ),
      current_rule as (
        select distinct on (vr.keyword_code)
          vr.keyword_code as keyword,
          vr.point_redeem::int as point_redeem,
          case
            when vr.end_period < current_date then 'expired'
            when vr.start_period > current_date then 'scheduled'
            else 'active'
          end as rule_status,
          vr.start_period::text as start_period,
          vr.end_period::text as end_period
        from vw_rule_merchant_dim vr
        where vr.period && daterange(${monthStartDate}::date, ${monthEndDate}::date, '[)')
        order by vr.keyword_code, vr.end_period desc, vr.start_period desc
      )
      select
        dm.keyword_code as keyword,
        dm.merchant_name as merchant,
        dm.uniq_merchant as uniq_merchant,
        dcat.category as category,
        dcl.branch as branch,
        dcl.cluster as cluster,
        dcl.region as region,
        coalesce(cr.point_redeem, 0)::int as point_redeem,
        coalesce(cr.rule_status, 'inactive') as rule_status,
        cr.start_period as start_period,
        cr.end_period as end_period,
        coalesce(tx.redeem, 0)::int as redeem,
        coalesce(tx.unique_redeemer, 0)::int as unique_redeemer,
        coalesce(tx.total_point, 0)::int as total_point,
        tx.last_transaction_at as last_transaction_at
      from dim_merchant dm
      join dim_category dcat on dcat.category_id = dm.category_id
      join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
      left join monthly_tx tx on tx.keyword = dm.keyword_code
      left join current_rule cr on cr.keyword = dm.keyword_code
      order by coalesce(tx.redeem, 0) desc, dm.merchant_name asc, dm.keyword_code asc
    `);

    const merchants = rows.rows.map((row) => ({
      keyword: String(row.keyword ?? ""),
      merchant: String(row.merchant ?? ""),
      uniqMerchant: String(row.uniq_merchant ?? ""),
      category: String(row.category ?? ""),
      branch: String(row.branch ?? ""),
      cluster: String(row.cluster ?? ""),
      region: String(row.region ?? ""),
      pointRedeem: toInt(row.point_redeem),
      ruleStatus: String(row.rule_status ?? "inactive"),
      startPeriod: row.start_period ? String(row.start_period) : null,
      endPeriod: row.end_period ? String(row.end_period) : null,
      redeem: toInt(row.redeem),
      uniqueRedeemer: toInt(row.unique_redeemer),
      totalPoint: toInt(row.total_point),
      lastTransactionAt: row.last_transaction_at ? String(row.last_transaction_at) : null,
    }));

    const uniqueMerchants = new Set(merchants.map((row) => row.uniqMerchant).filter(Boolean));

    return {
      summary: {
        totalKeywords: merchants.length,
        totalUniqueMerchants: uniqueMerchants.size,
        activeKeywords: merchants.filter((row) => row.ruleStatus === "active").length,
        productiveKeywords: merchants.filter((row) => row.redeem >= PRODUCTIVE_THRESHOLD).length,
        totalTransactions: merchants.reduce((total, row) => total + row.redeem, 0),
        totalPoint: merchants.reduce((total, row) => total + row.totalPoint, 0),
      },
      merchants,
    };
  }
}
