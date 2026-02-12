import { NextResponse } from "next/server";

import { getOperationalDashboard } from "@/features/operational/get-operational-dashboard";
import { OperationalRepositoryDrizzle } from "@/features/operational/operational.repository.drizzle";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repo = new OperationalRepositoryDrizzle();
  const payload = await getOperationalDashboard(repo, searchParams.get("month"));

  return NextResponse.json(payload);
}
