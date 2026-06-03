"use client";

import * as React from "react";
import {
  IconLayoutBoard,
  IconPhoto,
  IconRefresh,
  IconSparkles,
  IconUpload,
  IconTrash,
} from "@tabler/icons-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ProgramBannerAssetRecord = {
  id: number;
  keywordCode: string | null;
  imageUrl: string;
  isActive: boolean;
  updatedAt: string;
};

type ProgramAssetApiRecord = {
  id: number;
  keyword_code: string | null;
  image_url: string;
  is_active: boolean;
  updated_at: string;
};

type ProgramAssetFormState = {
  imageUrl: string;
  pendingImageFile: File | null;
  isActive: boolean;
};

type MerchantBannerAssetCardProps = {
  keywordCode: string;
  initialAsset: ProgramBannerAssetRecord | null;
};

const emptyAssetForm = (): ProgramAssetFormState => ({
  imageUrl: "",
  pendingImageFile: null,
  isActive: true,
});

const assetToForm = (asset: ProgramBannerAssetRecord | null): ProgramAssetFormState =>
  asset
    ? {
        imageUrl: asset.imageUrl,
        pendingImageFile: null,
        isActive: asset.isActive,
      }
    : emptyAssetForm();

const fromProgramAssetApi = (asset: ProgramAssetApiRecord): ProgramBannerAssetRecord => ({
  id: asset.id,
  keywordCode: asset.keyword_code,
  imageUrl: asset.image_url,
  isActive: asset.is_active,
  updatedAt: asset.updated_at,
});

const formatDateTime = (value: string | null) => {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

async function readJson<T>(input: RequestInfo, init?: RequestInit): Promise<T> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error ?? "Request gagal");
  }

  return body as T;
}

async function uploadImage(file: File) {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/admin/banner-upload", {
    method: "POST",
    body: formData,
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(body.error ?? "Upload gagal");
  }

  return body as { image_url: string };
}

