import { NextResponse } from "next/server";

import { authenticateAdmin, getSafeRedirectPath } from "@/lib/auth";
import { createRequestUrl } from "@/lib/request-url";

const toLoginUrl = (request: Request, nextPath: string, error: string) => {
  const url = createRequestUrl("/login", request.headers, request.url);
  url.searchParams.set("next", nextPath);
  url.searchParams.set("error", error);
  return url;
};

export async function POST(request: Request) {
  const formData = await request.formData();
  const email = formData.get("email");
  const password = formData.get("password");
  const next = formData.get("next");
  const remember = formData.get("remember");

  if (typeof email !== "string" || typeof password !== "string") {
    return NextResponse.redirect(
      toLoginUrl(request, getSafeRedirectPath(typeof next === "string" ? next : "/"), "invalid_form"),
      303
    );
  }

  const nextPath = getSafeRedirectPath(typeof next === "string" ? next : "/");
  const user = await authenticateAdmin({
    email,
    password,
    remember: remember === "on" || remember === "true",
  });

  if (!user) {
    return NextResponse.redirect(toLoginUrl(request, nextPath, "invalid_credentials"), 303);
  }

  return NextResponse.redirect(createRequestUrl(nextPath, request.headers, request.url), 303);
}
