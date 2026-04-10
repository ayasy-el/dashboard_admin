"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { MouseEvent } from "react";

import {
  DASHBOARD_FILTER_COOKIE_MAX_AGE,
  DASHBOARD_FILTER_COOKIE_NAME,
  parseDashboardFilterCookie,
  serializeDashboardFilterCookie,
} from "@/lib/dashboard-filters";
import { cn } from "@/lib/utils";

type DashboardFilterLinkProps = {
  children: string;
  month: string;
  category?: string;
  branch?: string;
  className?: string;
};

const readDashboardFilterCookie = () =>
  document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${DASHBOARD_FILTER_COOKIE_NAME}=`))
    ?.split("=")
    .slice(1)
    .join("=");

export function DashboardFilterLink({
  children,
  month,
  category,
  branch,
  className,
}: DashboardFilterLinkProps) {
  const router = useRouter();

  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();

    const currentFilters = parseDashboardFilterCookie(readDashboardFilterCookie());
    const nextFilters = {
      month,
      categories: category
        ? Array.from(new Set([...currentFilters.categories, category]))
        : currentFilters.categories,
      branches: branch
        ? Array.from(new Set([...currentFilters.branches, branch]))
        : currentFilters.branches,
    };

    document.cookie = `${DASHBOARD_FILTER_COOKIE_NAME}=${serializeDashboardFilterCookie(nextFilters)}; path=/; max-age=${DASHBOARD_FILTER_COOKIE_MAX_AGE}; samesite=lax`;
    router.push("/");
    router.refresh();
  };

  return (
    <Link
      href="/"
      onClick={handleClick}
      className={cn("text-black underline-offset-4 hover:underline", className)}
    >
      {children}
    </Link>
  );
}