export function MerchantBannerAssetCard({
  keywordCode,
  initialAsset,
}: MerchantBannerAssetCardProps) {
  const [asset, setAsset] = React.useState(initialAsset);
  const [form, setForm] = React.useState<ProgramAssetFormState>(() => assetToForm(initialAsset));
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const previewUrl = React.useMemo(() => {
    if (!form.pendingImageFile) {
      return form.imageUrl;
    }

    return URL.createObjectURL(form.pendingImageFile);
  }, [form.imageUrl, form.pendingImageFile]);

  React.useEffect(() => {
    if (!form.pendingImageFile || !previewUrl.startsWith("blob:")) {
      return;
    }

    return () => {
      URL.revokeObjectURL(previewUrl);
    };
  }, [form.pendingImageFile, previewUrl]);

  const resetForm = () => {
    setForm(assetToForm(asset));
    setError(null);
    setMessage(null);
  };

  const submitAsset = async () => {
    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      let imageUrl = form.imageUrl;

      if (form.pendingImageFile) {
        setUploadingImage(true);
        const uploaded = await uploadImage(form.pendingImageFile);
        imageUrl = uploaded.image_url;
      }

      const payload = {
        keyword_code: keywordCode,
        image_url: imageUrl,
        is_active: form.isActive,
      };

      const assetResponse = asset
        ? await readJson<ProgramAssetApiRecord>(`/api/admin/program-banner-assets/${asset.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await readJson<ProgramAssetApiRecord>("/api/admin/program-banner-assets", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      const nextAsset = fromProgramAssetApi(assetResponse);
      setAsset(nextAsset);
      setForm(assetToForm(nextAsset));
      setMessage(asset ? "Banner image berhasil diperbarui." : "Banner image berhasil dibuat.");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Gagal menyimpan banner image");
    } finally {
      setUploadingImage(false);
      setSubmitting(false);
    }
  };

  const deleteAsset = async () => {
    if (!asset) return;

    const confirmed = window.confirm(
      "Hapus banner image ini? Data dan file image akan dihapus permanen.",
    );

    if (!confirmed) return;

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      await readJson<{ success: boolean }>(`/api/admin/program-banner-assets/${asset.id}`, {
        method: "DELETE",
      });

      setAsset(null);
      setForm(emptyAssetForm());
      setMessage("Banner image berhasil dihapus.");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Gagal menghapus banner image");
    } finally {
      setSubmitting(false);
    }
  };

  const onFileChange = (file: File | null) => {
    if (!file) return;

    setError(null);
    setMessage(null);
    setForm((current) => ({ ...current, pendingImageFile: file }));
    setMessage("Gambar siap diupload. Simpan banner untuk mengunggah gambar.");
  };

  return (
    <Card className="gap-0 overflow-hidden border border-border/70 py-0 shadow-sm">
      <CardHeader className="border-b px-6 py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 text-primary">
                <IconLayoutBoard className="size-5" />
              </div>
              <div className="space-y-1">
                <CardTitle className="text-xl">Program Banner Image</CardTitle>
                <CardDescription>
                  Banner visual untuk current program card merchant ini.
                </CardDescription>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="outline" className="rounded-full border-border bg-background px-3 py-1">
                keyword_code: {keywordCode}
              </Badge>
              <Badge
                variant="outline"
                className="rounded-full border-border bg-background px-3 py-1"
              >
                Last updated: {formatDateTime(asset?.updatedAt ?? null)}
              </Badge>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {asset ? (
              <Badge
                variant={asset.isActive ? "default" : "outline"}
                className="rounded-full px-3 py-1"
              >
                {asset.isActive ? "Enabled" : "Disabled"}
              </Badge>
            ) : (
              <Badge variant="outline" className="rounded-full px-3 py-1">
                Belum ada asset
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-6 py-5">
        <div className="grid gap-5 xl:grid-cols-[1.35fr_0.9fr]">
          <div className="space-y-4">
            <div className="overflow-hidden rounded-2xl border border-border/70 bg-muted/20">
              {previewUrl ? (
                <div className="relative">
                  <div className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/55 via-black/20 to-transparent px-4 py-4 text-white">
                    <div>
                      <div className="text-[11px] font-semibold tracking-[0.18em] uppercase text-white/75">
                        Merchant Banner Preview
                      </div>
                      <div className="mt-1 text-base font-semibold">{keywordCode}</div>
                    </div>
                    <Badge className="border-transparent bg-white/15 text-white hover:bg-white/15">
                      Live Preview
                    </Badge>
                  </div>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt={`Banner preview ${keywordCode}`}
                    className="h-64 w-full object-cover"
                  />
                </div>
              ) : (
                <div className="flex h-64 flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,_rgba(161,18,47,0.12),_transparent_55%),linear-gradient(135deg,rgba(161,18,47,0.06),transparent_58%)] px-6 text-center">
                  <div className="flex size-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                    <IconPhoto className="size-7" />
                  </div>
                  <div className="space-y-1">
                    <div className="text-base font-semibold text-foreground">
                      Banner preview belum tersedia
                    </div>
                    <p className="mx-auto max-w-md text-sm text-muted-foreground">
                      Upload image untuk melihat bagaimana banner merchant ini tampil di kartu
                      program aktif.
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>

          <div className="space-y-4">
            <div className="rounded-2xl border border-border/70 bg-background p-5 shadow-sm">
              <div className="flex items-start gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <IconSparkles className="size-5" />
                </div>
                <div className="space-y-1">
                  <h3 className="font-semibold text-foreground">Banner Controls</h3>
                  <p className="text-sm text-muted-foreground">
                    Kelola image yang dipakai oleh merchant ini untuk kartu program aktif.
                  </p>
                </div>
              </div>

              <div className="mt-5 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="merchant-banner-image-file">Upload Image</Label>
                  <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-4">
                    <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                      <IconUpload className="size-4 text-primary" />
                      Pilih file banner baru
                    </div>
                    <Input
                      id="merchant-banner-image-file"
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                      disabled={uploadingImage}
                      onChange={(event) => void onFileChange(event.target.files?.[0] ?? null)}
                    />
                    {form.pendingImageFile ? (
                      <p className="mt-3 break-all text-xs text-muted-foreground">
                        Pending upload: {form.pendingImageFile.name}
                      </p>
                    ) : form.imageUrl ? (
                      <p className="mt-3 break-all text-xs text-muted-foreground">{form.imageUrl}</p>
                    ) : (
                      <p className="mt-3 text-xs text-muted-foreground">
                        Format yang didukung: PNG, JPG, WEBP, GIF, SVG.
                      </p>
                    )}
                  </div>
                </div>

                <label className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-muted/20 px-4 py-3">
                  <div>
                    <div className="text-sm font-medium text-foreground">Tampilkan banner image</div>
                    <div className="text-xs text-muted-foreground">
                      Nonaktif hanya menyembunyikan banner dari tampilan, data tetap disimpan.
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, isActive: event.target.checked }))
                    }
                    className="size-4"
                  />
                </label>

                {error ? (
                  <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
                    {error}
                  </div>
                ) : null}

                {message ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                    {message}
                  </div>
                ) : null}

                <div className="flex flex-wrap gap-3">
                  <Button
                    className="min-w-44"
                    disabled={submitting || uploadingImage || (!form.imageUrl && !form.pendingImageFile)}
                    onClick={() => void submitAsset()}
                  >
                    {asset ? "Update Banner Image" : "Create Banner Image"}
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={submitting || uploadingImage || !asset}
                    onClick={() => void deleteAsset()}
                  >
                    <IconTrash className="size-4" />
                    Hapus
                  </Button>
                  <Button variant="outline" onClick={resetForm}>
                    <IconRefresh className="size-4" />
                    Reset
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
