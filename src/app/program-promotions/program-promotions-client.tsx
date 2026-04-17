"use client";

import { useState } from "react";

import { DashboardPageShell } from "@/features/shared/components/dashboard-page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuthenticatedAdmin } from "@/lib/auth";

type BannerRecord = {
  id: number;
  title: string;
  subtitle: string;
  cta: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type BannerApiRecord = {
  id: number;
  title: string;
  subtitle: string;
  cta: string;
  image_url: string;
  is_active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type ProgramAssetRecord = {
  id: number;
  ruleKey: string | null;
  keywordCode: string | null;
  imageUrl: string;
  isActive: boolean;
  updatedAt: string;
};

type ProgramAssetApiRecord = {
  id: number;
  rule_key: string | null;
  keyword_code: string | null;
  image_url: string;
  is_active: boolean;
  updated_at: string;
};

type BannerFormState = {
  title: string;
  subtitle: string;
  cta: string;
  imageUrl: string;
  isActive: boolean;
  sortOrder: string;
  startsAt: string;
  endsAt: string;
};

type ProgramAssetFormState = {
  ruleKey: string;
  keywordCode: string;
  imageUrl: string;
  isActive: boolean;
};

type BannerManagementClientProps = {
  initialBanners: BannerRecord[];
  initialProgramAssets: ProgramAssetRecord[];
  user: AuthenticatedAdmin;
};

const emptyBannerForm = (sortOrder = "0"): BannerFormState => ({
  title: "",
  subtitle: "",
  cta: "",
  imageUrl: "",
  isActive: true,
  sortOrder,
  startsAt: "",
  endsAt: "",
});

const emptyAssetForm = (): ProgramAssetFormState => ({
  ruleKey: "",
  keywordCode: "",
  imageUrl: "",
  isActive: true,
});

const toLocalDateTimeInput = (value: string | null) => {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (input: number) => String(input).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(
    date.getMinutes()
  )}`;
};

const toIsoDateTime = (value: string) => {
  if (!value) return null;
  return new Date(value).toISOString();
};

const formatDateTime = (value: string | null) => {
  if (!value) return "-";

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
};

const bannerToForm = (banner: BannerRecord): BannerFormState => ({
  title: banner.title,
  subtitle: banner.subtitle,
  cta: banner.cta,
  imageUrl: banner.imageUrl,
  isActive: banner.isActive,
  sortOrder: String(banner.sortOrder),
  startsAt: toLocalDateTimeInput(banner.startsAt),
  endsAt: toLocalDateTimeInput(banner.endsAt),
});

const assetToForm = (asset: ProgramAssetRecord): ProgramAssetFormState => ({
  ruleKey: asset.ruleKey ?? "",
  keywordCode: asset.keywordCode ?? "",
  imageUrl: asset.imageUrl,
  isActive: asset.isActive,
});

const fromBannerApi = (banner: BannerApiRecord): BannerRecord => ({
  id: banner.id,
  title: banner.title,
  subtitle: banner.subtitle,
  cta: banner.cta,
  imageUrl: banner.image_url,
  isActive: banner.is_active,
  sortOrder: banner.sort_order,
  startsAt: banner.starts_at,
  endsAt: banner.ends_at,
  createdAt: banner.created_at ?? "",
  updatedAt: banner.updated_at ?? "",
});

const fromProgramAssetApi = (asset: ProgramAssetApiRecord): ProgramAssetRecord => ({
  id: asset.id,
  ruleKey: asset.rule_key,
  keywordCode: asset.keyword_code,
  imageUrl: asset.image_url,
  isActive: asset.is_active,
  updatedAt: asset.updated_at,
});

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

export default function BannerManagementClient({
  initialBanners,
  initialProgramAssets,
  user,
}: BannerManagementClientProps) {
  const [banners, setBanners] = useState(initialBanners);
  const [programAssets, setProgramAssets] = useState(initialProgramAssets);
  const [bannerForm, setBannerForm] = useState<BannerFormState>(() =>
    emptyBannerForm(String(initialBanners.length))
  );
  const [assetForm, setAssetForm] = useState<ProgramAssetFormState>(emptyAssetForm);
  const [editingBannerId, setEditingBannerId] = useState<number | null>(null);
  const [editingAssetId, setEditingAssetId] = useState<number | null>(null);
  const [bannerMessage, setBannerMessage] = useState<string | null>(null);
  const [assetMessage, setAssetMessage] = useState<string | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [assetError, setAssetError] = useState<string | null>(null);
  const [uploadingBannerImage, setUploadingBannerImage] = useState(false);
  const [uploadingAssetImage, setUploadingAssetImage] = useState(false);
  const [submittingBanner, setSubmittingBanner] = useState(false);
  const [submittingAsset, setSubmittingAsset] = useState(false);

  const resetBannerForm = () => {
    setEditingBannerId(null);
    setBannerForm(emptyBannerForm(String(banners.length)));
  };

  const resetAssetForm = () => {
    setEditingAssetId(null);
    setAssetForm(emptyAssetForm());
  };

  const submitBanner = async () => {
    setSubmittingBanner(true);
    setBannerError(null);
    setBannerMessage(null);

    try {
      const payload = {
        title: bannerForm.title,
        subtitle: bannerForm.subtitle,
        cta: bannerForm.cta,
        image_url: bannerForm.imageUrl,
        is_active: bannerForm.isActive,
        sort_order: Number(bannerForm.sortOrder),
        starts_at: toIsoDateTime(bannerForm.startsAt),
        ends_at: toIsoDateTime(bannerForm.endsAt),
      };

      const bannerResponse = editingBannerId
        ? await readJson<BannerApiRecord>(`/api/admin/banners/${editingBannerId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await readJson<BannerApiRecord>("/api/admin/banners", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      const banner = fromBannerApi(bannerResponse);

      setBanners((current) => {
        const next = editingBannerId
          ? current.map((item) => (item.id === banner.id ? banner : item))
          : [...current, banner];

        return [...next].sort((a, b) => a.sortOrder - b.sortOrder || b.updatedAt.localeCompare(a.updatedAt));
      });
      setBannerMessage(editingBannerId ? "Banner berhasil diperbarui." : "Banner berhasil dibuat.");
      resetBannerForm();
    } catch (error) {
      setBannerError(error instanceof Error ? error.message : "Gagal menyimpan banner");
    } finally {
      setSubmittingBanner(false);
    }
  };

  const submitProgramAsset = async () => {
    setSubmittingAsset(true);
    setAssetError(null);
    setAssetMessage(null);

    try {
      const payload = {
        rule_key: assetForm.ruleKey || null,
        keyword_code: assetForm.keywordCode || null,
        image_url: assetForm.imageUrl,
        is_active: assetForm.isActive,
      };

      const assetResponse = editingAssetId
        ? await readJson<ProgramAssetApiRecord>(`/api/admin/program-banner-assets/${editingAssetId}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await readJson<ProgramAssetApiRecord>("/api/admin/program-banner-assets", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      const asset = fromProgramAssetApi(assetResponse);

      setProgramAssets((current) => {
        const next = editingAssetId
          ? current.map((item) => (item.id === asset.id ? asset : item))
          : [asset, ...current];

        return [...next].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      });
      setAssetMessage(editingAssetId ? "Asset berhasil diperbarui." : "Asset berhasil dibuat.");
      resetAssetForm();
    } catch (error) {
      setAssetError(error instanceof Error ? error.message : "Gagal menyimpan asset");
    } finally {
      setSubmittingAsset(false);
    }
  };

  const removeBanner = async (id: number) => {
    setBannerError(null);
    setBannerMessage(null);

    try {
      await readJson<{ success: boolean }>(`/api/admin/banners/${id}`, { method: "DELETE" });
      setBanners((current) => current.filter((item) => item.id !== id));
      if (editingBannerId === id) resetBannerForm();
      setBannerMessage("Banner berhasil dihapus.");
    } catch (error) {
      setBannerError(error instanceof Error ? error.message : "Gagal menghapus banner");
    }
  };

  const removeAsset = async (id: number) => {
    setAssetError(null);
    setAssetMessage(null);

    try {
      await readJson<{ success: boolean }>(`/api/admin/program-banner-assets/${id}`, { method: "DELETE" });
      setProgramAssets((current) => current.filter((item) => item.id !== id));
      if (editingAssetId === id) resetAssetForm();
      setAssetMessage("Asset berhasil dihapus.");
    } catch (error) {
      setAssetError(error instanceof Error ? error.message : "Gagal menghapus asset");
    }
  };

  const onBannerFileChange = async (file: File | null) => {
    if (!file) return;

    setUploadingBannerImage(true);
    setBannerError(null);
    setBannerMessage(null);
    try {
      const result = await uploadImage(file);
      setBannerForm((current) => ({ ...current, imageUrl: result.image_url }));
      setBannerMessage("Image banner berhasil diupload.");
    } catch (error) {
      setBannerError(error instanceof Error ? error.message : "Upload image gagal");
    } finally {
      setUploadingBannerImage(false);
    }
  };

  const onAssetFileChange = async (file: File | null) => {
    if (!file) return;

    setUploadingAssetImage(true);
    setAssetError(null);
    setAssetMessage(null);
    try {
      const result = await uploadImage(file);
      setAssetForm((current) => ({ ...current, imageUrl: result.image_url }));
      setAssetMessage("Image asset berhasil diupload.");
    } catch (error) {
      setAssetError(error instanceof Error ? error.message : "Upload image gagal");
    } finally {
      setUploadingAssetImage(false);
    }
  };

  return (
    <DashboardPageShell sidebarWidth="16rem" user={user}>
      <div className="px-4 lg:px-6">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <Card>
            <CardHeader>
              <CardTitle>Provider Promotion Banners</CardTitle>
              <CardDescription>
                Source of truth untuk banner merchant. Merchant akan membaca banner aktif yang sudah lolos
                jadwal publikasi.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="banner-title">Title</Label>
                  <Input
                    id="banner-title"
                    value={bannerForm.title}
                    onChange={(event) => setBannerForm((current) => ({ ...current, title: event.target.value }))}
                    placeholder="Promo Ramadan"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="banner-cta">CTA</Label>
                  <Input
                    id="banner-cta"
                    value={bannerForm.cta}
                    onChange={(event) => setBannerForm((current) => ({ ...current, cta: event.target.value }))}
                    placeholder="Lihat Promo"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="banner-subtitle">Subtitle</Label>
                <textarea
                  id="banner-subtitle"
                  value={bannerForm.subtitle}
                  onChange={(event) => setBannerForm((current) => ({ ...current, subtitle: event.target.value }))}
                  className="border-input min-h-24 w-full rounded-md border bg-transparent px-3 py-2 text-sm outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]"
                  placeholder="Deskripsi singkat promo untuk merchant"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Label htmlFor="banner-image-url">Image URL</Label>
                  <Input
                    id="banner-image-url"
                    value={bannerForm.imageUrl}
                    onChange={(event) => setBannerForm((current) => ({ ...current, imageUrl: event.target.value }))}
                    placeholder="/uploads/banner-assets/example.png"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="banner-image-file">Upload Image</Label>
                  <Input
                    id="banner-image-file"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    disabled={uploadingBannerImage}
                    onChange={(event) => void onBannerFileChange(event.target.files?.[0] ?? null)}
                    className="max-w-72"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="banner-sort-order">Sort Order</Label>
                  <Input
                    id="banner-sort-order"
                    type="number"
                    min="0"
                    value={bannerForm.sortOrder}
                    onChange={(event) => setBannerForm((current) => ({ ...current, sortOrder: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="banner-starts-at">Starts At</Label>
                  <Input
                    id="banner-starts-at"
                    type="datetime-local"
                    value={bannerForm.startsAt}
                    onChange={(event) => setBannerForm((current) => ({ ...current, startsAt: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="banner-ends-at">Ends At</Label>
                  <Input
                    id="banner-ends-at"
                    type="datetime-local"
                    value={bannerForm.endsAt}
                    onChange={(event) => setBannerForm((current) => ({ ...current, endsAt: event.target.value }))}
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={bannerForm.isActive}
                  onChange={(event) => setBannerForm((current) => ({ ...current, isActive: event.target.checked }))}
                />
                Aktifkan banner ini
              </label>

              {bannerForm.imageUrl ? (
                <div className="overflow-hidden rounded-xl border bg-muted/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={bannerForm.imageUrl}
                    alt={bannerForm.title || "Banner preview"}
                    className="h-44 w-full object-cover"
                  />
                </div>
              ) : null}

              {bannerError ? <p className="text-sm text-destructive">{bannerError}</p> : null}
              {bannerMessage ? <p className="text-sm text-emerald-600">{bannerMessage}</p> : null}

              <div className="flex flex-wrap gap-3">
                <Button disabled={submittingBanner || uploadingBannerImage} onClick={() => void submitBanner()}>
                  {editingBannerId ? "Update Banner" : "Create Banner"}
                </Button>
                <Button variant="outline" onClick={resetBannerForm}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Program Banner Assets</CardTitle>
              <CardDescription>
                Opsional untuk kartu active program di merchant. Set satu target saja: `rule_key` atau
                `keyword_code`.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="asset-rule-key">Rule Key</Label>
                  <Input
                    id="asset-rule-key"
                    value={assetForm.ruleKey}
                    onChange={(event) => setAssetForm((current) => ({ ...current, ruleKey: event.target.value }))}
                    placeholder="UUID rule"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-keyword-code">Keyword Code</Label>
                  <Input
                    id="asset-keyword-code"
                    value={assetForm.keywordCode}
                    onChange={(event) =>
                      setAssetForm((current) => ({ ...current, keywordCode: event.target.value }))
                    }
                    placeholder="merchant_keyword"
                  />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Label htmlFor="asset-image-url">Image URL</Label>
                  <Input
                    id="asset-image-url"
                    value={assetForm.imageUrl}
                    onChange={(event) => setAssetForm((current) => ({ ...current, imageUrl: event.target.value }))}
                    placeholder="/uploads/banner-assets/program.png"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="asset-image-file">Upload Image</Label>
                  <Input
                    id="asset-image-file"
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                    disabled={uploadingAssetImage}
                    onChange={(event) => void onAssetFileChange(event.target.files?.[0] ?? null)}
                    className="max-w-72"
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={assetForm.isActive}
                  onChange={(event) => setAssetForm((current) => ({ ...current, isActive: event.target.checked }))}
                />
                Aktifkan asset ini
              </label>

              {assetForm.imageUrl ? (
                <div className="overflow-hidden rounded-xl border bg-muted/20">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={assetForm.imageUrl}
                    alt="Program asset preview"
                    className="h-32 w-full object-cover"
                  />
                </div>
              ) : null}

              {assetError ? <p className="text-sm text-destructive">{assetError}</p> : null}
              {assetMessage ? <p className="text-sm text-emerald-600">{assetMessage}</p> : null}

              <div className="flex flex-wrap gap-3">
                <Button disabled={submittingAsset || uploadingAssetImage} onClick={() => void submitProgramAsset()}>
                  {editingAssetId ? "Update Asset" : "Create Asset"}
                </Button>
                <Button variant="outline" onClick={resetAssetForm}>
                  Reset
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mt-6 grid gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Banner Inventory</CardTitle>
              <CardDescription>
                Banner merchant akan dibaca dari endpoint aktif dengan urutan `sort_order` dan filter schedule.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Banner</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Order</TableHead>
                    <TableHead>Schedule</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {banners.map((banner) => (
                    <TableRow key={banner.id}>
                      <TableCell className="align-top">
                        <div className="space-y-1 whitespace-normal">
                          <div className="font-medium">{banner.title}</div>
                          <div className="text-muted-foreground text-sm">{banner.subtitle}</div>
                          <div className="text-xs text-muted-foreground">CTA: {banner.cta}</div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant={banner.isActive ? "default" : "outline"}>
                          {banner.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">{banner.sortOrder}</TableCell>
                      <TableCell className="align-top whitespace-normal text-sm text-muted-foreground">
                        <div>Start: {formatDateTime(banner.startsAt)}</div>
                        <div>End: {formatDateTime(banner.endsAt)}</div>
                      </TableCell>
                      <TableCell className="align-top">
                        <a href={banner.imageUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                          Open image
                        </a>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingBannerId(banner.id);
                              setBannerForm(bannerToForm(banner));
                              setBannerError(null);
                              setBannerMessage(null);
                            }}
                          >
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => void removeBanner(banner.id)}>
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {banners.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground">
                        Belum ada banner.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Program Asset Inventory</CardTitle>
              <CardDescription>Referensi image untuk active program card di merchant.</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Target</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Image</TableHead>
                    <TableHead>Updated</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {programAssets.map((asset) => (
                    <TableRow key={asset.id}>
                      <TableCell className="align-top whitespace-normal">
                        <div className="font-medium">{asset.keywordCode ? `keyword_code: ${asset.keywordCode}` : "-"}</div>
                        <div className="text-sm text-muted-foreground">
                          {asset.ruleKey ? `rule_key: ${asset.ruleKey}` : "-"}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <Badge variant={asset.isActive ? "default" : "outline"}>
                          {asset.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="align-top">
                        <a href={asset.imageUrl} target="_blank" rel="noreferrer" className="text-primary underline">
                          Open image
                        </a>
                      </TableCell>
                      <TableCell className="align-top text-sm text-muted-foreground">
                        {formatDateTime(asset.updatedAt)}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingAssetId(asset.id);
                              setAssetForm(assetToForm(asset));
                              setAssetError(null);
                              setAssetMessage(null);
                            }}
                          >
                            Edit
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => void removeAsset(asset.id)}>
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {programAssets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        Belum ada program asset.
                      </TableCell>
                    </TableRow>
                  ) : null}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardPageShell>
  );
}
