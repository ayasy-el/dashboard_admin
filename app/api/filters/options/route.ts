import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";

import { db } from "@/lib/db";

const MONTH_REGEX = /^\d{4}-\d{2}$/;

const parseMultiParam = (searchParams: URLSearchParams, key: string) =>
  Array.from(
    new Set(
      searchParams
        .getAll(key)
        .flatMap((value) => value.split(","))
        .map((value) => value.trim())
        .filter(Boolean)
    )
  );

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const selectedMonths = parseMultiParam(searchParams, "month").filter((value) =>
    MONTH_REGEX.test(value)
  );

  const monthWhere =
    selectedMonths.length > 0
      ? sql`and to_char(date_trunc('month', ft.transaction_at), 'YYYY-MM') in (${sql.join(
          selectedMonths.map((value) => sql`${value}`),
          sql`,`
        )})`
      : sql``;

  const categoriesRaw = await db.execute(sql`
    select distinct dc.category as value
    from fact_transaction ft
    join dim_merchant dm on dm.merchant_key = ft.merchant_key
    join dim_category dc on dc.category_id = dm.category_id
    where ft.status = 'success'
      ${monthWhere}
    order by dc.category
  `);

  const branchesRaw = await db.execute(sql`
    select distinct dcl.branch as value
    from fact_transaction ft
    join dim_merchant dm on dm.merchant_key = ft.merchant_key
    join dim_cluster dcl on dcl.cluster_id = dm.cluster_id
    where ft.status = 'success'
      ${monthWhere}
    order by dcl.branch
  `);

  const merchantsRaw = await db.execute(sql`
    select distinct dm.merchant_key as value, dm.merchant_name as label
    from fact_transaction ft
    join dim_merchant dm on dm.merchant_key = ft.merchant_key
    where ft.status = 'success'
      ${monthWhere}
    order by dm.merchant_name
  `);

  return NextResponse.json({
    categories: (categoriesRaw.rows as any[]).map((row) => ({
      value: row.value,
      label: row.value,
    })),
    branches: (branchesRaw.rows as any[]).map((row) => ({
      value: row.value,
      label: row.value,
    })),
    merchants: (merchantsRaw.rows as any[]).map((row) => ({
      value: row.value,
      label: row.label,
    })),
  });
}
