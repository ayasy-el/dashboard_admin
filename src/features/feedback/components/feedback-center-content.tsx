"use client";

import * as React from "react";
import {
  IconAlertCircle,
  IconBan,
  IconChecks,
  IconClockHour4,
  IconFilter,
  IconMessageCircle,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import { useRouter } from "next/navigation";

import { useBindGlobalLoading } from "@/components/global-loading-provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type {
  FeedbackDashboardData,
  FeedbackEntry,
  FeedbackStatus,
  FeedbackType,
} from "@/features/feedback/feedback.repository";
import { cn } from "@/lib/utils";

type FeedbackCenterContentProps = {
  data: FeedbackDashboardData;
  onUpdate: (input: { id: string; status: FeedbackStatus; reply: string }) => Promise<{ ok: true }>;
};

const statusOptions: Array<{ value: "all" | FeedbackStatus; label: string }> = [
  { value: "all", label: "Semua status" },
  { value: "open", label: "Open" },
  { value: "in_progress", label: "In Progress" },
  { value: "resolved", label: "Resolved" },
  { value: "canceled", label: "Canceled" },
];

const typeOptions: Array<{ value: "all" | FeedbackType; label: string }> = [
  { value: "all", label: "Semua tipe" },
  { value: "report", label: "Report" },
  { value: "critic", label: "Critic" },
  { value: "suggestion", label: "Suggestion" },
];

const statusLabel: Record<FeedbackStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
  canceled: "Canceled",
};

const typeLabel: Record<FeedbackType, string> = {
  report: "Report",
  critic: "Critic",
  suggestion: "Suggestion",
};

const summaryCards = (summary: FeedbackDashboardData["summary"]) => [
  {
    id: "total",
    label: "Total Ticket",
    value: summary.total,
    description: "Seluruh feedback merchant",
    icon: IconMessageCircle,
    accent: "bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-300",
  },
  {
    id: "open",
    label: "Open",
    value: summary.open,
    description: "Belum diproses admin",
    icon: IconAlertCircle,
    accent: "bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300",
  },
  {
    id: "in-progress",
    label: "In Progress",
    value: summary.inProgress,
    description: "Sedang ditindaklanjuti",
    icon: IconClockHour4,
    accent: "bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  },
  {
    id: "resolved",
    label: "Resolved",
    value: summary.resolved,
    description: "Sudah selesai",
    icon: IconChecks,
    accent: "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
  },
  {
    id: "canceled",
    label: "Canceled",
    value: summary.canceled,
    description: "Dibatalkan merchant",
    icon: IconBan,
    accent: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  },
];

const formatDateTime = (value: string) =>
  new Date(value).toLocaleString("id-ID", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });

const getStatusBadgeClassName = (status: FeedbackStatus) => {
  if (status === "resolved") return "border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-300 dark:hover:bg-emerald-500/15";
  if (status === "in_progress") return "border-transparent bg-amber-100 text-amber-700 hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-300 dark:hover:bg-amber-500/15";
  if (status === "canceled") return "border-transparent bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/15";
  return "border-transparent bg-slate-100 text-slate-700 hover:bg-slate-100 dark:bg-white/10 dark:text-slate-200 dark:hover:bg-white/10";
};

const formatFileSize = (value: number | null) => {
  if (!value) return null;
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
};

const getTypeBadgeClassName = (type: FeedbackType) => {
  if (type === "report") return "border-transparent bg-rose-100 text-rose-700 hover:bg-rose-100 dark:bg-rose-500/15 dark:text-rose-300 dark:hover:bg-rose-500/15";
  if (type === "critic") return "border-transparent bg-orange-100 text-orange-700 hover:bg-orange-100 dark:bg-orange-500/15 dark:text-orange-300 dark:hover:bg-orange-500/15";
  return "border-transparent bg-sky-100 text-sky-700 hover:bg-sky-100 dark:bg-sky-500/15 dark:text-sky-300 dark:hover:bg-sky-500/15";
};

function SummaryCard({
  label,
  value,
  description,
  icon: Icon,
  accent,
}: {
  label: string;
  value: number;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
}) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div>
          <CardDescription className="text-xs font-semibold tracking-[0.24em] uppercase">
            {label}
          </CardDescription>
          <CardTitle className="mt-2 text-3xl font-bold tracking-tight">{value}</CardTitle>
        </div>
        <div className={cn("rounded-full p-3", accent)}>
          <Icon className="size-5" />
        </div>
      </CardHeader>
      <CardContent className="pt-0 text-sm text-muted-foreground">{description}</CardContent>
    </Card>
  );
}

