"use client";

import * as React from "react";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";

type ClusterMetricRow = {
  name: string;
  totalMerchant: number;
  uniqueMerchant: number;
  totalPoint: number;
  totalTransaksi: number;
  uniqueRedeemer: number;
  merchantAktif: number;
  merchantProduktif: number;
  children?: ClusterMetricRow[];
};

type CollapsibleClusterTableCardProps = {
  title: React.ReactNode;
  rows: ClusterMetricRow[];
  className?: string;
  darkHeader?: boolean;
};

const formatNumber = (value: number) => value.toLocaleString("id-ID");
type SortDirection = "asc" | "desc";
type SortColumn = "name" | keyof Omit<ClusterMetricRow, "name" | "children">;

const numericColumns: Array<keyof Omit<ClusterMetricRow, "name" | "children">> = [
  "totalMerchant",
  "uniqueMerchant",
  "totalPoint",
  "totalTransaksi",
  "uniqueRedeemer",
  "merchantAktif",
  "merchantProduktif",
];

function SortIndicator({
  active,
  direction,
  dark,
}: {
  active: boolean;
  direction?: SortDirection;
  dark?: boolean;
}) {
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

export function CollapsibleClusterTableCard({
  title,
  rows,
  className,
  darkHeader = false,
}: CollapsibleClusterTableCardProps) {
  const [expandedRows, setExpandedRows] = React.useState<Set<string>>(() => new Set());
  const [sortState, setSortState] = React.useState<{ column: SortColumn; direction: SortDirection } | null>(null);

  const toggleRow = (rowName: string) => {
    setExpandedRows((current) => {
      const next = new Set(current);
      if (next.has(rowName)) {
        next.delete(rowName);
      } else {
        next.add(rowName);
      }
      return next;
    });
  };

  const toggleSort = (column: SortColumn) => {
    setSortState((current) => {
      if (!current || current.column !== column) return { column, direction: "asc" };
      if (current.direction === "asc") return { column, direction: "desc" };
      return null;
    });
  };

  const sortedRows = React.useMemo(() => {
    if (!sortState) return rows;

    const next = [...rows];
    next.sort((left, right) => {
      const leftValue = left[sortState.column];
      const rightValue = right[sortState.column];

      if (typeof leftValue === "number" && typeof rightValue === "number") {
        return sortState.direction === "asc" ? leftValue - rightValue : rightValue - leftValue;
      }

      const leftText = String(leftValue ?? "");
      const rightText = String(rightValue ?? "");
      const compared = leftText.localeCompare(rightText, "id", { numeric: true, sensitivity: "base" });
      return sortState.direction === "asc" ? compared : -compared;
    });
    return next;
  }, [rows, sortState]);

  return (
    <Card className={cn("min-w-0 gap-0 overflow-hidden border border-border/80 py-0 shadow-sm", className)}>
      <CardHeader className="border-b px-6 py-5">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="no-scrollbar overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className={cn(darkHeader ? "bg-black hover:bg-black" : "bg-muted/40 hover:bg-muted/40")}>
                <TableHead className={cn("px-4", darkHeader ? "text-white" : undefined)}>
                  <button type="button" className="inline-flex items-center gap-1 font-inherit" onClick={() => toggleSort("name")}>
                    <span>Branch</span>
                    <SortIndicator
                      active={sortState?.column === "name"}
                      direction={sortState?.column === "name" ? sortState.direction : undefined}
                      dark={darkHeader}
                    />
                  </button>
                </TableHead>
                <TableHead className={cn("px-4 text-right", darkHeader ? "text-white" : undefined)}>
                  <button type="button" className="ml-auto inline-flex items-center gap-1 font-inherit" onClick={() => toggleSort("totalMerchant")}>
                    <span>Jumlah Merchant</span>
                    <SortIndicator
                      active={sortState?.column === "totalMerchant"}
                      direction={sortState?.column === "totalMerchant" ? sortState.direction : undefined}
                      dark={darkHeader}
                    />
                  </button>
                </TableHead>
                <TableHead className={cn("px-4 text-right", darkHeader ? "text-white" : undefined)}>
                  <button type="button" className="ml-auto inline-flex items-center gap-1 font-inherit" onClick={() => toggleSort("uniqueMerchant")}>
                    <span>Unique Merchant</span>
                    <SortIndicator
                      active={sortState?.column === "uniqueMerchant"}
                      direction={sortState?.column === "uniqueMerchant" ? sortState.direction : undefined}
                      dark={darkHeader}
                    />
                  </button>
                </TableHead>
                <TableHead className={cn("px-4 text-right", darkHeader ? "text-white" : undefined)}>
                  <button type="button" className="ml-auto inline-flex items-center gap-1 font-inherit" onClick={() => toggleSort("totalPoint")}>
                    <span>Total Point</span>
                    <SortIndicator
                      active={sortState?.column === "totalPoint"}
                      direction={sortState?.column === "totalPoint" ? sortState.direction : undefined}
                      dark={darkHeader}
                    />
                  </button>
                </TableHead>
                <TableHead className={cn("px-4 text-right", darkHeader ? "text-white" : undefined)}>
                  <button type="button" className="ml-auto inline-flex items-center gap-1 font-inherit" onClick={() => toggleSort("totalTransaksi")}>
                    <span>Total Transaksi</span>
                    <SortIndicator
                      active={sortState?.column === "totalTransaksi"}
                      direction={sortState?.column === "totalTransaksi" ? sortState.direction : undefined}
                      dark={darkHeader}
                    />
                  </button>
                </TableHead>
                <TableHead className={cn("px-4 text-right", darkHeader ? "text-white" : undefined)}>
                  <button type="button" className="ml-auto inline-flex items-center gap-1 font-inherit" onClick={() => toggleSort("uniqueRedeemer")}>
                    <span>Unique Redeemer</span>
                    <SortIndicator
                      active={sortState?.column === "uniqueRedeemer"}
                      direction={sortState?.column === "uniqueRedeemer" ? sortState.direction : undefined}
                      dark={darkHeader}
                    />
                  </button>
                </TableHead>
                <TableHead className={cn("px-4 text-right", darkHeader ? "text-white" : undefined)}>
                  <button type="button" className="ml-auto inline-flex items-center gap-1 font-inherit" onClick={() => toggleSort("merchantAktif")}>
                    <span>Merchant Aktif</span>
                    <SortIndicator
                      active={sortState?.column === "merchantAktif"}
                      direction={sortState?.column === "merchantAktif" ? sortState.direction : undefined}
                      dark={darkHeader}
                    />
                  </button>
                </TableHead>
                <TableHead className={cn("px-4 text-right", darkHeader ? "text-white" : undefined)}>
                  <button type="button" className="ml-auto inline-flex items-center gap-1 font-inherit" onClick={() => toggleSort("merchantProduktif")}>
                    <span>Merchant Produktif</span>
                    <SortIndicator
                      active={sortState?.column === "merchantProduktif"}
                      direction={sortState?.column === "merchantProduktif" ? sortState.direction : undefined}
                      dark={darkHeader}
                    />
                  </button>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedRows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-24 text-center text-muted-foreground">
                    No results.
                  </TableCell>
                </TableRow>
              ) : (
                sortedRows.map((row) => {
                  const isExpanded = expandedRows.has(row.name);
                  const hasChildren = Boolean(row.children?.length);

                  return (
                    <React.Fragment key={row.name}>
                      <TableRow>
                        <TableCell className="px-4 font-medium">
                          <div className="flex items-center gap-2">
                            {hasChildren ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-xs"
                                onClick={() => toggleRow(row.name)}
                              >
                                {isExpanded ? (
                                  <IconChevronUp className="size-3.5" />
                                ) : (
                                  <IconChevronDown className="size-3.5" />
                                )}
                              </Button>
                            ) : (
                              <span className="inline-block w-6" />
                            )}
                            <span>{row.name}</span>
                          </div>
                        </TableCell>
                        {numericColumns.map((column) => (
                          <TableCell key={`${row.name}-${column}`} className="px-4 text-right tabular-nums">
                            {formatNumber(row[column])}
                          </TableCell>
                        ))}
                      </TableRow>
                      {isExpanded && row.children?.map((child) => (
                        <TableRow key={`${row.name}-${child.name}`} className="bg-muted/20">
                          <TableCell className="px-4">
                            <span className="pl-8 text-muted-foreground">{child.name}</span>
                          </TableCell>
                          {numericColumns.map((column) => (
                            <TableCell
                              key={`${row.name}-${child.name}-${column}`}
                              className="px-4 text-right tabular-nums"
                            >
                              {formatNumber(child[column])}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </React.Fragment>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
