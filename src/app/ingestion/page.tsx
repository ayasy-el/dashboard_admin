"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { DashboardPageShell } from "@/features/shared/components/dashboard-page-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Dataset = "master" | "transactions" | "total_point" | "list_kota";

type BatchListItem = {
  batch_id: string;
  dataset: string;
  status: string;
  failed_step: string | null;
  total_rows: number;
  loaded_rows: number;
  rejected_rows: number;
  reject_rate: number;
  created_at: string;
  updated_at: string;
  run_count: number;
};

type BatchDetail = {
  batch_id: string;
  dataset: string;
  status: string;
  failed_step: string | null;
  failed_reason: string | null;
  metrics: {
    total: number;
    loaded: number;
    rejected: number;
    reject_rate: number;
  };
  run_count: number;
  created_at: string;
  updated_at: string;
};

type RejectedRow = {
  id: number;
  batch_id: string;
  dataset: string;
  row_num: number;
  error_type: string;
  error_message: string;
  raw_payload: Record<string, unknown>;
  created_at: string;
  resolution?: {
    can_solve: boolean;
    solve_mode: string;
    label: string;
    help: string;
  };
  conflict?: {
    incoming?: Record<string, unknown>;
    existing?: Array<Record<string, unknown>>;
  };
};

const DATASETS: Dataset[] = ["master", "transactions", "total_point", "list_kota"];
const API_BASE = process.env.NEXT_PUBLIC_INGESTION_API_URL ?? "http://127.0.0.1:8001";
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

const normalized = (value: unknown) => toText(value).trim().toLowerCase();

const infoFieldList = () => CONFLICT_INFO_FIELDS;
const isChanged = (incoming: Record<string, unknown>, existing: Record<string, unknown>, field: string) =>
  normalized(incoming[field]) !== normalized(existing[field]);

const incomingChangedFieldList = (incoming: Record<string, unknown>, existing: Array<Record<string, unknown>>) =>
  CONFLICT_CHANGE_FIELDS.filter((field) => {
    if (!(field in incoming) && existing.every((item) => !(field in item))) return false;
    if (existing.length === 0) return true;
    const inc = normalized(incoming[field]);
    return existing.some((item) => normalized(item[field]) !== inc);
  });

const existingChangedFieldList = (incoming: Record<string, unknown>, existing: Record<string, unknown>) =>
  CONFLICT_CHANGE_FIELDS.filter((field) => {
    if (!(field in existing) && !(field in incoming)) return false;
    if (!(field in incoming)) return true;
    return normalized(existing[field]) !== normalized(incoming[field]);
  });

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

