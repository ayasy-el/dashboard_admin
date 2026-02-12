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

type RankedMetricsRow = [React.ReactNode, React.ReactNode, React.ReactNode, React.ReactNode];

type RankedMetricsTableCardProps = {
  title: React.ReactNode;
  icon?: React.ReactNode;
  tone: "green" | "yellow" | "red";
  headerCols: [React.ReactNode, React.ReactNode, React.ReactNode, React.ReactNode];
  rows: RankedMetricsRow[];
  className?: string;
  rankHeader?: React.ReactNode;
};

export function RankedMetricsTableCard({
  title,
  icon,
  tone,
  headerCols,
  rows,
  className,
  rankHeader = "#",
}: RankedMetricsTableCardProps) {
  const toneClass =
    tone === "green" ? "bg-green-50/40" : tone === "yellow" ? "bg-yellow-50/40" : "bg-red-50/40";

  return (
    <Card className={cn("gap-0 overflow-hidden border border-border/80 py-0 shadow-sm", className)}>
      <CardHeader className={cn("border-b px-4 py-4", toneClass)}>
        <CardTitle className="flex items-center gap-1 text-base">
          {title}
          {icon}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="w-10 px-3 text-center">{rankHeader}</TableHead>
              <TableHead className="px-3">{headerCols[0]}</TableHead>
              <TableHead className="px-3 text-right">{headerCols[1]}</TableHead>
              <TableHead className="px-3 text-right">{headerCols[2]}</TableHead>
              <TableHead className="px-3 text-right">{headerCols[3]}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, index) => (
              <TableRow key={`${String(title)}-${index}`}>
                <TableCell className="px-3 text-center font-medium tabular-nums">
                  {index + 1}
                </TableCell>
                <TableCell className="px-3 font-medium">{row[0]}</TableCell>
                <TableCell className="px-3 text-right">{row[1]}</TableCell>
                <TableCell className="px-3 text-right">{row[2]}</TableCell>
                <TableCell className="px-3 text-right">{row[3]}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
