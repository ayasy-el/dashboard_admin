"use server";

import { BatchDetail, BatchListItem, Dataset, RejectedRow } from "./types";

const API_BASE =
  process.env.INGESTION_API_URL ??
  process.env.NEXT_PUBLIC_INGESTION_API_URL ??
  "http://127.0.0.1:8001";

type ListResponse<T> = {
  items?: T[];
};

const toBaseUrl = () => (API_BASE.endsWith("/") ? API_BASE.slice(0, -1) : API_BASE);

const requestJson = async <T,>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${toBaseUrl()}${path}`, {
    ...init,
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(body || "Request gagal");
  }
  return (await res.json()) as T;
};

export async function getBatches(): Promise<BatchListItem[]> {
  const data = await requestJson<ListResponse<BatchListItem>>("/ingest");
  return data.items ?? [];
}

export async function getBatchDetail(batchId: string): Promise<BatchDetail> {
  return requestJson<BatchDetail>(`/ingest/${batchId}`);
}

export async function getRejected(batchId: string): Promise<RejectedRow[]> {
  const data = await requestJson<ListResponse<RejectedRow>>(`/ingest/${batchId}/rejected`);
  return data.items ?? [];
}

export async function uploadBatch(dataset: Dataset, formData: FormData): Promise<{ batch_id: string }> {
  return requestJson<{ batch_id: string }>(`/ingest/${dataset}`, {
    method: "POST",
    body: formData,
  });
}

export async function rerunBatch(batchId: string): Promise<{ new_batch_id?: string }> {
  return requestJson<{ new_batch_id?: string }>(`/ingest/${batchId}/rerun`, {
    method: "POST",
  });
}

export async function ignoreRejected(batchId: string, rejectedId: number): Promise<void> {
  await requestJson(`/ingest/${batchId}/rejected/${rejectedId}/ignore`, {
    method: "POST",
  });
}

export async function solveRejected(batchId: string, rejectedId: number): Promise<void> {
  await requestJson(`/ingest/${batchId}/rejected/${rejectedId}/solve`, {
    method: "POST",
  });
}

export async function downloadSource(batchId: string): Promise<{
  filename: string | null;
  contentType: string | null;
  base64: string;
}> {
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
