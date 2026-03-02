"use client";

import * as React from "react";
import {
  IconChartBar,
  IconDashboard,
  IconHelp,
  IconSettings,
  IconShoppingBag,
  IconTicket,
} from "@tabler/icons-react";
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

const data = {
  user: {
    name: "Admin Dashboard",
    email: "admin@telkomsel.co.id",
    avatar: "",
  },
};
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
    title: "Merchants",
    url: "#",
    icon: IconShoppingBag,
  },
  {
    title: "Redemption",
    url: "#",
    icon: IconTicket,
  },
];

const systemItems = [
  {
    title: "Settings",
    url: "#",
    icon: IconSettings,
  },
  {
    title: "Help Center",
    url: "#",
    icon: IconHelp,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-0">
              <a href="#" className="px-2 py-1.5">
                <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground">
                  T
                </div>
                <span className="text-base font-bold tracking-tight">
                  Telkomsel<span className="text-primary">Poin</span>
                </span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <div className="px-2 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
          Menu
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
                  <a href={item.url}>
                    <item.icon />
                    <span>{item.title}</span>
                  </a>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
        <SidebarSeparator className="my-3 mx-0" />
        <div className="px-2 pb-1 text-[10px] font-semibold tracking-widest text-muted-foreground uppercase">
          System
        </div>
        <SidebarMenu>
          {systemItems.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <a href={item.url}>
                  <item.icon />
                  <span>{item.title}</span>
                </a>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
