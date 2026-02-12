"use client";

import { useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { IconFileExport, IconTableImport } from "@tabler/icons-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

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
  
  const [isImportLoading, setIsImportLoading] = useState(false);
  const [isExportLoading, setIsExportLoading] = useState(false);

  const handleImport = async () => {
    setIsImportLoading(true);
    
    // Create a temporary file input element
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv,.zip,.rar,.xlsx'; // Accept CSV, ZIP, RAR, and XLSX files
    
    // Handle file selection
    input.onchange = async (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      
      // Clean up the input element
      document.body.removeChild(input);
      
      if (!file) {
        // User cancelled the file selection
        setIsImportLoading(false);
        return;
      }
      
      // Validate file type
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.csv') && !fileName.endsWith('.zip') && !fileName.endsWith('.rar') && !fileName.endsWith('.xlsx')) {
        toast.error('Please select a CSV, ZIP, RAR, or XLSX file');
        setIsImportLoading(false);
        return;
      }
      
      // Prepare form data
      const formData = new FormData();
      formData.append('file', file);
      
      try {
        const response = await fetch('/api/import', {
          method: 'POST',
          body: formData,
        });
        
        const result = await response.json();
        
        if (result.success) {
          toast.success(result.message);
        } else {
          toast.error(result.error || 'Import failed');
        }
      } catch (error) {
        console.error('Import error:', error);
        toast.error('An error occurred during import');
      } finally {
        setIsImportLoading(false);
      }
    };
    
    // Add the input to the document temporarily so it can be clicked
    document.body.appendChild(input);
    
    // Trigger the click event
    input.click();
  };

  const handleExport = async (dataType: 'merchant' | 'transaction', format: 'csv' | 'pdf' | 'xlsx') => {
    setIsExportLoading(true);
    try {
      // Trigger download by navigating to the export endpoint
      const link = document.createElement('a');
      link.href = `/api/export?type=${dataType}&format=${format}`;
      link.download = `${dataType}s.${format}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast.success(`${dataType.charAt(0).toUpperCase() + dataType.slice(1)} data exported as ${format.toUpperCase()} successfully`);
    } catch (error) {
      console.error('Export error:', error);
      toast.error('An error occurred during export');
    } finally {
      setIsExportLoading(false);
    }
  };

  return (
    <header className="bg-background/85 sticky top-0 z-20 flex h-(--header-height) shrink-0 items-center gap-2 border-b border-border/70 backdrop-blur transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-1 px-4 lg:gap-2 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mx-2 data-[orientation=vertical]:h-4" />
        <h1 className="text-base font-semibold tracking-tight">{title}</h1>
        <div className="ml-auto flex items-center gap-3">
          <ThemeToggle />
          <Button 
            variant="outline" 
            size="sm" 
            className="hidden rounded-full border-border/75 bg-card px-4 sm:inline-flex"
            onClick={handleImport}
            disabled={isImportLoading}
          >
            <IconTableImport className="mr-2 h-4 w-4" />
            Import
          </Button>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button 
                variant="outline" 
                size="sm" 
                className="hidden rounded-full border-border/75 bg-card px-4 sm:inline-flex"
                disabled={isExportLoading}
              >
                <IconFileExport className="mr-2 h-4 w-4" />
                Export
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem onClick={() => handleExport('merchant', 'csv')}>
                Merchants (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('merchant', 'xlsx')}>
                Merchants (XLSX)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('merchant', 'pdf')}>
                Merchants (PDF)
              </DropdownMenuItem>
              <Separator className="my-1" />
              <DropdownMenuItem onClick={() => handleExport('transaction', 'csv')}>
                Transactions (CSV)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('transaction', 'xlsx')}>
                Transactions (XLSX)
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleExport('transaction', 'pdf')}>
                Transactions (PDF)
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
