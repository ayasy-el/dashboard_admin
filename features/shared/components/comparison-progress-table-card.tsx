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
  leftBarColor?: (index: number) => string;
  rightBarColor?: (index: number) => string;
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
  leftBarColor = (index) => (index === 0 ? "bg-primary" : "bg-primary/70"),
  rightBarColor = (index) => (index === 0 ? "bg-secondary" : "bg-secondary/80"),
}: ComparisonProgressTableCardProps) {
  return (
    <Card className={cn("gap-0 border border-border/80 py-0 shadow-sm", className)}>
      <CardHeader className="px-6 py-5">
        <CardTitle className="flex items-center gap-1 text-lg">
          {title}
          {icon}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-muted/40">
                <TableHead className="px-4">{headers[0]}</TableHead>
                <TableHead className="px-4 text-center">{headers[1]}</TableHead>
                <TableHead className="px-4">{headers[2]}</TableHead>
                <TableHead className="px-4">{headers[3]}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={row.id}>
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
                      <ProgressBar width={row.left.width} className={leftBarColor(index)} />
                    </div>
                  </TableCell>
                  <TableCell className="px-4">
                    <div className="flex items-center gap-2">
                      <span className="w-14 text-right tabular-nums">{row.right.value}</span>
                      <ProgressBar width={row.right.width} className={rightBarColor(index)} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
