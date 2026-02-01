import { NextResponse } from "next/server"
import { eq, sql } from "drizzle-orm"

import { db } from "@/lib/db"
import { factTransaction } from "@/lib/db/schema"

const monthLabel = (value: string) => {
  const [year, month] = value.split("-").map(Number)
  return new Date(year, month - 1, 1).toLocaleDateString("id-ID", {
    month: "long",
    year: "numeric",
  })
}

export async function GET() {
  const rows = await db
    .select({
      month: sql<string>`to_char(date_trunc('month', ${factTransaction.transactionAt}), 'YYYY-MM')`,
    })
    .from(factTransaction)
    .where(eq(factTransaction.status, "success"))
    .groupBy(sql`date_trunc('month', ${factTransaction.transactionAt})`)
    .orderBy(sql`date_trunc('month', ${factTransaction.transactionAt}) desc`)

  const months = rows.map((row) => ({
    value: row.month,
    label: monthLabel(row.month),
  }))

  return NextResponse.json({ months })
}
