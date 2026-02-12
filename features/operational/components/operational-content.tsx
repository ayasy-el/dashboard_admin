import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MonthSelect } from "@/features/shared/components/month-select";
import { SectionCards, type StatCard } from "@/features/shared/components/section-cards";
import { TableCard } from "@/features/shared/components/table-card";
import type { MonthOption } from "@/features/shared/get-month-options";

export type OperationalResponse = {
  month: string;
  monthLabel: string;
  previousMonth: string;
  previousMonthLabel: string;
  cards: {
    success: {
      current: number;
      previous: number;
      series: { date: string; value: number }[];
    };
    failed: {
      current: number;
      previous: number;
      series: { date: string; value: number }[];
    };
  };
  topMerchants: {
    merchant: string;
    keyword: string;
    totalTransactions: number;
    uniqMerchant: string;
    uniqRedeemer: number;
  }[];
  expiredRules: {
    merchant: string;
    keyword: string;
    startPeriod: string;
    endPeriod: string;
  }[];
};

const tableClassName =
  "[&_th]:px-5 [&_td]:px-5 [&_td]:py-3 [&_th]:h-14 [&_th:first-child]:pl-12 [&_td:first-child]:pl-12 [&_th:last-child]:pr-12 [&_td:last-child]:pr-12";

type OperationalContentProps = {
  data: OperationalResponse;
  monthOptions: MonthOption[];
  selectedMonth: string;
};

export function OperationalContent({ data, monthOptions, selectedMonth }: OperationalContentProps) {
  const stats: StatCard[] = [
    {
      id: "transaction-success",
      label: "Transaction Success",
      unit: "transaksi",
      currentTotal: data.cards.success.current,
      previousTotal: data.cards.success.previous,
      series: data.cards.success.series,
    },
    {
      id: "transaction-failed",
      label: "Transaction Failed",
      unit: "transaksi",
      currentTotal: data.cards.failed.current,
      previousTotal: data.cards.failed.previous,
      series: data.cards.failed.series,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 lg:px-6">
        <div className="text-sm font-medium text-muted-foreground">Ringkasan bulan</div>
        <MonthSelect value={selectedMonth} options={monthOptions} />
      </div>
      <SectionCards
        monthLabel={data.monthLabel}
        previousMonthLabel={data.previousMonthLabel}
        stats={stats}
        className="mx-auto w-full max-w-4xl px-0 sm:grid-cols-2 @xl/main:grid-cols-2 @5xl/main:grid-cols-2"
      />

      <div className="grid gap-6 px-4 lg:px-6">
        <TableCard title="Top Merchant">
          <Table className={tableClassName}>
            <TableHeader className="bg-muted/60 text-muted-foreground">
              <TableRow>
                <TableHead>Nama Merchant</TableHead>
                <TableHead>Uniq Merchant</TableHead>
                <TableHead>Keyword</TableHead>
                <TableHead>Jumlah Transaksi</TableHead>
                <TableHead>Uniq Redeemer</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.topMerchants.map((row) => (
                <TableRow key={`${row.merchant}-${row.keyword}`}>
                  <TableCell className="font-medium">{row.merchant}</TableCell>
                  <TableCell>{row.uniqMerchant}</TableCell>
                  <TableCell>{row.keyword}</TableCell>
                  <TableCell>{row.totalTransactions}</TableCell>
                  <TableCell>{row.uniqRedeemer}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>

        <TableCard title="Rule Expired Bulan Ini">
          <Table className={tableClassName}>
            <TableHeader className="bg-muted/60 text-muted-foreground">
              <TableRow>
                <TableHead>Nama Merchant</TableHead>
                <TableHead>Keyword</TableHead>
                <TableHead>Mulai</TableHead>
                <TableHead>Berakhir</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.expiredRules.map((row) => (
                <TableRow key={`${row.merchant}-${row.keyword}-${row.endPeriod}`}>
                  <TableCell className="font-medium">{row.merchant}</TableCell>
                  <TableCell>{row.keyword}</TableCell>
                  <TableCell>{row.startPeriod}</TableCell>
                  <TableCell>{row.endPeriod}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableCard>
      </div>
    </div>
  );
}
