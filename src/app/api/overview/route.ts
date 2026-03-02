import { NextResponse } from "next/server";

import { getOverviewDashboard } from "@/features/overview/get-overview-dashboard";
import { OverviewRepositoryDrizzle } from "@/features/overview/overview.repository.drizzle";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const repo = new OverviewRepositoryDrizzle();
  const payload = await getOverviewDashboard(repo, searchParams.get("month"), {
    categories: searchParams.getAll("category"),
    branches: searchParams.getAll("branch"),
  });

  return NextResponse.json(payload);
}
