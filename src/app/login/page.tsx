import type { Metadata } from "next";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { getCurrentAdminUser, getSafeRedirectPath } from "@/lib/auth";
import { redirect } from "next/navigation";

import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Login | Telkomsel Poin Merchant Dashboard",
  description: "Login admin untuk mengakses dashboard Telkomsel Poin Merchant.",
};

type LoginPageProps = {
  searchParams?: Promise<{
    next?: string | string[];
    error?: string | string[];
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const user = await getCurrentAdminUser();
  if (user) {
    redirect("/");
  }

  const params = (await searchParams) ?? {};
  const next = Array.isArray(params.next) ? params.next[0] : params.next;
  const error = Array.isArray(params.error) ? params.error[0] : params.error;

  return (
    <main className="relative min-h-screen overflow-hidden bg-background">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgb(224_0_36_/_0.12),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgb(253_184_19_/_0.18),_transparent_30%)]" />
      <div className="absolute inset-x-0 top-0 h-56 bg-linear-to-b from-primary/[0.06] to-transparent" />

      <div className="relative mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-6 lg:px-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-3">
            <div className="flex size-10 items-center justify-center rounded-2xl bg-primary text-base font-bold text-primary-foreground shadow-sm">
              T
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold tracking-[0.18em] text-muted-foreground uppercase">
                Merchant Dashboard
              </p>
              <p className="text-lg font-bold tracking-tight">
                Telkomsel<span className="text-primary">Poin</span>
              </p>
            </div>
          </Link>

          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-10 lg:py-14">
          <LoginForm next={getSafeRedirectPath(next)} error={error} />
        </div>
      </div>
    </main>
  );
}
