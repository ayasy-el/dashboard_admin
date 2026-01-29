import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";

export function SiteHeader() {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <h1 className="text-base font-medium">Overview</h1>
        <div className="ml-auto flex items-center gap-6">
          <Button variant="outline" size="sm" className="hidden sm:inline-flex">
            Import CSV
          </Button>
          <Button variant="outline" size="sm" className="hidden sm:inline-flex">
            Export
          </Button>
          <div className="hidden items-center gap-2 text-sm md:flex">
            <Avatar className="h-7 w-7 rounded-full">
              <AvatarImage src="/avatars/shadcn.jpg" alt="Admin" />
              <AvatarFallback>AD</AvatarFallback>
            </Avatar>
            <div className="grid leading-tight">
              <span className="text-xs font-medium">Admin</span>
              <span className="text-muted-foreground text-xs">admin@demo.id</span>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
