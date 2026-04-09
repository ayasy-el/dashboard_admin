"use client";

import * as React from "react";
import {
  IconChartBar,
  IconDashboard,
  IconBuildingStore,
  IconSettings,
  IconShoppingBag,
  IconTicket,
} from "@tabler/icons-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { NavUser } from "./nav-user";
import type { AuthenticatedAdmin } from "@/lib/auth";
const navItems = [
  {
    title: "Overview",
    url: "/",
    icon: IconDashboard,
  },
  {
    title: "Operational",
    url: "/operational",
    icon: IconChartBar,
  },
  {
    title: "Merchant",
    url: "/merchant",
    icon: IconBuildingStore,
  },
];

const systemItems = [
  {
    title: "Upload Data",
    url: "/ingestion",
    icon: IconSettings,
  },
  {
    title: "Program & Promotions",
    url: "#",
    icon: IconTicket,
  },
  {
    title: "Feedback Center",
    url: "#",
    icon: IconShoppingBag,
  },
];

export function AppSidebar({
  user,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: AuthenticatedAdmin;
}) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-0">
              <Link href="/" className="px-2 py-1.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                  T
                </div>
                <span className="text-base font-bold tracking-tight">
                  Telkomsel<span className="text-primary">Poin</span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-2 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
          Dashboard
        </div>
        <SidebarMenu>
          {navItems.map((item) => {
            const isActive = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  data-active={isActive}
                  className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
                >
                  <Link href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
        <SidebarSeparator className="my-3 mx-0" />
        <div className="px-2 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
          Management
        </div>
        <SidebarMenu>
          {systemItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <Link href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <NavUser
          user={{
            name: user.fullName,
            email: user.email,
            avatar: "",
          }}
        />
      </SidebarFooter>
    </Sidebar>
  );
}
