import type { Metadata } from "next";

import { getBatches } from "./actions";
import type { BatchListItem } from "./types";
import IngestionClient from "./ingestion-client";
import { requireAdminUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Ingestion | Telkomsel Poin Merchant Dashboard",
  description: "Admin ingestion panel untuk upload dan monitor batch CSV.",
};

export default async function IngestionPage() {
  const user = await requireAdminUser("/ingestion");
  let initialBatches: BatchListItem[] = [];
  let initialError: string | null = null;

  try {
    initialBatches = await getBatches();
  } catch (err) {
    initialError = err instanceof Error ? err.message : "Gagal mengambil daftar batch";
  }

  return <IngestionClient initialBatches={initialBatches} initialError={initialError} user={user} />;
}
