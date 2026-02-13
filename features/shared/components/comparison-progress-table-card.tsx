"use client";

import * as React from "react";

import {
  IconChevronDown,
  IconChevronLeft,
  IconChevronRight,
  IconChevronsLeft,
  IconChevronsRight,
  IconChevronUp,
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
  sortableColumns?: boolean[];
  pagination?: {
    enabled?: boolean;
    pageSize?: number;
    keepFirstRow?: boolean;
  };
};

type SortDirection = "asc" | "desc";

const toTextValue = (value: React.ReactNode): string => {
  if (value == null) return "";
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map((item) => toTextValue(item)).join(" ");
  if (React.isValidElement(value)) return toTextValue((value.props as { children?: React.ReactNode }).children);
  return String(value);
};

const toNumericValue = (value: React.ReactNode): number | null => {
  const text = toTextValue(value).trim();
  if (!text) return null;
  const normalized = text.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (!/^-?\d+(\.\d+)?$/.test(normalized)) return null;
  return Number(normalized);
};

function SortIndicator({ active, direction, dark }: { active: boolean; direction?: SortDirection; dark?: boolean }) {
  if (!active) {
    return (
      <span className={cn("inline-flex flex-col", dark ? "text-white/70" : "text-muted-foreground/50")}>
        <IconChevronUp className="-mb-1 size-3" />
        <IconChevronDown className="-mt-1 size-3" />
      </span>
    );
  }

  return direction === "asc" ? <IconChevronUp className="size-3.5" /> : <IconChevronDown className="size-3.5" />;
}

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
  sortableColumns,
  pagination,
}: ComparisonProgressTableCardProps) {
  const totalCols = headers.length;
  const isPaginationEnabled = Boolean(pagination?.enabled);
  const pageSize = pagination?.pageSize ?? 5;
  const keepFirstRow = Boolean(pagination?.keepFirstRow);
  const pinnedRow = keepFirstRow ? rows[0] : undefined;
  const baseRows = keepFirstRow ? rows.slice(1) : rows;
  const [sortState, setSortState] = React.useState<{ column: number; direction: SortDirection } | null>(null);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageInput, setPageInput] = React.useState("1");
  const sortedRows = React.useMemo(() => {
    if (!sortState) return baseRows;

    const next = [...baseRows];
    next.sort((leftRow, rightRow) => {
      if (sortState.column === 0) {
        const leftText = toTextValue(leftRow.label).toLowerCase();
        const rightText = toTextValue(rightRow.label).toLowerCase();
        const compared = leftText.localeCompare(rightText, "id", { numeric: true, sensitivity: "base" });
        return sortState.direction === "asc" ? compared : -compared;
      }

      if (sortState.column === 1) {
        const left = toNumericValue(leftRow.metric);
        const right = toNumericValue(rightRow.metric);
        if (left != null && right != null) {
          return sortState.direction === "asc" ? left - right : right - left;
        }
      }

      if (sortState.column === 2 || sortState.column === 3) {
        const left = toNumericValue(sortState.column === 2 ? leftRow.left.value : leftRow.right.value);
        const right = toNumericValue(sortState.column === 2 ? rightRow.left.value : rightRow.right.value);
        if (left != null && right != null) {
          return sortState.direction === "asc" ? left - right : right - left;
        }
      }

      return 0;
    });
    return next;
  }, [baseRows, sortState]);
  const totalPages = isPaginationEnabled ? Math.max(1, Math.ceil(sortedRows.length / pageSize)) : 1;

  React.useEffect(() => {
    if (!isPaginationEnabled) return;
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, isPaginationEnabled, totalPages]);

  React.useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const start = isPaginationEnabled ? (currentPage - 1) * pageSize : 0;
  const end = isPaginationEnabled ? start + pageSize : sortedRows.length;
  const visibleRows = isPaginationEnabled ? sortedRows.slice(start, end) : sortedRows;

  const commitPageInput = () => {
    const parsed = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsed)) {
      setPageInput(String(currentPage));
      return;
    }
    const nextPage = Math.min(totalPages, Math.max(1, parsed));
    setCurrentPage(nextPage);
  };

  const isColumnSortable = (column: number) => sortableColumns?.[column] ?? true;

  const toggleSort = (column: number) => {
    if (!isColumnSortable(column)) return;
    setCurrentPage(1);
    setSortState((current) => {
      if (!current || current.column !== column) return { column, direction: "asc" };
      if (current.direction === "asc") return { column, direction: "desc" };
      return null;
    });
  };

  return (
    <Card className={cn("min-w-0 gap-0 border border-border/80 py-0 shadow-sm", className)}>
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
                <TableHead className={cn("px-4", darkHeader ? "text-white" : undefined)}>
                  {isColumnSortable(0) ? (
                    <button type="button" className="inline-flex items-center gap-1 font-inherit" onClick={() => toggleSort(0)}>
                      <span>{headers[0]}</span>
                      <SortIndicator
                        active={sortState?.column === 0}
                        direction={sortState?.column === 0 ? sortState.direction : undefined}
                        dark={darkHeader}
                      />
                    </button>
                  ) : (
                    <span>{headers[0]}</span>
                  )}
                </TableHead>
                <TableHead className={cn("px-4 text-center", darkHeader ? "text-white" : undefined)}>
                  {isColumnSortable(1) ? (
                    <button type="button" className="inline-flex items-center gap-1 font-inherit" onClick={() => toggleSort(1)}>
                      <span>{headers[1]}</span>
                      <SortIndicator
                        active={sortState?.column === 1}
                        direction={sortState?.column === 1 ? sortState.direction : undefined}
                        dark={darkHeader}
                      />
                    </button>
                  ) : (
                    <span>{headers[1]}</span>
                  )}
                </TableHead>
                <TableHead className={cn("px-4", darkHeader ? "text-white" : undefined)}>
                  {isColumnSortable(2) ? (
                    <button type="button" className="inline-flex items-center gap-1 font-inherit" onClick={() => toggleSort(2)}>
                      <span>{headers[2]}</span>
                      <SortIndicator
                        active={sortState?.column === 2}
                        direction={sortState?.column === 2 ? sortState.direction : undefined}
                        dark={darkHeader}
                      />
                    </button>
                  ) : (
                    <span>{headers[2]}</span>
                  )}
                </TableHead>
                <TableHead className={cn("px-4", darkHeader ? "text-white" : undefined)}>
                  {isColumnSortable(3) ? (
                    <button type="button" className="inline-flex items-center gap-1 font-inherit" onClick={() => toggleSort(3)}>
                      <span>{headers[3]}</span>
                      <SortIndicator
                        active={sortState?.column === 3}
                        direction={sortState?.column === 3 ? sortState.direction : undefined}
                        dark={darkHeader}
                      />
                    </button>
                  ) : (
                    <span>{headers[3]}</span>
                  )}
                </TableHead>
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
          <div className="flex flex-wrap items-center justify-end gap-2 border-t px-3 py-3 sm:px-4">
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
