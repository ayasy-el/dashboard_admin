"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";

import { DashboardPageShell } from "@/features/shared/components/dashboard-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import {
  getBatches,
  getBatchDetail,
  getRejected,
  uploadBatch,
  rerunBatch,
  ignoreRejected,
  solveRejected,
  downloadSource,
} from "./actions";
import type { BatchDetail, BatchListItem, Dataset, RejectedRow } from "./types";

type IngestionClientProps = {
  initialBatches: BatchListItem[];
  initialError?: string | null;
};

const DATASETS: Dataset[] = ["master", "transactions", "total_point", "list_kota"];
const RERUN_ALLOWED_STATUSES = new Set(["FAILED_STAGE", "FAILED_LOAD", "FAILED_QUALITY", "SUCCESS"]);
const CONFLICT_INFO_FIELDS = ["keyword", "merchant_name", "category", "cluster"];
const CONFLICT_CHANGE_FIELDS = ["uniq_merchant", "start_period", "end_period", "point_redeem"];

const prettyLabel = (key: string) =>
  key
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());

const toText = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
};

const conflictSearchBlob = (row: RejectedRow) => {
  const incoming = row.conflict?.incoming ?? {};
  const existing = row.conflict?.existing ?? [];
  return `${JSON.stringify(incoming)} ${JSON.stringify(existing)}`.toLowerCase();
};

const COMPACT_CONFLICT_FIELDS = [...CONFLICT_INFO_FIELDS, ...CONFLICT_CHANGE_FIELDS];
const normalized = (value: unknown) => toText(value).trim().toLowerCase();
const fieldChanged = (incoming: Record<string, unknown>, existing: Record<string, unknown>, field: string) =>
  normalized(incoming[field]) !== normalized(existing[field]);

const resolveSuggestion = (row: RejectedRow) => {
  if (row.resolution?.help) return row.resolution.help;
  const msg = row.error_message.toLowerCase();
  if (msg.includes("cluster tidak ditemukan")) return "Upload/refresh list_kota dulu, lalu Solve & Apply.";
  if (msg.includes("cluster ambigu")) return "Pastikan nama cluster unik di list_kota.";
  if (msg.includes("merchant tidak ditemukan")) return "Upload master terlebih dahulu agar keyword tersedia.";
  if (msg.includes("rule tidak ditemukan")) return "Periksa period/rule di master lalu rerun.";
  if (msg.includes("end_period lebih pendek")) return "Perpanjang end_period atau Ignore jika data lama valid.";
  return "Perbaiki data sumber lalu klik Solve & Apply.";
};

const base64ToBlob = (base64: string, contentType?: string | null) => {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: contentType ?? "application/octet-stream" });
};