export default function IngestionPage() {
  const [dataset, setDataset] = useState<Dataset>("transactions");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [batches, setBatches] = useState<BatchListItem[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [batchDetail, setBatchDetail] = useState<BatchDetail | null>(null);
  const [rejected, setRejected] = useState<RejectedRow[]>([]);
  const [selectedRejectedIds, setSelectedRejectedIds] = useState<number[]>([]);
  const [issueSearch, setIssueSearch] = useState("");
  const [issueTypeFilter, setIssueTypeFilter] = useState("ALL");
  const [issueSolveFilter, setIssueSolveFilter] = useState("ALL");

  const loadBatches = useCallback(async () => {
    const res = await fetch(`${API_BASE}/ingest`, { cache: "no-store" });
    if (!res.ok) throw new Error("Gagal mengambil daftar batch");
    const data = await res.json();
    setBatches(data.items ?? []);
  }, []);

  const loadBatchDetail = useCallback(async (batchId: string) => {
    const [statusRes, rejectedRes] = await Promise.all([
      fetch(`${API_BASE}/ingest/${batchId}`, { cache: "no-store" }),
      fetch(`${API_BASE}/ingest/${batchId}/rejected`, { cache: "no-store" }),
    ]);

    if (!statusRes.ok) throw new Error("Gagal mengambil detail batch");
    if (!rejectedRes.ok) throw new Error("Gagal mengambil rejected rows");

    const statusData = (await statusRes.json()) as BatchDetail;
    const rejectedData = await rejectedRes.json();

    setBatchDetail(statusData);
    setRejected(rejectedData.items ?? []);
    setSelectedRejectedIds([]);
  }, []);

  const refreshAll = useCallback(async () => {
    await loadBatches();
    if (selectedBatchId) {
      await loadBatchDetail(selectedBatchId);
    }
  }, [loadBatches, loadBatchDetail, selectedBatchId]);

  useEffect(() => {
    void loadBatches();
  }, [loadBatches]);

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

      const res = await fetch(`${API_BASE}/ingest/${dataset}`, {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(body || "Upload gagal");
      }
      const body = await res.json();
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
      const res = await fetch(`${API_BASE}/ingest/${selectedBatchId}/rejected/${rejectedId}/ignore`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Gagal ignore rejected row");
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
      const res = await fetch(`${API_BASE}/ingest/${selectedBatchId}/rejected/${rejectedId}/solve`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "Gagal solve rejected row");
      }
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
      const res = await fetch(`${API_BASE}/ingest/${batchId}/rerun`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.detail || "Gagal rerun batch");
      }
      const body = await res.json().catch(() => ({} as { new_batch_id?: string }));
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

  const onBulkIgnore = async () => {
    if (!selectedBatchId || selectedRejectedIds.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      await Promise.all(
        selectedRejectedIds.map(async (rejectedId) => {
          const res = await fetch(`${API_BASE}/ingest/${selectedBatchId}/rejected/${rejectedId}/ignore`, { method: "POST" });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(body?.detail || `Gagal ignore rejected row ${rejectedId}`);
          }
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
          const res = await fetch(`${API_BASE}/ingest/${selectedBatchId}/rejected/${rejectedId}/solve`, { method: "POST" });
          if (!res.ok) {
            const body = await res.json().catch(() => null);
            throw new Error(body?.detail || `Gagal solve rejected row ${rejectedId}`);
          }
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
      <div className="mx-4 grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>CSV Ingestion Admin</CardTitle>
            <CardDescription>
              Upload CSV, monitor status batch, lihat conflict/error/rejected, lalu pilih Ignore atau Solve & Apply.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                className="h-9 rounded-md border px-3 text-sm"
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
              <Input type="file" accept=".csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={busy} />
              <Button onClick={onUpload} disabled={busy || !file}>
                {busy ? "Processing..." : "Upload & Run"}
              </Button>
              <Button variant="outline" onClick={() => void refreshAll()} disabled={busy}>
                Refresh
              </Button>
            </div>
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
            <p className="text-xs text-muted-foreground">{selectedBatchLabel}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Batch Monitoring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
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
                  {batches.map((batch) => (
                    <tr
                      key={batch.batch_id}
                      className={`cursor-pointer border-b hover:bg-muted/40 ${selectedBatchId === batch.batch_id ? "bg-muted/40" : ""}`}
                      onClick={() => {
                        setSelectedBatchId(batch.batch_id);
                        void loadBatchDetail(batch.batch_id);
                      }}
                    >
                      <td className="p-2 font-mono text-xs">{batch.batch_id}</td>
                      <td className="p-2">{batch.dataset}</td>
                      <td className="p-2">{batch.status}</td>
                      <td className="p-2">{batch.loaded_rows}</td>
                      <td className="p-2">{batch.rejected_rows}</td>
                      <td className="p-2">{(Number(batch.reject_rate || 0) * 100).toFixed(2)}%</td>
                      <td className="p-2">
                        <Button
                          size="xs"
                          variant="outline"
                          disabled={busy || !RERUN_ALLOWED_STATUSES.has(batch.status)}
                          onClick={(e) => {
                            e.stopPropagation();
                            void onRerun(batch.batch_id);
                          }}
                        >
                          Rerun
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Issue Resolution</CardTitle>
            <CardDescription>
              {batchDetail
                ? `status=${batchDetail.status} failed_step=${batchDetail.failed_step ?? "-"} total=${batchDetail.metrics.total} loaded=${batchDetail.metrics.loaded} rejected=${batchDetail.metrics.rejected}`
                : "Pilih batch untuk melihat detail conflict/error/rejected."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 grid gap-2 md:grid-cols-3">
              <Input
                placeholder="Cari row/type/error..."
                value={issueSearch}
                onChange={(e) => setIssueSearch(e.target.value)}
                disabled={busy}
              />
              <select
                className="h-9 rounded-md border px-3 text-sm"
                value={issueTypeFilter}
                onChange={(e) => setIssueTypeFilter(e.target.value)}
                disabled={busy}
              >
                {issueTypes.map((item) => (
                  <option key={item} value={item}>
                    {item === "ALL" ? "Semua Type" : item}
                  </option>
                ))}
              </select>
              <select
                className="h-9 rounded-md border px-3 text-sm"
                value={issueSolveFilter}
                onChange={(e) => setIssueSolveFilter(e.target.value)}
                disabled={busy}
              >
                <option value="ALL">Semua Solveability</option>
                <option value="SOLVABLE">Bisa Auto Solve</option>
                <option value="MANUAL">Manual Required</option>
              </select>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <Button size="xs" variant="outline" disabled={busy || selectedRejectedIds.length === 0} onClick={() => void onBulkIgnore()}>
                Ignore Selected ({selectedRejectedIds.length})
              </Button>
              <Button size="xs" disabled={busy || selectedRejectedIds.length === 0} onClick={() => void onBulkSolve()}>
                Solve Selected
              </Button>
            </div>
            {batchDetail?.failed_reason ? (
              <div className="mb-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
                {batchDetail.failed_reason}
              </div>
            ) : null}
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="p-2">
                      <input
                        type="checkbox"
                        checked={filteredRejected.length > 0 && filteredRejected.every((row) => selectedRejectedIds.includes(row.id))}
                        onChange={(e) => onToggleAllRejected(e.target.checked)}
                        disabled={busy || filteredRejected.length === 0}
                      />
                    </th>
                    <th className="p-2">Row</th>
                    <th className="p-2">Type</th>
                    <th className="p-2">Error</th>
                    <th className="p-2">Suggested Solve</th>
                    <th className="p-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRejected.length === 0 ? (
                    <tr>
                      <td className="p-3 text-muted-foreground" colSpan={6}>
                        Tidak ada issue sesuai filter.
                      </td>
                    </tr>
                  ) : (
                    filteredRejected.map((row) => (
                      <tr key={row.id} className="border-b align-top">
                        <td className="p-2">
                          <input
                            type="checkbox"
                            checked={selectedRejectedIds.includes(row.id)}
                            onChange={(e) => onToggleRejected(row.id, e.target.checked)}
                            disabled={busy}
                          />
                        </td>
                        <td className="p-2">{row.row_num}</td>
                        <td className="p-2">{row.error_type}</td>
                        <td className="p-2 max-w-[28rem] break-words">
                          <div>{row.error_message}</div>
                          {(() => {
                            const incoming = row.conflict?.incoming;
                            if (!incoming) return null;
                            return (
                            <div className="mt-2 rounded-xl border border-emerald-200/70 bg-gradient-to-br from-emerald-50 to-emerald-100/60 p-3 text-xs">
                              <div className="mb-2 text-[10px] font-semibold tracking-wide text-emerald-700 uppercase">Incoming</div>
                              <div className="grid gap-1.5 sm:grid-cols-2">
                                {infoFieldList().map((field) => (
                                  <div key={`incoming-info-${field}`} className="rounded-lg border border-white/80 bg-white/90 px-2 py-1.5 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                                    <div className="text-[10px] text-muted-foreground">{prettyLabel(field)}</div>
                                    <div className="font-medium break-words">{toText(incoming[field])}</div>
                                  </div>
                                ))}
                                {incomingChangedFieldList(incoming, row.conflict?.existing ?? []).map((field) => (
                                  <div key={`incoming-change-${field}`} className="rounded-lg border border-emerald-300 bg-emerald-50/80 px-2 py-1.5">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-[10px] text-emerald-800">{prettyLabel(field)}</span>
                                      <span className="rounded-full bg-emerald-200 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-900">changed</span>
                                    </div>
                                    <div className="font-semibold break-words text-emerald-900">{toText(incoming[field])}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                            );
                          })()}
                          {row.conflict?.existing && row.conflict.existing.length > 0 ? (
                            <div className="mt-2 rounded-xl border border-amber-200/70 bg-gradient-to-br from-amber-50 to-amber-100/60 p-3 text-xs">
                              <div className="mb-2 text-[10px] font-semibold tracking-wide text-amber-700 uppercase">Existing</div>
                              <div className="grid gap-2">
                                {row.conflict.existing.map((existing, index) => (
                                  <div key={`existing-${row.id}-${index}`} className="rounded-lg border border-white/80 bg-white/90 p-2 shadow-[0_1px_0_rgba(0,0,0,0.03)]">
                                    <div className="mb-1 text-[10px] text-muted-foreground">Rule #{index + 1}</div>
                                    <div className="grid gap-1.5 sm:grid-cols-2">
                                      {infoFieldList().map((field) => (
                                        <div key={`existing-info-${index}-${field}`} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                                          <div className="text-[10px] text-muted-foreground">{prettyLabel(field)}</div>
                                          <div className="font-medium break-words">{toText(existing[field])}</div>
                                        </div>
                                      ))}
                                      {existingChangedFieldList(row.conflict?.incoming ?? {}, existing).map((field) => (
                                        <div
                                          key={`existing-change-${index}-${field}`}
                                          className={`rounded-lg border px-2 py-1.5 ${
                                            isChanged(row.conflict?.incoming ?? {}, existing, field)
                                              ? "border-amber-300 bg-amber-50/80"
                                              : "border-slate-200 bg-white"
                                          }`}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="text-[10px] text-amber-800">{prettyLabel(field)}</span>
                                            <span className="rounded-full bg-amber-200 px-1.5 py-0.5 text-[9px] font-semibold text-amber-900">changed</span>
                                          </div>
                                          <div className="font-semibold break-words text-amber-900">{toText(existing[field])}</div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </td>
                        <td className="p-2 max-w-[22rem] break-words text-muted-foreground">{resolveSuggestion(row)}</td>
                        <td className="p-2">
                          <div className="flex gap-2">
                            <Button size="xs" variant="outline" disabled={busy} onClick={() => void onIgnore(row.id)}>
                              Ignore
                            </Button>
                            <Button
                              size="xs"
                              disabled={busy || !row.resolution?.can_solve}
                              onClick={() => void onSolve(row.id)}
                              title={row.resolution?.can_solve ? "Apply solve ke database" : row.resolution?.help ?? "Tidak bisa auto-solve"}
                            >
                              Solve & Apply
                            </Button>
                          </div>
                          <p className="mt-2 max-w-[18rem] text-xs text-muted-foreground">
                            {row.resolution?.label ?? "Manual review"}
                          </p>
                        </td>
                      </tr>
                    ))
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
