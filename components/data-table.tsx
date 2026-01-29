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
import {
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const metricSchema = z.object({
  id: z.number(),
  name: z.string(),
  totalMerchant: z.number(),
  uniqueMerchant: z.number(),
  totalPoint: z.number(),
  totalTransaksi: z.number(),
  uniqueRedeemer: z.number(),
  merchantAktif: z.number(),
  merchantProduktif: z.number(),
});

type MetricRow = z.infer<typeof metricSchema>;

type ClusterRow = MetricRow & {
  children?: MetricRow[];
};

type DisplayRow = MetricRow & {
  isChild?: boolean;
  parentId?: number;
  children?: MetricRow[];
};

type DataTableProps = {
  data: {
    cluster: ClusterRow[];
    category: MetricRow[];
  };
};

const formatNumber = (value: number) => new Intl.NumberFormat("id-ID").format(value);

const sumField = (rows: MetricRow[], key: keyof MetricRow) =>
  rows.reduce((total, row) => total + row[key], 0);

const buildParentTotals = (row: ClusterRow): MetricRow => {
  if (!row.children || row.children.length === 0) {
    return row;
  }

  return {
    id: row.id,
    name: row.name,
    totalMerchant: sumField(row.children, "totalMerchant"),
    uniqueMerchant: sumField(row.children, "uniqueMerchant"),
    totalPoint: sumField(row.children, "totalPoint"),
    totalTransaksi: sumField(row.children, "totalTransaksi"),
    uniqueRedeemer: sumField(row.children, "uniqueRedeemer"),
    merchantAktif: sumField(row.children, "merchantAktif"),
    merchantProduktif: sumField(row.children, "merchantProduktif"),
  };
};

function buildColumns(
  nameHeader: string,
  onToggleRow?: (rowId: number) => void,
  expandedRows?: Set<number>,
): ColumnDef<DisplayRow>[] {
  return [
    {
      accessorKey: "name",
      header: nameHeader,
      cell: ({ row }) => {
        const hasChildren = row.original.children && row.original.children.length > 0;
        const isChild = row.original.isChild;
        const isExpanded = expandedRows?.has(row.original.id);
        return (
          <div className={cn("flex items-center gap-2", isChild && "pl-6 text-muted-foreground")}>
            {hasChildren && !isChild ? (
              <Button
                variant="ghost"
                size="icon"
                className="size-6"
                onClick={() => onToggleRow?.(row.original.id)}
              >
                {isExpanded ? (
                  <IconChevronUp className="size-4" />
                ) : (
                  <IconChevronDown className="size-4" />
                )}
              </Button>
            ) : (
              <span className="" />
            )}
            <span className={cn("font-medium", isChild && "font-normal")}>{row.original.name}</span>
          </div>
        );
      },
    },
    {
      accessorKey: "totalMerchant",
      header: () => <div>Jumlah Merchant</div>,
      cell: ({ row }) => (
        <div className="tabular-nums">{formatNumber(row.original.totalMerchant)}</div>
      ),
    },
    {
      accessorKey: "uniqueMerchant",
      header: () => <div>Unique Merchant</div>,
      cell: ({ row }) => (
        <div className="tabular-nums">{formatNumber(row.original.uniqueMerchant)}</div>
      ),
    },
    {
      accessorKey: "totalPoint",
      header: () => <div>Total Point</div>,
      cell: ({ row }) => (
        <div className="tabular-nums">{formatNumber(row.original.totalPoint)}</div>
      ),
    },
    {
      accessorKey: "totalTransaksi",
      header: () => <div>Total Transaksi</div>,
      cell: ({ row }) => (
        <div className="tabular-nums">{formatNumber(row.original.totalTransaksi)}</div>
      ),
    },
    {
      accessorKey: "uniqueRedeemer",
      header: () => <div>Unique Redeemer</div>,
      cell: ({ row }) => (
        <div className="tabular-nums">{formatNumber(row.original.uniqueRedeemer)}</div>
      ),
    },
    {
      accessorKey: "merchantAktif",
      header: () => <div>Merchant Aktif</div>,
      cell: ({ row }) => (
        <div className="tabular-nums">{formatNumber(row.original.merchantAktif)}</div>
      ),
    },
    {
      accessorKey: "merchantProduktif",
      header: () => <div>Merchant Produktif</div>,
      cell: ({ row }) => (
        <div className="tabular-nums">{formatNumber(row.original.merchantProduktif)}</div>
      ),
    },
  ];
}

function MetricsTable({
  title,
  data,
  enableCollapse = false,
}: {
  title: string;
  data: ClusterRow[] | MetricRow[];
  enableCollapse?: boolean;
}) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [expandedRows, setExpandedRows] = React.useState<Set<number>>(() => new Set());

  const toggleRow = React.useCallback((rowId: number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  }, []);

  const tableData = React.useMemo<DisplayRow[]>(() => {
    if (!enableCollapse) {
      return data as DisplayRow[];
    }

    const rows: DisplayRow[] = [];
    (data as ClusterRow[]).forEach((branch) => {
      const parentTotals = buildParentTotals(branch);
      rows.push({
        ...parentTotals,
        children: branch.children,
      });
      if (branch.children && expandedRows.has(branch.id)) {
        branch.children.forEach((child) => {
          rows.push({
            ...child,
            isChild: true,
            parentId: branch.id,
          });
        });
      }
    });
    return rows;
  }, [data, enableCollapse, expandedRows]);

  const columns = React.useMemo(
    () =>
      buildColumns(
        title === "Cluster" ? "Branch" : "Category",
        enableCollapse ? toggleRow : undefined,
        enableCollapse ? expandedRows : undefined,
      ),
    [title, enableCollapse, toggleRow, expandedRows],
  );

  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
    },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Card className="gap-0 overflow-hidden py-0">
      <CardContent className="flex flex-col gap-4 p-0">
        <Table className="[&_th]:px-5 [&_td]:px-5 [&_td]:py-3 [&_th]:h-15 [&_th:first-child]:pl-16 [&_td:first-child]:pl-16 [&_th:last-child]:pr-12 [&_td:last-child]:pr-12">
          <TableHeader className="bg-muted/60 text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id} colSpan={header.colSpan}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} className={cn(row.original.isChild && "bg-muted/20")}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        {/*
        <div className="flex items-center justify-between px-4 pb-4">
          <div className="flex w-full items-center gap-8 lg:w-fit">
            <div className="hidden items-center gap-2 lg:flex">
              <Label htmlFor={`rows-per-page-${title}`} className="text-sm font-medium">
                Rows per page
              </Label>
              <Select
                value={`${table.getState().pagination.pageSize}`}
                onValueChange={(value) => {
                  table.setPageSize(Number(value));
                }}
              >
                <SelectTrigger size="sm" className="w-20" id={`rows-per-page-${title}`}>
                  <SelectValue placeholder={table.getState().pagination.pageSize} />
                </SelectTrigger>
                <SelectContent side="top">
                  {[8, 12, 16, 20].map((pageSize) => (
                    <SelectItem key={pageSize} value={`${pageSize}`}>
                      {pageSize}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.setPageIndex(0)}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to first page</span>
                <IconChevronsLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.previousPage()}
                disabled={!table.getCanPreviousPage()}
              >
                <span className="sr-only">Go to previous page</span>
                <IconChevronLeft />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.nextPage()}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to next page</span>
                <IconChevronRight />
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => table.setPageIndex(table.getPageCount() - 1)}
                disabled={!table.getCanNextPage()}
              >
                <span className="sr-only">Go to last page</span>
                <IconChevronsRight />
              </Button>
            </div>
          </div>
        </div>
        */}
      </CardContent>
    </Card>
  );
}

export function DataTable({ data }: DataTableProps) {
  return (
    <div className="flex flex-col gap-8 px-4 lg:px-6">
      <MetricsTable title="Cluster" data={data.cluster} enableCollapse />
      <MetricsTable title="Category" data={data.category} />
    </div>
  );
}
