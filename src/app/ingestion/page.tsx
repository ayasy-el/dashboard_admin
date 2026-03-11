import { getBatches } from "./actions";
import type { BatchListItem } from "./types";
import IngestionClient from "./ingestion-client";

export default async function IngestionPage() {
  let initialBatches: BatchListItem[] = [];
  let initialError: string | null = null;

  try {
    initialBatches = await getBatches();
  } catch (err) {
    initialError = err instanceof Error ? err.message : "Gagal mengambil daftar batch";
  }

  return <IngestionClient initialBatches={initialBatches} initialError={initialError} />;
}
