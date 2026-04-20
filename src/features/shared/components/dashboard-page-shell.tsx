import { AppSidebar } from "@/components/app-sidebar";
import { PageContentLoadingOverlay } from "@/components/page-top-loader";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { AuthenticatedAdmin } from "@/lib/auth";

type DashboardPageShellProps = {
  sidebarWidth: string;
  children: React.ReactNode;
  contentClassName?: string;
  user: AuthenticatedAdmin;
};

export function DashboardPageShell({
  sidebarWidth,
  children,
  contentClassName = "bg-background",
  user,
}: DashboardPageShellProps) {
  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": sidebarWidth,
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" user={user} />
      <SidebarInset>
        <SiteHeader />
        <div className={`relative flex min-w-0 flex-1 flex-col ${contentClassName}`}>
          <PageContentLoadingOverlay />
          <div className="@container/main flex min-w-0 flex-1 flex-col gap-2">
            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">{children}</div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
