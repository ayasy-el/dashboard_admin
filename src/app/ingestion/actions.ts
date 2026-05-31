"use server";

import { BatchDetail, BatchListItem, Dataset, RejectedListResponse, RollbackBatchResponse } from "./types";
import { requireAdminUser } from "@/lib/auth";
import { normalizeErrorMessage } from "@/lib/error-message";

const API_BASE =
  process.env.INGESTION_API_URL ??
  process.env.NEXT_PUBLIC_INGESTION_API_URL ??
  "http://127.0.0.1:8001";

type ListResponse<T> = {
  items?: T[];
};

export type UploadBatchResult =
  | { ok: true; batch_id: string }
  | { ok: false; error: string };

export type RollbackBatchResult =
  | ({ ok: true } & RollbackBatchResponse)
  | { ok: false; error: string };

const toBaseUrl = () => (API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE);

const requestJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${toBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    try {
      const parsed = body ? (JSON.parse(body) as { detail?: unknown; message?: unknown }) : null;
      const detail = parsed?.detail ?? parsed?.message;
      if (typeof detail === "string" && detail.trim()) {
        throw new Error(normalizeErrorMessage(detail));
      }
    } catch {
      // fall through to string fallback
    }
    throw new Error(normalizeErrorMessage(body || "Request gagal"));
  }
  return (await res.json()) as T;
};

export async function getBatches(): Promise<BatchListItem[]> {
  await requireAdminUser("/ingestion");
  const data = await requestJson<ListResponse<BatchListItem>>("/ingest");
  return data.items ?? [];
}

export async function getBatchDetail(batchId: string): Promise<BatchDetail> {
  await requireAdminUser("/ingestion");
  return requestJson<BatchDetail>(`/ingest/${batchId}`);
}

export async function getRejected(batchId: string, limit = 100, offset = 0): Promise<RejectedListResponse> {
  await requireAdminUser("/ingestion");
  return requestJson<RejectedListResponse>(`/ingest/${batchId}/rejected?limit=${limit}&offset=${offset}`);
}

export async function uploadBatch(dataset: Dataset, formData: FormData): Promise<UploadBatchResult> {
  await requireAdminUser("/ingestion");
  try {
    const body = await requestJson<{ batch_id: string }>(`/ingest/${dataset}`, {
      method: "POST",
      body: formData,
    });
    return { ok: true, batch_id: body.batch_id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Upload gagal",
    };
  }
}

export async function rollbackBatch(batchId: string): Promise<RollbackBatchResult> {
  await requireAdminUser("/ingestion");
  try {
    const body = await requestJson<RollbackBatchResponse>(`/ingest/${batchId}/rollback`, {
      method: "POST",
    });
    return { ok: true, ...body };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Gagal rollback batch",
    };
  }
}

export async function ignoreRejected(batchId: string, rejectedId: number): Promise<void> {
  await requireAdminUser("/ingestion");
  await requestJson(`/ingest/${batchId}/rejected/${rejectedId}/ignore`, {
    method: "POST",
  });
}

export async function solveRejected(batchId: string, rejectedId: number): Promise<void> {
  await requireAdminUser("/ingestion");
  await requestJson(`/ingest/${batchId}/rejected/${rejectedId}/solve`, {
    method: "POST",
  });
}

export async function downloadSource(batchId: string): Promise<{
  filename: string | null;
  contentType: string | null;
  base64: string;
}> {
  await requireAdminUser("/ingestion");
  const res = await fetch(`${toBaseUrl()}/ingest/${batchId}/source`, { cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || "Gagal download source");
  }

  const contentType = res.headers.get("content-type");
  const contentDisposition = res.headers.get("content-disposition") ?? "";
  const filenameMatch = /filename\*=UTF-8''([^;]+)|filename=\"?([^\";]+)\"?/i.exec(contentDisposition);
  const filename = filenameMatch?.[1] ?? filenameMatch?.[2] ?? null;

  const buffer = Buffer.from(await res.arrayBuffer());
  return {
    filename,
    contentType,
    base64: buffer.toString("base64"),
  };
}
