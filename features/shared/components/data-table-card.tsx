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

type DataTableCardProps = {
  title: React.ReactNode;
  headers: React.ReactNode[];
  rows: React.ReactNode[][];
  className?: string;
  headerRowClassName?: string;
  headerCellClassName?: string;
  rowKey?: (row: React.ReactNode[], index: number) => React.Key;
  columnClassNames?: string[];
  sortableColumns?: boolean[];
  pagination?: {
    enabled?: boolean;
    pageSize?: number;
    pageSizeOptions?: number[];
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

const toComparableValue = (value: React.ReactNode): string | number => {
  const text = toTextValue(value).trim();
  if (!text) return "";

  const numericCandidate = text.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  if (/^-?\d+(\.\d+)?$/.test(numericCandidate)) {
    return Number(numericCandidate);
  }

  return text.toLowerCase();
};

function SortIndicator({ active, direction }: { active: boolean; direction?: SortDirection }) {
  if (!active) {
    return (
      <span className="inline-flex flex-col text-muted-foreground/50">
        <IconChevronUp className="-mb-1 size-3" />
        <IconChevronDown className="-mt-1 size-3" />
      </span>
    );
  }

  return direction === "asc" ? <IconChevronUp className="size-3.5" /> : <IconChevronDown className="size-3.5" />;
}

export function DataTableCard({
  title,
  headers,
  rows,
  className,
  headerRowClassName,
  headerCellClassName,
  rowKey,
  columnClassNames,
  sortableColumns,
  pagination,
}: DataTableCardProps) {
  const isPaginationEnabled = Boolean(pagination?.enabled);
  const [sortState, setSortState] = React.useState<{ column: number; direction: SortDirection } | null>(null);
  const [rowsPerPage, setRowsPerPage] = React.useState(pagination?.pageSize ?? 6);
  const [currentPage, setCurrentPage] = React.useState(1);
  const [pageInput, setPageInput] = React.useState("1");
  const sortedRows = React.useMemo(() => {
    if (!sortState) return rows;

    const next = [...rows];
    next.sort((leftRow, rightRow) => {
      const left = toComparableValue(leftRow[sortState.column]);
      const right = toComparableValue(rightRow[sortState.column]);

      if (typeof left === "number" && typeof right === "number") {
        return sortState.direction === "asc" ? left - right : right - left;
      }

      const leftText = String(left);
      const rightText = String(right);
      const compared = leftText.localeCompare(rightText, "id", { numeric: true, sensitivity: "base" });
      return sortState.direction === "asc" ? compared : -compared;
    });
    return next;
  }, [rows, sortState]);

  const totalRows = sortedRows.length;
  const totalPages = isPaginationEnabled ? Math.max(1, Math.ceil(totalRows / rowsPerPage)) : 1;

  React.useEffect(() => {
    if (!isPaginationEnabled) return;
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, isPaginationEnabled, totalPages]);

  React.useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const startIndex = isPaginationEnabled ? (currentPage - 1) * rowsPerPage : 0;
  const endIndex = isPaginationEnabled ? Math.min(startIndex + rowsPerPage, totalRows) : totalRows;
  const visibleRows = isPaginationEnabled ? sortedRows.slice(startIndex, endIndex) : sortedRows;
  const pageSizeOptions = pagination?.pageSizeOptions?.length
    ? pagination.pageSizeOptions
    : [6, 10, 20, 50];

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
      <CardHeader className="border-b px-6 py-5">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="no-scrollbar overflow-x-auto">
          <Table>
            <TableHeader>
                <TableRow className={cn("bg-muted/40 hover:bg-muted/40", headerRowClassName)}>
                {headers.map((header, index) => (
                  <TableHead
                    key={`header-${index}`}
                    className={cn("px-4", headerCellClassName, columnClassNames?.[index])}
                  >
                    {isColumnSortable(index) ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 font-inherit"
                        onClick={() => toggleSort(index)}
                      >
                        <span>{header}</span>
                        <SortIndicator
                          active={sortState?.column === index}
                          direction={sortState?.column === index ? sortState.direction : undefined}
                        />
                      </button>
                    ) : (
                      <span>{header}</span>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleRows.map((row, rowIndex) => {
                const absoluteIndex = startIndex + rowIndex;
                return (
                <TableRow key={rowKey ? rowKey(row, absoluteIndex) : absoluteIndex}>
                  {row.map((cell, cellIndex) => (
                    <TableCell
                      key={`${absoluteIndex}-${cellIndex}`}
                      className={cn("px-4", columnClassNames?.[cellIndex])}
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
          <div className="flex items-center justify-between border-t px-4 py-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                {totalRows === 0 ? 0 : startIndex + 1} - {endIndex} of {totalRows}
              </span>
              <select
                className="h-7 rounded-md border bg-background px-1 text-xs"
                value={rowsPerPage}
                onChange={(event) => {
                  setRowsPerPage(Number(event.target.value));
                  setCurrentPage(1);
                }}
              >
                {pageSizeOptions.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Halaman pertama"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage(1)}
              >
                <IconChevronsLeft className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Halaman sebelumnya"
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
                aria-label="Halaman berikutnya"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              >
                <IconChevronRight className="size-4" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Halaman terakhir"
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
