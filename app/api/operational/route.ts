import { NextResponse } from "next/server";
import { and, eq, inArray, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { dimCategory, dimCluster, dimMerchant, factTransaction } from "@/lib/db/schema";

const parseMonth = (value: string | null) => {
  if (!value || !/^\d{4}-\d{2}$/.test(value)) {
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${month}`;
  }
  return value;
};

const parseMultiParam = (searchParams: URLSearchParams, key: string) =>
  searchParams
    .getAll(key)
    .flatMap((value) => value.split(","))
    .map((value) => value.trim())
    .filter(Boolean);

const parseMonthParams = (searchParams: URLSearchParams) => {
  const monthParams = parseMultiParam(searchParams, "month").filter((value) => /^\d{4}-\d{2}$/.test(value));
  if (monthParams.length) return Array.from(new Set(monthParams)).sort();
  return [parseMonth(searchParams.get("month"))];
};

const parseFilterParams = (searchParams: URLSearchParams, key: string) =>
  Array.from(new Set(parseMultiParam(searchParams, key).filter((value) => value !== "all")));

const monthToDate = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, 1));
};

const addMonths = (date: Date, offset: number) => {
  const next = new Date(date);
  next.setUTCMonth(next.getUTCMonth() + offset);
  return next;
};

const formatMonth = (date: Date) => {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
};

const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  });
};

const toNumber = (value: unknown) => Number(value ?? 0);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const selectedMonths = parseMonthParams(searchParams);
  const categoryFilters = parseFilterParams(searchParams, "category");
  const branchFilters = parseFilterParams(searchParams, "branch");
  const merchantFilters = parseFilterParams(searchParams, "merchant");
  const expiryScope = searchParams.get("expiryScope") ?? "month";

  const latestMonth = selectedMonths[selectedMonths.length - 1];
  const latestStart = monthToDate(latestMonth);
  const latestEnd = addMonths(latestStart, 1);
  const previousMonths = Array.from(
    new Set(selectedMonths.map((value) => formatMonth(addMonths(monthToDate(value), -1))).sort())
  );
  const previousMonth = formatMonth(addMonths(latestStart, -1));
  const today = new Date();

  const selectedMonthWhere = inArray(
    sql<string>`to_char(date_trunc('month', ${factTransaction.transactionAt}), 'YYYY-MM')`,
    selectedMonths
  );
  const previousMonthWhere = inArray(
    sql<string>`to_char(date_trunc('month', ${factTransaction.transactionAt}), 'YYYY-MM')`,
    previousMonths
  );

  const successWhere = and(
    eq(factTransaction.status, "success"),
    selectedMonthWhere,
    categoryFilters.length ? inArray(dimCategory.category, categoryFilters) : undefined,
    branchFilters.length ? inArray(dimCluster.branch, branchFilters) : undefined,
    merchantFilters.length ? inArray(factTransaction.merchantKey, merchantFilters) : undefined
  );

  const failedWhere = and(
    eq(factTransaction.status, "failed"),
    selectedMonthWhere,
    categoryFilters.length ? inArray(dimCategory.category, categoryFilters) : undefined,
    branchFilters.length ? inArray(dimCluster.branch, branchFilters) : undefined,
    merchantFilters.length ? inArray(factTransaction.merchantKey, merchantFilters) : undefined
  );

  const prevSuccessWhere = and(
    eq(factTransaction.status, "success"),
    previousMonthWhere,
    categoryFilters.length ? inArray(dimCategory.category, categoryFilters) : undefined,
    branchFilters.length ? inArray(dimCluster.branch, branchFilters) : undefined,
    merchantFilters.length ? inArray(factTransaction.merchantKey, merchantFilters) : undefined
  );

  const prevFailedWhere = and(
    eq(factTransaction.status, "failed"),
    previousMonthWhere,
    categoryFilters.length ? inArray(dimCategory.category, categoryFilters) : undefined,
    branchFilters.length ? inArray(dimCluster.branch, branchFilters) : undefined,
    merchantFilters.length ? inArray(factTransaction.merchantKey, merchantFilters) : undefined
  );

  const [successSummary] = await db
    .select({ total: sql<number>`count(*)` })
    .from(factTransaction)
    .innerJoin(dimMerchant, eq(dimMerchant.merchantKey, factTransaction.merchantKey))
    .innerJoin(dimCategory, eq(dimCategory.categoryId, dimMerchant.categoryId))
    .innerJoin(dimCluster, eq(dimCluster.clusterId, dimMerchant.clusterId))
    .where(successWhere);

  const [failedSummary] = await db
    .select({ total: sql<number>`count(*)` })
    .from(factTransaction)
    .innerJoin(dimMerchant, eq(dimMerchant.merchantKey, factTransaction.merchantKey))
    .innerJoin(dimCategory, eq(dimCategory.categoryId, dimMerchant.categoryId))
    .innerJoin(dimCluster, eq(dimCluster.clusterId, dimMerchant.clusterId))
    .where(failedWhere);

  const [prevSuccessSummary] = await db
    .select({ total: sql<number>`count(*)` })
    .from(factTransaction)
    .innerJoin(dimMerchant, eq(dimMerchant.merchantKey, factTransaction.merchantKey))
    .innerJoin(dimCategory, eq(dimCategory.categoryId, dimMerchant.categoryId))
    .innerJoin(dimCluster, eq(dimCluster.clusterId, dimMerchant.clusterId))
    .where(prevSuccessWhere);

  const [prevFailedSummary] = await db
    .select({ total: sql<number>`count(*)` })
    .from(factTransaction)
    .innerJoin(dimMerchant, eq(dimMerchant.merchantKey, factTransaction.merchantKey))
    .innerJoin(dimCategory, eq(dimCategory.categoryId, dimMerchant.categoryId))
    .innerJoin(dimCluster, eq(dimCluster.clusterId, dimMerchant.clusterId))
    .where(prevFailedWhere);

  const dailySuccess = await db
    .select({
      date: sql<string>`date(${factTransaction.transactionAt})`,
      value: sql<number>`count(*)`,
    })
    .from(factTransaction)
    .innerJoin(dimMerchant, eq(dimMerchant.merchantKey, factTransaction.merchantKey))
    .innerJoin(dimCategory, eq(dimCategory.categoryId, dimMerchant.categoryId))
    .innerJoin(dimCluster, eq(dimCluster.clusterId, dimMerchant.clusterId))
    .where(successWhere)
    .groupBy(sql`date(${factTransaction.transactionAt})`)
    .orderBy(sql`date(${factTransaction.transactionAt})`);

  const dailyFailed = await db
    .select({
      date: sql<string>`date(${factTransaction.transactionAt})`,
      value: sql<number>`count(*)`,
    })
    .from(factTransaction)
    .innerJoin(dimMerchant, eq(dimMerchant.merchantKey, factTransaction.merchantKey))
    .innerJoin(dimCategory, eq(dimCategory.categoryId, dimMerchant.categoryId))
    .innerJoin(dimCluster, eq(dimCluster.clusterId, dimMerchant.clusterId))
    .where(failedWhere)
    .groupBy(sql`date(${factTransaction.transactionAt})`)
    .orderBy(sql`date(${factTransaction.transactionAt})`);

  const sqlList = (values: string[]) => sql.join(values.map((value) => sql`${value}`), sql`,`);
  const selectedMonthsSql = sqlList(selectedMonths);
  const categoryFilterSqlDc = categoryFilters.length ? sql`and dc.category in (${sqlList(categoryFilters)})` : sql``;
  const branchFilterSqlDcl = branchFilters.length ? sql`and dcl.branch in (${sqlList(branchFilters)})` : sql``;
  const merchantFilterSqlDm = merchantFilters.length ? sql`and dm.merchant_key in (${sqlList(merchantFilters)})` : sql``;

  const topMerchants = await db.execute(sql`
    select
      dm.merchant_name as merchant,
      dm.keyword_code as keyword,
      count(*)::int as total_transactions,
      dm.uniq_merchant as uniq_merchant,
      count(distinct ft.msisdn)::int as uniq_redeemer
    from fact_transaction ft
    join dim_merchant dm on dm.merchant_key = ft.merchant_key
    join dim_category dc on dc.category_id = dm.category_id
    join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
    where ft.status = 'success'
      and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') in (${selectedMonthsSql})
      ${categoryFilterSqlDc}
      ${branchFilterSqlDcl}
      ${merchantFilterSqlDm}
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
    join dim_category dc on dc.category_id = dm.category_id
    join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
    where ${
      expiryScope === "upcoming"
        ? sql`dr.end_period >= current_date`
        : sql`dr.end_period >= ${latestStart} and dr.end_period < ${latestEnd}`
    }
      ${categoryFilterSqlDc}
      ${branchFilterSqlDcl}
      ${merchantFilterSqlDm}
    order by dr.end_period asc
    limit ${expiryScope === "upcoming" ? 20 : 12}
  `);

  const expiredPastRules = await db.execute(sql`
    select
      dm.merchant_name as merchant,
      dm.keyword_code as keyword,
      dr.start_period as start_period,
      dr.end_period as end_period
    from dim_rule dr
    join dim_merchant dm on dm.merchant_key = dr.rule_merchant
    join dim_category dc on dc.category_id = dm.category_id
    join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
    where dr.end_period >= ${latestStart}
      and dr.end_period < ${latestEnd}
      and dr.end_period < current_date
      ${categoryFilterSqlDc}
      ${branchFilterSqlDcl}
      ${merchantFilterSqlDm}
    order by dr.end_period desc
    limit 12
  `);

  return NextResponse.json({
    month: latestMonth,
    monthLabel: monthLabel(latestMonth),
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
      uniqMerchant: row.uniq_merchant,
      uniqRedeemer: toNumber(row.uniq_redeemer),
    })),
    expiredRules: (expiredRules.rows as any[]).map((row) => {
      const endDate = new Date(row.end_period);
      const timeDiff = endDate.getTime() - today.getTime();
      const daysLeft = Math.ceil(timeDiff / (1000 * 3600 * 24));

      return {
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
        daysLeft,
      };
    }),
    expiredPastRules: (expiredPastRules.rows as any[]).map((row) => ({
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
  });
}
