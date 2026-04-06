"use client";

import { IconArrowRight, IconLock } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const errorMessages: Record<string, string> = {
  invalid_form: "Email atau password tidak valid.",
  invalid_credentials: "Email atau password salah.",
};

export function LoginForm({ next, error }: { next: string; error?: string | null }) {
  return (
    <Card className="w-full max-w-md rounded-[2rem] border-border/80 bg-card/95 py-0 shadow-xl shadow-primary/[0.06] backdrop-blur">
      <CardHeader className="gap-3 border-b px-8 py-8">
        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
          <IconLock className="size-5" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl tracking-tight">Login</CardTitle>
          <CardDescription>Masuk ke dashboard admin.</CardDescription>
        </div>
      </CardHeader>

      <CardContent className="px-8 py-8">
        <form action="/api/auth/login" method="post" className="space-y-5">
          <input type="hidden" name="next" value={next} />

          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" name="email" type="email" placeholder="" required />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input id="password" name="password" type="password" placeholder="" required />
          </div>

          <Label htmlFor="remember" className="gap-3 text-sm font-normal text-muted-foreground">
            <Checkbox id="remember" name="remember" />
            Ingat saya
          </Label>

          {error ? (
            <p className="rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
              {errorMessages[error] ?? "Login gagal."}
            </p>
          ) : null}

          <Button type="submit" size="lg" className="w-full rounded-xl">
            Masuk
            <IconArrowRight className="size-4" />
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
