import { eq, sql } from "drizzle-orm";

import { db } from "@/lib/db";
import { factTransaction } from "@/lib/db/schema";
import { monthLabel } from "@/features/shared/month";

export type MonthOption = {
  value: string;
  label: string;
};

export async function getMonthOptions(): Promise<MonthOption[]> {
  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${factTransaction.transactionAt}), 'YYYY-MM')`,
    })
    .from(factTransaction)
    .where(eq(factTransaction.status, "success"))
    .groupBy(sql`date_trunc('month', ${factTransaction.transactionAt})`)
    .orderBy(sql`date_trunc('month', ${factTransaction.transactionAt}) desc`);

  return rows.map((row) => ({
    value: row.month,
    label: monthLabel(row.month),
  }));
}
