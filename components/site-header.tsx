"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { IconCalendarMonth, IconHome } from "@tabler/icons-react";

const routeTitles: Record<string, string> = {
  "/": "Overview",
  "/operational": "Operational",
};

export function SiteHeader() {
  const pathname = usePathname();
  const title = useMemo(() => {
    if (!pathname) return "Overview";
    return routeTitles[pathname] ?? "Overview";
  }, [pathname]);

  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b bg-card transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <IconHome className="size-4" />
          <span>/</span>
          <h1 className="text-base font-semibold text-foreground">{title}</h1>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Button variant="outline" size="sm" className="hidden border-primary/20 text-primary sm:inline-flex">
            Import CSV
          </Button>
          <Button size="sm" className="hidden bg-primary text-primary-foreground hover:bg-primary/90 sm:inline-flex">
            Export
          </Button>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
