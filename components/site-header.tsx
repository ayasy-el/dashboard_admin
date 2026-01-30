"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { IconFileExport, IconTableImport } from "@tabler/icons-react";

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
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <h1 className="text-base font-medium">{title}</h1>
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <Button variant="outline" size="sm" className="hidden sm:inline-flex">
            <IconTableImport />
            Import CSV
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex">
            <IconFileExport />
            Export
          </Button>
        </div>
      </div>
    </header>
  );
}
