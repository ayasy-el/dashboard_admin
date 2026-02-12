"use client";

import * as React from "react";

import {
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

type RankedMetricsTableCardProps = {
  title: React.ReactNode;
  icon?: React.ReactNode;
  tone: "green" | "yellow" | "red";
  headerCols: React.ReactNode[];
  rows: React.ReactNode[][];
  className?: string;
  rankHeader?: React.ReactNode;
  pagination?: {
    enabled?: boolean;
    pageSize?: number;
  };
  paginationInfo?: React.ReactNode;
};

export function RankedMetricsTableCard({
  title,
  icon,
  tone,
  headerCols,
  rows,
  className,
  rankHeader = "#",
  pagination,
  paginationInfo,
}: RankedMetricsTableCardProps) {
  const toneClass =
    tone === "green" ? "bg-green-50/40" : tone === "yellow" ? "bg-yellow-50/40" : "bg-red-50/40";
  const isPaginationEnabled = Boolean(pagination?.enabled);
  const pageSize = pagination?.pageSize ?? 4;
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageInput, setPageInput] = React.useState("1");
  const totalPages = isPaginationEnabled ? Math.max(1, Math.ceil(rows.length / pageSize)) : 1;

  React.useEffect(() => {
    if (!isPaginationEnabled) return;
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, isPaginationEnabled, totalPages]);

  React.useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const start = isPaginationEnabled ? (currentPage - 1) * pageSize : 0;
  const end = isPaginationEnabled ? start + pageSize : rows.length;
  const visibleRows = isPaginationEnabled ? rows.slice(start, end) : rows;

  const commitPageInput = () => {
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsed)) {
      setPageInput(String(currentPage));
      return;
    }
    const nextPage = Math.min(totalPages, Math.max(1, parsed));
    setCurrentPage(nextPage);
  };

  return (
    <Card className={cn("gap-0 overflow-hidden border border-border/80 py-0 shadow-sm", className)}>
      <CardHeader className={cn("border-b px-4 py-4", toneClass)}>
        <CardTitle className="flex items-center gap-1 text-base">
          {title}
          {icon}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="no-scrollbar overflow-x-auto">
          <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10 px-3 text-center">{rankHeader}</TableHead>
              {headerCols.map((header, index) => (
                <TableHead
                  key={`header-${index}`}
                  className={cn("px-3", index === 0 ? undefined : "text-right")}
                >
                  {header}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {visibleRows.map((row, index) => {
              const absoluteIndex = start + index;
              return (
              <TableRow key={`${String(title)}-${absoluteIndex}`}>
                <TableCell className="px-3 text-center font-medium tabular-nums">
                  {absoluteIndex + 1}
                </TableCell>
                {row.map((cell, cellIndex) => (
                  <TableCell
                    key={`row-${absoluteIndex}-cell-${cellIndex}`}
                    className={cn("px-3", cellIndex === 0 ? "font-medium" : "text-right")}
                  >
                    {cell}
                  </TableCell>
                ))}
              </TableRow>
            )})}
          </TableBody>
        </Table>
        </div>
        {isPaginationEnabled && totalPages > 1 ? (
          <div className="flex items-center justify-between gap-2 border-t px-3 py-2">
            <span className="text-xs text-muted-foreground">{paginationInfo}</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
              >
                <IconChevronsLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              >
                <IconChevronLeft className="size-4" />
              </Button>
              <input
                className="h-8 w-10 rounded-md border bg-background text-center text-sm"
                inputMode="numeric"
                value={pageInput}
                onChange={(event) => setPageInput(event.target.value.replace(/[^\d]/g, ""))}
                onBlur={commitPageInput}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    commitPageInput();
                  }
                }}
              />
              <span className="text-xs text-muted-foreground">of {totalPages}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                <IconChevronRight className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage(totalPages)}
              >
                <IconChevronsRight className="size-4" />
              </Button>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
