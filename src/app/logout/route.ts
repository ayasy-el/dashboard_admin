import { NextResponse } from "next/server";

import { logoutAdmin } from "@/lib/auth";
import { createRequestUrl } from "@/lib/request-url";

export async function POST(request: Request) {
  await logoutAdmin();
  return NextResponse.redirect(createRequestUrl("/login", request.headers, request.url), 303);
}
