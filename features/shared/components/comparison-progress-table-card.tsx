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

export type ComparisonProgressRow = {
  id: string;
  label: React.ReactNode;
  highlightLabel?: boolean;
  metric: React.ReactNode;
  left: { value: React.ReactNode; width: string };
  right: { value: React.ReactNode; width: string };
};

type ComparisonProgressTableCardProps = {
  title: React.ReactNode;
  icon?: React.ReactNode;
  headers: [React.ReactNode, React.ReactNode, React.ReactNode, React.ReactNode];
  rows: ComparisonProgressRow[];
  className?: string;
  leftBarClassName?: string;
  rightBarClassName?: string;
  darkHeader?: boolean;
  splitLabel?: string;
  pagination?: {
    enabled?: boolean;
    pageSize?: number;
    keepFirstRow?: boolean;
  };
};

function ProgressBar({ width, className }: { width: string; className: string }) {
  return (
    <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
      <div className={cn("h-full", className)} style={{ width }} />
    </div>
  );
}

export function ComparisonProgressTableCard({
  title,
  icon,
  headers,
  rows,
  className,
  leftBarClassName = "bg-primary",
  rightBarClassName = "bg-secondary",
  darkHeader = false,
  splitLabel,
  pagination,
}: ComparisonProgressTableCardProps) {
  const totalCols = headers.length;
  const isPaginationEnabled = Boolean(pagination?.enabled);
  const pageSize = pagination?.pageSize ?? 5;
  const keepFirstRow = Boolean(pagination?.keepFirstRow);
  const pinnedRow = keepFirstRow ? rows[0] : undefined;
  const pagedRows = keepFirstRow ? rows.slice(1) : rows;
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageInput, setPageInput] = React.useState("1");
  const totalPages = isPaginationEnabled ? Math.max(1, Math.ceil(pagedRows.length / pageSize)) : 1;

  React.useEffect(() => {
    if (!isPaginationEnabled) return;
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, isPaginationEnabled, totalPages]);

  React.useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const start = isPaginationEnabled ? (currentPage - 1) * pageSize : 0;
  const end = isPaginationEnabled ? start + pageSize : pagedRows.length;
  const visibleRows = isPaginationEnabled ? pagedRows.slice(start, end) : pagedRows;

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
    <Card className={cn("gap-0 border border-border/80 py-0 shadow-sm", className)}>
      <CardHeader className="px-6 py-5">
        <CardTitle className="flex items-center gap-1 text-lg">
          {title}
          {icon}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="no-scrollbar overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className={cn(darkHeader ? "bg-black hover:bg-black" : "bg-muted/40 hover:bg-muted/40")}>
                <TableHead className={cn("px-4", darkHeader ? "text-white" : undefined)}>{headers[0]}</TableHead>
                <TableHead className={cn("px-4 text-center", darkHeader ? "text-white" : undefined)}>{headers[1]}</TableHead>
                <TableHead className={cn("px-4", darkHeader ? "text-white" : undefined)}>{headers[2]}</TableHead>
                <TableHead className={cn("px-4", darkHeader ? "text-white" : undefined)}>{headers[3]}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pinnedRow ? (
                <TableRow>
                  <TableCell className="px-4 font-bold">{pinnedRow.label}</TableCell>
                  <TableCell className="px-4 text-center">{pinnedRow.metric}</TableCell>
                  <TableCell className="px-4">
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-right tabular-nums">{pinnedRow.left.value}</span>
                      <ProgressBar width={pinnedRow.left.width} className={leftBarClassName} />
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-right tabular-nums">{pinnedRow.right.value}</span>
                      <ProgressBar width={pinnedRow.right.width} className={rightBarClassName} />
                    </div>
                  </TableCell>
                </TableRow>
              ) : null}
              {splitLabel ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={totalCols} className="px-4 py-1.5 text-sm italic font-semibold text-primary">
                    {splitLabel}
                  </TableCell>
                </TableRow>
              ) : null}
              {visibleRows.map((row) => (
                <React.Fragment key={row.id}>
                  <TableRow className="bg-muted/50">
                    <TableCell
                      className={cn(
                        "px-4",
                        row.highlightLabel ? "font-bold" : "font-medium text-muted-foreground",
                      )}
                    >
                      {row.label}
                    </TableCell>
                    <TableCell className="px-4 text-center">{row.metric}</TableCell>
                    <TableCell className="px-4">
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-right tabular-nums">{row.left.value}</span>
                        <ProgressBar width={row.left.width} className={leftBarClassName} />
                      </div>
                    </TableCell>
                    <TableCell className="px-4">
                      <div className="flex items-center gap-2">
                        <span className="w-14 text-right tabular-nums">{row.right.value}</span>
                        <ProgressBar width={row.right.width} className={rightBarClassName} />
                      </div>
                    </TableCell>
                  </TableRow>
                </React.Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
        {isPaginationEnabled && totalPages > 1 ? (
          <div className="flex items-center justify-end gap-2 border-t px-4 py-3">
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
        ) : null}
      </CardContent>
    </Card>
  );
}
