import { NextResponse } from "next/server";

import { logoutAdmin } from "@/lib/auth";

export async function POST(request: Request) {
  await logoutAdmin();
  return NextResponse.redirect(new URL("/login", request.url), 303);
}