export default function IngestionClient({ initialBatches, initialError = null }: IngestionClientProps) {
  const [dataset, setDataset] = useState<Dataset>("transactions");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(initialError);

  const [batches, setBatches] = useState<BatchListItem[]>(initialBatches);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchDetail, setBatchDetail] = useState<BatchDetail | null>(null);
  const [rejected, setRejected] = useState<RejectedRow[]>([]);
  const [selectedRejectedIds, setSelectedRejectedIds] = useState<number[]>([]);
  const [expandedComparisonIds, setExpandedComparisonIds] = useState<number[]>([]);
  const [loadingIssueResolution, setLoadingIssueResolution] = useState(false);
  const [issueSearch, setIssueSearch] = useState("");
  const [issueTypeFilter, setIssueTypeFilter] = useState("ALL");
  const [issueSolveFilter, setIssueSolveFilter] = useState("ALL");

  const loadBatches = useCallback(async () => {
    const data = await getBatches();
    setBatches(data);
  }, []);

  const loadBatchDetail = useCallback(async (batchId: string) => {
    setLoadingIssueResolution(true);
    try {
      const [statusData, rejectedData] = await Promise.all([getBatchDetail(batchId), getRejected(batchId)]);
      setBatchDetail(statusData);
      setRejected(rejectedData);
      setSelectedRejectedIds([]);
      setExpandedComparisonIds([]);
    } finally {
      setLoadingIssueResolution(false);
    }
  }, []);

  const refreshAll = useCallback(async () => {
    await loadBatches();
    if (selectedBatchId) {
      await loadBatchDetail(selectedBatchId);
    }
  }, [loadBatches, loadBatchDetail, selectedBatchId]);

  useEffect(() => {
    if (initialBatches.length === 0 && !initialError) {
      void loadBatches();
    }
  }, [initialBatches.length, initialError, loadBatches]);

  const onUpload = async () => {
    if (!file) {
      setError("Pilih file CSV terlebih dahulu.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const body = await uploadBatch(dataset, formData);
      const batchId = body.batch_id as string;
      setSelectedBatchId(batchId);
      await loadBatches();
      await loadBatchDetail(batchId);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload gagal");
    } finally {
      setBusy(false);
    }
  };

  const onIgnore = async (rejectedId: number) => {
    if (!selectedBatchId) return;
    setBusy(true);
    try {
      await ignoreRejected(selectedBatchId, rejectedId);
      await loadBatchDetail(selectedBatchId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal ignore rejected row");
    } finally {
      setBusy(false);
    }
  };

  const onSolve = async (rejectedId: number) => {
    if (!selectedBatchId) return;
    setBusy(true);
    try {
      await solveRejected(selectedBatchId, rejectedId);
      await loadBatchDetail(selectedBatchId);
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal solve rejected row");
    } finally {
      setBusy(false);
    }
  };

  const onRerun = async (batchId: string) => {
    setBusy(true);
    setError(null);
    try {
      const body = await rerunBatch(batchId);
      const newBatchId = body?.new_batch_id;
      await loadBatches();
      if (newBatchId) {
        setSelectedBatchId(newBatchId);
        await loadBatchDetail(newBatchId);
      } else if (selectedBatchId === batchId) {
        await loadBatchDetail(batchId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal rerun batch");
    } finally {
      setBusy(false);
    }
  };

  const onDownloadSource = async (batchId: string) => {
    setBusy(true);
    setError(null);
    try {
      const { filename, contentType, base64 } = await downloadSource(batchId);
      const blob = base64ToBlob(base64, contentType);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename ?? `source-${batchId}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal download source");
    } finally {
      setBusy(false);
    }
  };

  const onToggleRejected = (rejectedId: number, checked: boolean) => {
    setSelectedRejectedIds((prev) => {
      if (checked) return [...new Set([...prev, rejectedId])];
      return prev.filter((id) => id !== rejectedId);
    });
  };

  const onToggleAllRejected = (checked: boolean) => {
    if (!checked) {
      const filteredIds = new Set(filteredRejected.map((row) => row.id));
      setSelectedRejectedIds((prev) => prev.filter((id) => !filteredIds.has(id)));
      return;
    }
    setSelectedRejectedIds((prev) => [...new Set([...prev, ...filteredRejected.map((row) => row.id)])]);
  };

  const onToggleComparison = (rejectedId: number) => {
    setExpandedComparisonIds((prev) =>
      prev.includes(rejectedId) ? prev.filter((id) => id !== rejectedId) : [...prev, rejectedId],
    );
  };

  const onBulkIgnore = async () => {
    if (!selectedBatchId || selectedRejectedIds.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await Promise.all(
        selectedRejectedIds.map(async (rejectedId) => {
          await ignoreRejected(selectedBatchId, rejectedId);
        }),
      );
      await loadBatchDetail(selectedBatchId);
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal bulk ignore");
    } finally {
      setBusy(false);
    }
  };

  const onBulkSolve = async () => {
    if (!selectedBatchId || selectedRejectedIds.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await Promise.all(
        selectedRejectedIds.map(async (rejectedId) => {
          const row = rejected.find((item) => item.id === rejectedId);
          if (!row?.resolution?.can_solve) return;
          await solveRejected(selectedBatchId, rejectedId);
        }),
      );
      await loadBatchDetail(selectedBatchId);
      await loadBatches();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal bulk solve");
    } finally {
      setBusy(false);
    }
  };

  const formatBatchTime = (value?: string | null) => {
    if (!value) return "-";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return parsed.toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const selectedBatchLabel = useMemo(
    () => (selectedBatchId ? `Selected batch: ${selectedBatchId}` : "Pilih batch dari tabel di bawah"),
    [selectedBatchId],
  );

  const issueTypes = useMemo(
    () => ["ALL", ...Array.from(new Set(rejected.map((row) => row.error_type))).sort()],
    [rejected],
  );

  const filteredRejected = useMemo(() => {
    return rejected.filter((row) => {
      const search = issueSearch.trim().toLowerCase();
      const conflictBlob = conflictSearchBlob(row);
      const matchesSearch =
        search.length === 0 ||
        row.error_message.toLowerCase().includes(search) ||
        String(row.row_num).includes(search) ||
        row.error_type.toLowerCase().includes(search) ||
        conflictBlob.includes(search);
      const matchesType = issueTypeFilter === "ALL" || row.error_type === issueTypeFilter;
      const matchesSolve =
        issueSolveFilter === "ALL" ||
        (issueSolveFilter === "SOLVABLE" && Boolean(row.resolution?.can_solve)) ||
        (issueSolveFilter === "MANUAL" && !row.resolution?.can_solve);
      return matchesSearch && matchesType && matchesSolve;
    });
  }, [rejected, issueSearch, issueTypeFilter, issueSolveFilter]);

  return (
    <DashboardPageShell sidebarWidth="16rem">
      <div className="grid min-w-0 gap-4 bg-gradient-to-b from-background via-background to-rose-50/20 px-4 pb-6 lg:px-6">
        <Card className="min-w-0 gap-0 overflow-hidden border border-rose-200/70 bg-gradient-to-br from-card to-rose-50/40 py-0 shadow-sm">
          <CardHeader className="border-b px-6 py-5">
            <CardTitle>CSV Ingestion Admin</CardTitle>
            <CardDescription>
              Upload CSV, monitor status batch, lihat conflict/error/rejected, lalu pilih Ignore atau Solve & Apply.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 px-6 py-5">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto_auto] lg:items-center">
              <select
                className="h-10 w-full rounded-md border px-3 text-sm"
                value={dataset}
                onChange={(e) => setDataset(e.target.value as Dataset)}
                disabled={busy}
              >
                {DATASETS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
              <Input
                type="file"
                accept=".csv"
                className="h-10 w-full"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                disabled={busy}
              />
              <Button className="h-10 w-full cursor-pointer sm:w-auto disabled:cursor-not-allowed" onClick={onUpload} disabled={busy || !file}>
                {busy ? "Processing..." : "Upload & Run"}
              </Button>
              <Button
                className="h-10 w-full cursor-pointer sm:w-auto disabled:cursor-not-allowed"
                variant="outline"
                onClick={() => void refreshAll()}
                disabled={busy}
              >
                Refresh
              </Button>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <p className="text-sm text-foreground/75">{selectedBatchLabel}</p>
          </CardContent>
        </Card>

        <Card className="min-w-0 gap-0 overflow-hidden border border-border/80 bg-card/95 py-0 shadow-sm">
          <CardHeader className="border-b px-6 py-5">
            <CardTitle>Batch Monitoring</CardTitle>
            <CardDescription>Klik baris untuk memilih batch dan melihat detail issue di bawah.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2"></th>
                    <th className="p-2">Batch</th>
                    <th className="p-2">Dataset</th>
                    <th className="p-2">Status</th>
                    <th className="p-2">Loaded</th>
                    <th className="p-2">Rejected</th>
                    <th className="p-2">Reject Rate</th>
                    <th className="p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => {
                    const isSelected = selectedBatchId === batch.batch_id;
                    return (
                      <tr
                        key={batch.batch_id}
                        className={`cursor-pointer transition-colors ${
                          isSelected ? "bg-rose-50/70 ring-1 ring-inset ring-rose-300" : "hover:bg-slate-50"
                        }`}
                        title="Klik baris untuk pilih batch"
                        aria-selected={isSelected}
                        onClick={() => {
                          setSelectedBatchId(batch.batch_id);
                          void loadBatchDetail(batch.batch_id);
                        }}
                      >
                        <td className="p-2">
                          <span
                            className={`inline-flex h-5 w-5 items-center justify-center rounded-full border ${
                              isSelected ? "border-rose-500 bg-rose-100" : "border-slate-300 bg-white"
                            }`}
                          >
                            <span className={`h-2 w-2 rounded-full ${isSelected ? "bg-rose-600" : "bg-transparent"}`} />
                          </span>
                        </td>
                        <td className="p-2 font-mono text-xs">{batch.batch_id}</td>
                        <td className="p-2">{batch.dataset}</td>
                        <td className="p-2">{batch.status}</td>
                        <td className="p-2">{batch.loaded_rows}</td>
                        <td className="p-2">{batch.rejected_rows}</td>
                        <td className="p-2">{(Number(batch.reject_rate || 0) * 100).toFixed(2)}%</td>
                        <td className="p-2">
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="h-9 w-9 cursor-pointer p-0 disabled:cursor-not-allowed"
                              variant="outline"
                              title={`Download source ${batch.batch_id}`}
                              aria-label={`Download source ${batch.batch_id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void onDownloadSource(batch.batch_id);
                              }}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M12 3v12" />
                                <path d="m7 10 5 5 5-5" />
                                <path d="M5 21h14" />
                              </svg>
                            </Button>
                            <Button
                              size="sm"
                              className="h-9 w-9 cursor-pointer p-0 disabled:cursor-not-allowed"
                              variant="outline"
                              disabled={busy || !RERUN_ALLOWED_STATUSES.has(batch.status)}
                              title={`Rerun batch ${batch.batch_id}`}
                              aria-label={`Rerun batch ${batch.batch_id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                void onRerun(batch.batch_id);
                              }}
                            >
                              <svg
                                viewBox="0 0 24 24"
                                className="h-4 w-4"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                              >
                                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                                <path d="M21 3v6h-6" />
                              </svg>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card className="min-w-0 gap-0 overflow-hidden border border-border/80 bg-card/95 py-0 shadow-sm">
          <CardHeader className="border-b px-6 py-5">
            <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <CardTitle>Issue Resolution</CardTitle>
                <CardDescription className="mt-2 text-sm text-foreground/70">
                  {loadingIssueResolution ? (
                    <span className="inline-block h-5 w-[32rem] max-w-full animate-pulse rounded bg-slate-200/80" />
                  ) : batchDetail ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="text-rose-600">●</span>
                      <span>status={batchDetail.status}</span>
                      <span className="text-muted-foreground">|</span>
                      <span>failed_step={batchDetail.failed_step ?? "-"}</span>
                      <span className="text-muted-foreground">|</span>
                      <span>total={batchDetail.metrics.total}</span>
                      <span className="text-muted-foreground">|</span>
                      <span className="font-semibold text-emerald-700">loaded={batchDetail.metrics.loaded}</span>
                      <span className="text-muted-foreground">|</span>
                      <span className="font-semibold text-rose-700">rejected={batchDetail.metrics.rejected}</span>
                      <span className="text-muted-foreground">|</span>
                      <span>created_at={formatBatchTime(batchDetail.created_at)}</span>
                      <span className="text-muted-foreground">|</span>
                      <span>updated_at={formatBatchTime(batchDetail.updated_at)}</span>
                    </span>
                  ) : (
                    "Pilih batch untuk melihat detail conflict/error/rejected."
                  )}
                </CardDescription>
              </div>
              <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                <Button
                  size="sm"
                  className="h-10 w-full cursor-pointer sm:w-auto disabled:cursor-not-allowed"
                  variant="outline"
                  disabled={busy || loadingIssueResolution || selectedRejectedIds.length === 0}
                  onClick={() => void onBulkIgnore()}
                >
                  Ignore All
                </Button>
                <Button
                  size="sm"
                  className="h-10 w-full cursor-pointer sm:w-auto disabled:cursor-not-allowed"
                  disabled={busy || loadingIssueResolution || selectedRejectedIds.length === 0}
                  onClick={() => void onBulkSolve()}
                >
                  Solve All Selected
                </Button>
              </div>
            </div>
            <CardDescription>
              {loadingIssueResolution
                ? "Loading issues..."
                : selectedRejectedIds.length > 0
                  ? `${selectedRejectedIds.length} row selected`
                  : "Belum ada row yang dipilih."}
            </CardDescription>
          </CardHeader>
          <CardContent className="px-6 py-5">
            <div className="mb-4 grid min-w-0 gap-2 sm:grid-cols-2 lg:grid-cols-[1.4fr_0.8fr_0.8fr]">
              <Input
                placeholder="Cari row/type/error..."
                className="h-11"
                value={issueSearch}
                onChange={(e) => setIssueSearch(e.target.value)}
                disabled={busy}
              />
              <select
                className="h-11 w-full rounded-md border px-3 text-sm"
                value={issueTypeFilter}
                onChange={(e) => setIssueTypeFilter(e.target.value)}
                disabled={busy}
              >
                {issueTypes.map((item) => (
                  <option key={item} value={item}>
                    {item === "ALL" ? "All Error Types" : item}
                  </option>
                ))}
              </select>
              <select
                className="h-11 w-full rounded-md border px-3 text-sm"
                value={issueSolveFilter}
                onChange={(e) => setIssueSolveFilter(e.target.value)}
                disabled={busy}
              >
                <option value="ALL">All Solveability</option>
                <option value="SOLVABLE">Auto Solvable</option>
                <option value="MANUAL">Manual Required</option>
              </select>
            </div>
            {batchDetail?.failed_reason ? (
              <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {batchDetail.failed_reason}
              </div>
            ) : null}
            <div className="mb-3">
              <label className="inline-flex items-center gap-2 text-sm text-foreground/80">
                <input
                  type="checkbox"
                  checked={filteredRejected.length > 0 && filteredRejected.every((row) => selectedRejectedIds.includes(row.id))}
                  onChange={(e) => onToggleAllRejected(e.target.checked)}
                  disabled={busy || loadingIssueResolution || filteredRejected.length === 0}
                />
                Select all shown issue
              </label>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border/80">
              <table className="min-w-[1120px] w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-100/80 text-left text-xs tracking-wide text-slate-600 uppercase">
                    <th className="p-3">Pick</th>
                    <th className="p-3">Row</th>
                    <th className="p-3">Type</th>
                    <th className="p-3">Error Description</th>
                    <th className="p-3">Suggested Solve</th>
                    <th className="p-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loadingIssueResolution ? (
                    Array.from({ length: 3 }).map((_, idx) => (
                      <tr key={`issue-skeleton-${idx}`} className="border-b">
                        <td className="p-3" colSpan={6}>
                          <div className="space-y-2">
                            <div className="h-4 w-1/4 animate-pulse rounded bg-slate-200/80" />
                            <div className="h-4 w-11/12 animate-pulse rounded bg-slate-200/70" />
                            <div className="h-4 w-9/12 animate-pulse rounded bg-slate-200/60" />
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : filteredRejected.length === 0 ? (
                    <tr>
                      <td className="p-6 text-center text-sm text-muted-foreground" colSpan={6}>
                        Tidak ada issue sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRejected.map((row) => {
                      const incoming = row.conflict?.incoming ?? null;
                      const existingList = row.conflict?.existing ?? [];
                      const existing = existingList[0] ?? null;
                      const hasComparison = Boolean(incoming || existing);
                      const isComparisonExpanded = expandedComparisonIds.includes(row.id);
                      const visibleConflictFields = COMPACT_CONFLICT_FIELDS.filter((field) => {
                        const incomingValue = incoming ? toText(incoming[field]) : "-";
                        const existingValue = existing ? toText(existing[field]) : "-";
                        return incomingValue !== "-" || existingValue !== "-";
                      });
                      const changedFields =
                        incoming && existing
                          ? visibleConflictFields.filter((field) => fieldChanged(incoming, existing, field))
                          : [];
                      const hasValueChanges = changedFields.length > 0;
                      const changedValuePairs =
                        incoming && existing
                          ? changedFields.map((field) => ({
                              field: prettyLabel(field),
                              before: toText(existing[field]),
                              after: toText(incoming[field]),
                            }))
                          : [];
                      const comparisonKeyword = incoming ? toText(incoming.keyword) : existing ? toText(existing.keyword) : "-";

                      return (
                        <Fragment key={`issue-${row.id}`}>
                          <tr className="border-b align-top hover:bg-slate-50/70">
                            <td className="p-3">
                              <input
                                type="checkbox"
                                checked={selectedRejectedIds.includes(row.id)}
                                onChange={(e) => onToggleRejected(row.id, e.target.checked)}
                                disabled={busy}
                              />
                            </td>
                            <td className="p-3 font-semibold text-foreground">Row {row.row_num}</td>
                            <td className="p-3">
                              <span className="rounded-md bg-slate-200 px-2 py-1 text-xs font-semibold tracking-wide text-slate-700">
                                {row.error_type}
                              </span>
                            </td>
                            <td className="p-3 max-w-[28rem] break-words text-foreground/90">{row.error_message}</td>
                            <td className="p-3 max-w-[22rem] break-words text-foreground/80">{resolveSuggestion(row)}</td>
                            <td className="p-3">
                              <div className="flex flex-col gap-2">
                                <Button
                                  size="sm"
                                  className="h-9 w-full cursor-pointer disabled:cursor-not-allowed"
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() => void onIgnore(row.id)}
                                >
                                  Ignore
                                </Button>
                                <Button
                                  size="sm"
                                  className="h-9 w-full cursor-pointer disabled:cursor-not-allowed"
                                  disabled={busy || !row.resolution?.can_solve}
                                  onClick={() => void onSolve(row.id)}
                                  title={row.resolution?.can_solve ? "Apply solve ke database" : row.resolution?.help ?? "Tidak bisa auto-solve"}
                                >
                                  Solve & Apply
                                </Button>
                              </div>
                            </td>
                          </tr>
                          {hasComparison && hasValueChanges ? (
                            <tr className="border-b bg-slate-50/60">
                              <td className="p-3" colSpan={6}>
                                <button
                                  type="button"
                                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-3 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
                                  onClick={() => onToggleComparison(row.id)}
                                  aria-expanded={isComparisonExpanded}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex min-w-0 items-center gap-2">
                                        <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-100 text-xs font-semibold text-slate-600">
                                          <svg
                                            viewBox="0 0 24 24"
                                            className={`h-3.5 w-3.5 transition-transform ${isComparisonExpanded ? "rotate-90" : ""}`}
                                            fill="none"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            aria-hidden="true"
                                          >
                                            <path d="M9 6l6 6-6 6" />
                                          </svg>
                                        </span>
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-slate-600 uppercase">
                                          Keyword
                                        </span>
                                        <span className="truncate font-mono text-sm font-semibold text-slate-800">{comparisonKeyword}</span>
                                      </div>
                                      <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-8">
                                        {changedValuePairs.length > 0 ? (
                                          changedValuePairs.map((item) => (
                                            <span
                                              key={`diff-summary-${row.id}-${item.field}`}
                                              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-1 text-xs"
                                            >
                                              <span className="font-medium text-slate-600">{item.field}</span>
                                              <span className="max-w-[8rem] truncate rounded bg-rose-100 px-1 py-0.5 font-mono text-rose-700">
                                                {item.before}
                                              </span>
                                              <span className="text-slate-400">-&gt;</span>
                                              <span className="max-w-[8rem] truncate rounded bg-emerald-100 px-1 py-0.5 font-mono text-emerald-700">
                                                {item.after}
                                              </span>
                                            </span>
                                          ))
                                        ) : (
                                          <span className="text-xs text-slate-500">Tidak ada perubahan nilai.</span>
                                        )}
                                      </div>
                                    </div>
                                    <span className="shrink-0 rounded-full bg-rose-100 px-2 py-1 text-xs font-semibold tracking-wide text-rose-700 uppercase">
                                      {changedFields.length} changed
                                    </span>
                                  </div>
                                </button>
                                {isComparisonExpanded ? (
                                  <div className="mt-2 overflow-x-auto rounded-lg border">
                                    <table className="min-w-[860px] w-full">
                                      <thead>
                                        <tr className="border-b bg-slate-100 text-xs uppercase tracking-wide text-slate-600">
                                          <th className="p-2.5 text-left">Field Name</th>
                                          <th className="p-2.5 text-left text-emerald-700">Incoming Data</th>
                                          <th className="p-2.5 text-left text-amber-700">Existing Data</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {visibleConflictFields.map((field) => {
                                          const changed = incoming && existing ? fieldChanged(incoming, existing, field) : false;
                                          return (
                                            <tr key={`compare-row-${row.id}-${field}`} className={`border-b ${changed ? "bg-rose-50/50" : ""}`}>
                                              <td className={`p-2.5 text-sm font-medium ${changed ? "text-rose-700" : "text-slate-600"}`}>
                                                {prettyLabel(field)}
                                              </td>
                                              <td className="p-2.5 text-sm text-foreground">
                                                <div className="flex items-center gap-2">
                                                  <span className="break-words">{incoming ? toText(incoming[field]) : "-"}</span>
                                                  {changed ? (
                                                    <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white uppercase">
                                                      Changed
                                                    </span>
                                                  ) : null}
                                                </div>
                                              </td>
                                              <td className={`p-2.5 text-sm ${changed ? "text-slate-400 line-through" : "text-slate-500"}`}>
                                                {existing ? toText(existing[field]) : "-"}
                                              </td>
                                            </tr>
                                          );
                                        })}
                                      </tbody>
                                    </table>
                                  </div>
                                ) : null}
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardPageShell>
  );
}