function FeedbackTicketCard({
  item,
  onUpdate,
}: {
  item: FeedbackEntry;
  onUpdate: FeedbackCenterContentProps["onUpdate"];
}) {
  const router = useRouter();
  const [status, setStatus] = React.useState<FeedbackStatus>(item.status);
  const [reply, setReply] = React.useState(item.reply ?? "");
  const [isPending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  useBindGlobalLoading(isPending);

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    startTransition(() => {
      void onUpdate({ id: item.id, status, reply })
        .then(() => {
          router.refresh();
        })
        .catch((cause) => {
          setError(cause instanceof Error ? cause.message : "Gagal menyimpan update feedback.");
        });
    });
  };

  return (
    <Card className="overflow-hidden border-border/70 shadow-sm">
      <CardHeader className="gap-4 border-b bg-muted/20">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={getStatusBadgeClassName(status)}>{statusLabel[status]}</Badge>
              <Badge className={getTypeBadgeClassName(item.type)}>{typeLabel[item.type]}</Badge>
              <Badge variant="outline" className="bg-background">
                {item.category}
              </Badge>
              <Badge variant="outline" className="bg-background">
                #{item.id}
              </Badge>
            </div>
            <div>
              <CardTitle className="text-xl">{item.title}</CardTitle>
              <CardDescription className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                <span>{item.merchantName}</span>
                <span>{item.keyword}</span>
                <span>{item.userEmail}</span>
              </CardDescription>
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            <div>Dibuat: {formatDateTime(item.createdAt)}</div>
            <div>Update: {formatDateTime(item.updatedAt)}</div>
            <div>Uniq merchant: {item.uniqMerchant}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="grid gap-6 p-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <div className="space-y-4">
          <div>
            <div className="mb-2 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
              Pesan Merchant
            </div>
            <div className="rounded-2xl border bg-background px-4 py-3 text-sm leading-6 text-foreground">
              {item.message}
            </div>
          </div>
          {item.reply ? (
            <div>
              <div className="mb-2 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                Balasan Terakhir
              </div>
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 px-4 py-3 text-sm leading-6 text-emerald-950 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-100">
                <div>{item.reply}</div>
                {item.repliedAt ? (
                  <div className="mt-2 text-xs text-emerald-700 dark:text-emerald-300">
                    Dibalas pada {formatDateTime(item.repliedAt)}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
          {item.attachment ? (
            <div>
              <div className="mb-2 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
                Attachment
              </div>
              <a
                href={item.attachment.downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-xl border border-border bg-background px-4 py-3 text-sm font-medium text-blue-600 underline dark:text-blue-300"
              >
                {item.attachment.fileName || "View attachment"}
                {formatFileSize(item.attachment.size)
                  ? ` (${formatFileSize(item.attachment.size)})`
                  : ""}
              </a>
            </div>
          ) : null}
        </div>
        <form className="space-y-4 rounded-2xl border bg-card p-4" onSubmit={handleSubmit}>
          <div>
            <div className="mb-2 text-xs font-semibold tracking-[0.24em] text-muted-foreground uppercase">
              Tindak Lanjut Admin
            </div>
            <label
              className="mb-2 block text-sm font-medium text-foreground"
              htmlFor={`status-${item.id}`}
            >
              Status
            </label>
            <select
              id={`status-${item.id}`}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none"
              value={status}
              onChange={(event) => setStatus(event.target.value as FeedbackStatus)}
              disabled={isPending}
            >
              {statusOptions
                .filter((option) => option.value !== "all")
                .map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label
              className="mb-2 block text-sm font-medium text-foreground"
              htmlFor={`reply-${item.id}`}
            >
              Reply ke Merchant
            </label>
            <textarea
              id={`reply-${item.id}`}
              className="min-h-32 w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-xs outline-none"
              value={reply}
              onChange={(event) => setReply(event.target.value)}
              placeholder="Tulis tindak lanjut, klarifikasi, atau solusi untuk merchant."
              disabled={isPending}
            />
          </div>
          {error ? <div className="text-sm text-rose-600 dark:text-rose-300">{error}</div> : null}
          <Button type="submit" className="w-full" disabled={isPending}>
            {isPending ? "Menyimpan..." : "Submit"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

export function FeedbackCenterContent({ data, onUpdate }: FeedbackCenterContentProps) {
  const [query, setQuery] = React.useState("");
  const [status, setStatus] = React.useState<"all" | FeedbackStatus>("all");
  const [type, setType] = React.useState<"all" | FeedbackType>("all");
  const deferredQuery = React.useDeferredValue(query);

  const filteredFeedback = React.useMemo(() => {
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return data.feedback.filter((item) => {
      if (status !== "all" && item.status !== status) {
        return false;
      }
      if (type !== "all" && item.type !== type) {
        return false;
      }
      if (!normalizedQuery) {
        return true;
      }

      const haystack = [
        item.id,
        item.keyword,
        item.merchantName,
        item.uniqMerchant,
        item.userEmail,
        item.username,
        item.title,
        item.category,
        item.message,
        item.attachment?.fileName,
        item.reply,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [data.feedback, deferredQuery, status, type]);

  return (
    <div className="space-y-6 px-4 pb-8 lg:px-6">
      <div className="rounded-3xl border border-border/70 bg-gradient-to-r from-background via-background to-sky-500/10 px-6 py-5 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <div className="text-sm font-semibold tracking-[0.24em] text-primary uppercase">
              Feedback Center
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground">
              Feedback From Merchant
            </h1>
          </div>
          <Badge variant="outline" className="w-fit bg-background px-3 py-1 text-sm">
            {filteredFeedback.length} tiket tampil
          </Badge>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {summaryCards(data.summary).map((card) => (
          <SummaryCard key={card.id} {...card} />
        ))}
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <IconFilter className="size-5 text-primary" />
            Filter Ticket
          </CardTitle>
          <CardDescription>
            Cari berdasarkan merchant, keyword, email, judul, atau isi feedback.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_220px]">
          <div className="relative">
            <IconSearch className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cari feedback..."
              className="pl-9"
            />
          </div>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none"
            value={status}
            onChange={(event) => setStatus(event.target.value as "all" | FeedbackStatus)}
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <select
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-xs outline-none"
            value={type}
            onChange={(event) => setType(event.target.value as "all" | FeedbackType)}
          >
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      <div className="space-y-4">
        {filteredFeedback.length > 0 ? (
          filteredFeedback.map((item) => (
            <FeedbackTicketCard key={item.id} item={item} onUpdate={onUpdate} />
          ))
        ) : (
          <Card className="border-dashed shadow-sm">
            <CardContent className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <div className="rounded-full bg-muted p-4 text-muted-foreground">
                <IconRefresh className="size-6" />
              </div>
              <div>
                <div className="font-semibold">Tidak ada feedback yang cocok</div>
                <div className="text-sm text-muted-foreground">
                  Ubah kata kunci atau filter status/tipe untuk melihat tiket lain.
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
