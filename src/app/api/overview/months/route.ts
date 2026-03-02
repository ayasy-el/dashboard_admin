import { NextResponse } from "next/server";

import { getMonthOptions } from "@/features/shared/get-month-options";

export async function GET() {
  const months = await getMonthOptions();
  return NextResponse.json({ months });
}
