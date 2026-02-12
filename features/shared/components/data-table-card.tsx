import * as React from "react";

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
};

export function DataTableCard({
  title,
  headers,
  rows,
  className,
  headerRowClassName,
  headerCellClassName,
  rowKey,
  columnClassNames,
}: DataTableCardProps) {
  return (
    <Card className={cn("gap-0 overflow-hidden border border-border/80 py-0 shadow-sm", className)}>
      <CardHeader className="border-b px-6 py-5">
        <CardTitle className="text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className={cn("bg-muted/40 hover:bg-muted/40", headerRowClassName)}>
                {headers.map((header, index) => (
                  <TableHead
                    key={`header-${index}`}
                    className={cn("px-4", headerCellClassName, columnClassNames?.[index])}
                  >
                    {header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, rowIndex) => (
                <TableRow key={rowKey ? rowKey(row, rowIndex) : rowIndex}>
                  {row.map((cell, cellIndex) => (
                    <TableCell
                      key={`${rowIndex}-${cellIndex}`}
                      className={cn("px-4", columnClassNames?.[cellIndex])}
                    >
                      {cell}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
