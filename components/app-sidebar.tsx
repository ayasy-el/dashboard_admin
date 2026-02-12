"use client";

import * as React from "react";
import { IconChartBar, IconDashboard, IconInnerShadowTop, IconUser } from "@tabler/icons-react";
import { usePathname } from "next/navigation";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavUser } from "./nav-user";

const data = {
  user: {
    name: "shadcn",
    email: "m@example.com",
    avatar: "/avatars/shadcn.jpg",
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
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();

  return (
    <Sidebar collapsible="offcanvas" className="border-r border-sidebar-border/80" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild className="data-[slot=sidebar-menu-button]:!p-2">
              <a href="#">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground ring-4 ring-primary/15">
                  <IconInnerShadowTop className="!size-4" />
                </div>
                <span className="text-base font-semibold tracking-tight">Admin</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarMenu>
          {navItems.map((item) => {
            const isActive = item.url === "/" ? pathname === "/" : pathname.startsWith(item.url);
            return (
              <SidebarMenuItem key={item.title}>
                <SidebarMenuButton
                  asChild
                  data-active={isActive}
                  className="rounded-xl data-[active=true]:bg-primary data-[active=true]:text-primary-foreground data-[active=true]:shadow-md"
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
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
    </Sidebar>
  );
}
