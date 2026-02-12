import { and, eq, gte, lt, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { factTransaction } from "@/lib/db/schema";
import type {
  MonthRange,
  OperationalRawData,
  OperationalRepository,
} from "@/features/operational/operational.repository";
import { toSqlTimestamp } from "@/features/shared/month";

const toNumber = (value: unknown) => Number(value ?? 0);

export class OperationalRepositoryDrizzle implements OperationalRepository {
  async getOperationalRawData({
    start,
    end,
    previousStart,
    previousEnd,
  }: MonthRange): Promise<OperationalRawData> {
    const startTs = toSqlTimestamp(start);
    const endTs = toSqlTimestamp(end);
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
    };
  }
}
