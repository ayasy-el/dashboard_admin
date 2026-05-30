"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  IconDeviceFloppy,
  IconPencil,
  IconPlus,
  IconSearch,
  IconTrash,
} from "@tabler/icons-react";

import {
  assignMerchantsToAccount,
  createMerchantAccount,
  deleteMerchantAccount,
  removeMerchantsFromAccount,
  updateMerchantAccount,
} from "@/app/merchant/accounts/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useBindGlobalLoading } from "@/components/global-loading-provider";
import { cn } from "@/lib/utils";
import type {
  MerchantAccountSummary,
  MerchantAccountsDashboardData,
} from "@/features/merchant-accounts/merchant-accounts.repository";

type MerchantAccountsWorkspaceProps = {
  data: MerchantAccountsDashboardData;
};

type AccountSheetMode = "create" | "edit";

type AccountFormState = {
  email: string;
  username: string;
  isActive: boolean;
};

type MerchantConnectionFilter = "all" | "unlinked" | "linked";
type MerchantSearchMode = "some" | "all";

const accountBadgeTone = (isActive: boolean) =>
  isActive
    ? "border-transparent bg-emerald-100 text-emerald-700"
    : "border-transparent bg-slate-200 text-slate-600";

const parseCommaSeparatedTerms = (value: string) =>
  value
    .split(",")
    .map((term) => term.trim().toLowerCase())
    .filter(Boolean);

function AccountItem({
  account,
  active,
  onClick,
}: {
  account: MerchantAccountSummary;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-start justify-between gap-4 border-b border-border/70 px-4 py-4 text-left transition-all hover:bg-muted/40",
        active && "border-l-4 border-l-primary bg-primary/10 px-[calc(theme(spacing.4)-3px)] shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]",
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className={cn("truncate text-sm font-semibold", active ? "text-primary" : "text-foreground")}>
          {account.username ?? account.email}
        </div>
        <div className="truncate text-xs text-muted-foreground">Email: {account.email}</div>
        <div className="text-xs text-muted-foreground">
          {account.merchantCount} merchant terhubung
        </div>
        <div className="truncate text-xs text-muted-foreground">
          {account.sampleMerchantName ?? "Belum ada merchant"}
        </div>
      </div>
      <div className="flex flex-col items-end gap-2">
        <Badge className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase", accountBadgeTone(account.isActive))}>
        {account.isActive ? "AKTIF" : "TIDAK AKTIF"}
        </Badge>
      </div>
    </button>
  );
}

export function MerchantAccountsWorkspace({ data }: MerchantAccountsWorkspaceProps) {
  const router = useRouter();
  const [isNavigating, startNavigation] = React.useTransition();
  const selectedAccount = data.selectedAccount;

  const [accountQuery, setAccountQuery] = React.useState("");
  const [connectedMerchantQuery, setConnectedMerchantQuery] = React.useState("");
  const [availableMerchantQuery, setAvailableMerchantQuery] = React.useState("");
  const [pendingAddKeys, setPendingAddKeys] = React.useState<Set<string>>(new Set());
  const [pendingRemoveKeys, setPendingRemoveKeys] = React.useState<Set<string>>(new Set());
  const [sheetMode, setSheetMode] = React.useState<AccountSheetMode | null>(null);
  const [sheetSubmitting, setSheetSubmitting] = React.useState(false);
  const [formState, setFormState] = React.useState<AccountFormState>({
    email: "",
    username: "",
    isActive: true,
  });
  const [activeTab, setActiveTab] = React.useState<"connected" | "available">("connected");
  const [merchantConnectionFilter, setMerchantConnectionFilter] = React.useState<MerchantConnectionFilter>("all");
  const [merchantSearchMode, setMerchantSearchMode] = React.useState<MerchantSearchMode>("some");
  const [isSaving, setIsSaving] = React.useState(false);

  useBindGlobalLoading(isNavigating);
  const hasSelectedAccount = selectedAccount != null;

  React.useEffect(() => {
    setPendingAddKeys(new Set());
    setPendingRemoveKeys(new Set());
    setConnectedMerchantQuery("");
    setAvailableMerchantQuery("");
    setMerchantConnectionFilter("all");
    setMerchantSearchMode("some");
    setActiveTab("connected");
  }, [selectedAccount?.id]);

  React.useEffect(() => {
    if (sheetMode === "create") {
      setFormState({ email: "", username: "", isActive: true });
      return;
    }

    if (sheetMode === "edit" && selectedAccount) {
      setFormState({
        email: selectedAccount.email,
        username: selectedAccount.username ?? "",
        isActive: selectedAccount.isActive,
      });
    }
  }, [sheetMode, selectedAccount]);

  const filteredAccounts = React.useMemo(() => {
    const normalized = accountQuery.trim().toLowerCase();
    if (!normalized) return data.accounts;

    return data.accounts.filter((account) =>
      [
        account.email,
        account.username ?? "",
        account.sampleMerchantName ?? "",
        `${account.merchantCount} merchant`,
        account.isActive ? "aktif" : "tidak aktif",
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [accountQuery, data.accounts]);

  const connectedMerchants = React.useMemo(
    () => selectedAccount?.merchants ?? [],
    [selectedAccount],
  );

  const connectedMerchantKeys = React.useMemo(
    () => new Set(connectedMerchants.map((merchant) => merchant.merchantKey)),
    [connectedMerchants],
  );

  const availableMerchants = React.useMemo(
    () => data.merchantPool.filter((merchant) => !connectedMerchantKeys.has(merchant.merchantKey)),
    [connectedMerchantKeys, data.merchantPool],
  );

  const filteredConnectedMerchants = React.useMemo(() => {
    const normalized = connectedMerchantQuery.trim().toLowerCase();
    if (!normalized) return connectedMerchants;
    return connectedMerchants.filter((merchant) =>
      [merchant.merchantName, merchant.keywordCode, merchant.uniqMerchant]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [connectedMerchants, connectedMerchantQuery]);

  const filteredAvailableMerchants = React.useMemo(() => {
    const terms = parseCommaSeparatedTerms(availableMerchantQuery);
    const byConnectionState = availableMerchants.filter((merchant) => {
      if (merchantConnectionFilter === "linked") {
        return merchant.ownerUserId != null;
      }

      if (merchantConnectionFilter === "unlinked") {
        return merchant.ownerUserId == null;
      }

      return true;
    });

    if (terms.length === 0) return byConnectionState;

    return byConnectionState.filter((merchant) => {
      const haystack = [
        merchant.merchantName,
        merchant.keywordCode,
        merchant.uniqMerchant,
        merchant.branchName ?? "",
        merchant.categoryName ?? "",
        merchant.ownerUsername ?? "",
        merchant.ownerEmail ?? "",
      ]
        .join(" ")
        .toLowerCase();

      if (merchantSearchMode === "all") {
        return terms.every((term) => haystack.includes(term));
      }

      return terms.some((term) => haystack.includes(term));
    });
  }, [availableMerchants, availableMerchantQuery, merchantConnectionFilter, merchantSearchMode]);

  const connectedSelectedCount = pendingRemoveKeys.size;
  const availableSelectedCount = pendingAddKeys.size;

  const pendingAddText = pendingAddKeys.size > 0 ? `${pendingAddKeys.size} merchant akan ditambahkan` : "Tidak ada merchant yang akan ditambahkan.";
  const pendingRemoveText =
    pendingRemoveKeys.size > 0 ? `${pendingRemoveKeys.size} merchant akan dilepas` : "Tidak ada merchant yang akan dilepas.";

  const pendingChangeCount = pendingAddKeys.size + pendingRemoveKeys.size;

  const openCreateSheet = () => {
    setSheetMode("create");
  };

  const openEditSheet = () => {
    if (!selectedAccount) return;
    setSheetMode("edit");
  };

  const closeSheet = () => {
    if (sheetSubmitting) return;
    setSheetMode(null);
  };

  const togglePendingAdd = (merchantKey: string) => {
    setPendingAddKeys((current) => {
      const next = new Set(current);
      if (next.has(merchantKey)) {
        next.delete(merchantKey);
      } else {
        next.add(merchantKey);
      }
      return next;
    });
  };

  const togglePendingRemove = (merchantKey: string) => {
    setPendingRemoveKeys((current) => {
      const next = new Set(current);
      if (next.has(merchantKey)) {
        next.delete(merchantKey);
      } else {
        next.add(merchantKey);
      }
      return next;
    });
  };

  const handleSelectAccount = (accountId: number) => {
    startNavigation(() => {
      router.replace(`/account-management?userId=${accountId}`, { scroll: false });
    });
  };

  const handleSaveChanges = async () => {
    if (!selectedAccount) return;
    if (pendingChangeCount === 0) {
      toast.message("Belum ada perubahan untuk disimpan.");
      return;
    }

    setIsSaving(true);
    try {
      if (pendingRemoveKeys.size > 0) {
        await removeMerchantsFromAccount({
          userId: selectedAccount.id,
          merchantKeys: Array.from(pendingRemoveKeys),
        });
      }

      if (pendingAddKeys.size > 0) {
        await assignMerchantsToAccount({
          userId: selectedAccount.id,
          merchantKeys: Array.from(pendingAddKeys),
        });
      }

      toast.success("Perubahan merchant account tersimpan.");
      setPendingAddKeys(new Set());
      setPendingRemoveKeys(new Set());
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan perubahan.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleAccountFormSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSheetSubmitting(true);

    try {
      if (sheetMode === "create") {
        const result = await createMerchantAccount({
          email: formState.email,
          username: formState.username,
          isActive: formState.isActive,
        });
        toast.success("Account baru dibuat.");
        setSheetMode(null);
        startNavigation(() => {
          router.replace(`/account-management?userId=${result.userId}`, { scroll: false });
          router.refresh();
        });
        return;
      }

      if (sheetMode === "edit" && selectedAccount) {
        await updateMerchantAccount({
          userId: selectedAccount.id,
          email: formState.email,
          username: formState.username,
          isActive: formState.isActive,
        });
        toast.success("Account berhasil diperbarui.");
        setSheetMode(null);
        startNavigation(() => {
          router.refresh();
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menyimpan account.");
    } finally {
      setSheetSubmitting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!selectedAccount) return;

    const confirmed = window.confirm(
      `Hapus account ${selectedAccount.username ?? selectedAccount.email}? Merchant yang terhubung akan ikut dilepas.`,
    );
    if (!confirmed) return;

    setSheetSubmitting(true);
    try {
      const fallback = data.accounts.find((account) => account.id !== selectedAccount.id && account.isActive) ?? data.accounts.find((account) => account.id !== selectedAccount.id) ?? null;
      await deleteMerchantAccount({ userId: selectedAccount.id });
      toast.success("Account berhasil dihapus.");
      if (fallback) {
        startNavigation(() => {
          router.replace(`/account-management?userId=${fallback.id}`, { scroll: false });
          router.refresh();
        });
      } else {
        startNavigation(() => {
          router.refresh();
        });
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Gagal menghapus account.");
    } finally {
      setSheetSubmitting(false);
    }
  };

  const resetSelections = () => {
    setPendingAddKeys(new Set());
    setPendingRemoveKeys(new Set());
  };

  return (
    <>
      <Sheet open={sheetMode !== null} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent side="right" className="w-full sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{sheetMode === "create" ? "Tambah Account" : "Ubah Account"}</SheetTitle>
            <SheetDescription>
              {sheetMode === "create"
                ? "Buat user account baru untuk menampung merchant."
                : "Perbarui nama account, email, dan status aktif."}
            </SheetDescription>
          </SheetHeader>

          <form className="flex flex-1 flex-col gap-4 px-4 pb-4" onSubmit={handleAccountFormSubmit}>
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Nama Account</span>
              <Input
                value={formState.username}
                onChange={(event) => setFormState((current) => ({ ...current, username: event.target.value }))}
                placeholder=""
                required
              />
            </label>
            <label className="space-y-2">
              <span className="text-sm font-medium text-foreground">Email</span>
              <Input
                type="email"
                value={formState.email}
                onChange={(event) => setFormState((current) => ({ ...current, email: event.target.value }))}
                placeholder=""
                required
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <Checkbox
                checked={formState.isActive}
                onCheckedChange={(checked) =>
                  setFormState((current) => ({ ...current, isActive: Boolean(checked) }))
                }
              />
              <span>Account aktif</span>
            </label>

            <SheetFooter className="px-0 pb-0">
              <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button type="button" variant="outline" onClick={closeSheet} disabled={sheetSubmitting}>
                  Batal
                </Button>
                <Button type="submit" disabled={sheetSubmitting}>
                  <IconDeviceFloppy className="size-4" />
                  Simpan
                </Button>
              </div>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <div className="px-4 pb-6 lg:px-6">
        <div className="grid overflow-hidden rounded-3xl border border-border/70 bg-card shadow-sm lg:h-[calc(100vh-9rem)] lg:grid-cols-[19rem_minmax(0,1fr)]">
          <aside className="flex min-h-0 flex-col overflow-hidden border-b border-border/70 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-3 border-b border-border/70 px-5 py-4">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-foreground">Daftar Account</h2>
                <p className="text-xs text-muted-foreground">{data.summary.totalAccounts} account total</p>
              </div>
              <Button type="button" size="sm" className="gap-2" onClick={openCreateSheet}>
                <IconPlus className="size-4" />
                Tambah
              </Button>
            </div>
            <div className="border-b border-border/70 p-4">
              <div className="relative">
                <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={accountQuery}
                  onChange={(event) => setAccountQuery(event.target.value)}
                  placeholder="Cari Account Utama..."
                  className="h-10 rounded-xl pl-9"
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredAccounts.map((account) => (
                <AccountItem
                  key={account.id}
                  account={account}
                  active={account.id === selectedAccount?.id}
                  onClick={() => handleSelectAccount(account.id)}
                />
              ))}
              {filteredAccounts.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  Tidak ada account yang cocok dengan pencarian.
                </div>
              ) : null}
            </div>
          </aside>

          <main className="flex min-h-0 flex-col overflow-hidden bg-background">
            <div className="border-b border-border/70 px-5 py-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="text-xs font-semibold tracking-[0.22em] uppercase text-primary">
                    {hasSelectedAccount ? "Account Terpilih" : "Belum Ada Account"}
                  </div>
                  {hasSelectedAccount ? (
                    <>
                      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                        {selectedAccount.username ?? selectedAccount.email}
                      </h1>
                      <p className="text-sm text-muted-foreground">
                        Email: {selectedAccount.email} • {selectedAccount.merchantCount} merchant terhubung
                      </p>
                    </>
                  ) : (
                    <p className="max-w-2xl text-sm text-muted-foreground">
                      Belum ada user account yang dibuat. Admin tetap bisa menambahkan account baru dari tombol
                      Tambah di sisi kiri untuk mulai mengelola merchant.
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" className="gap-2" onClick={openEditSheet} disabled={!hasSelectedAccount}>
                    <IconPencil className="size-4" />
                    Ubah
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={handleDeleteAccount}
                    disabled={sheetSubmitting || !hasSelectedAccount}
                  >
                    <IconTrash className="size-4" />
                    Hapus
                  </Button>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1 flex-col">
              {hasSelectedAccount ? (
                <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as "connected" | "available")} className="flex min-h-0 flex-1 flex-col gap-0">
                  <div className="border-b border-border/70 px-5 pt-2">
                    <TabsList variant="line" className="h-11 gap-6 rounded-none p-0">
                      <TabsTrigger value="connected" className="rounded-none px-0 pb-2 text-sm">
                        Merchant Terhubung ({connectedMerchants.length})
                      </TabsTrigger>
                      <TabsTrigger value="available" className="rounded-none px-0 pb-2 text-sm">
                        Tambah Merchant
                      </TabsTrigger>
                    </TabsList>
                  </div>

                  <TabsContent value="connected" className="m-0 flex min-h-0 flex-1 flex-col">
                    <div className="border-b border-border/70 px-5 py-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <label className="flex items-center gap-3 text-sm text-foreground">
                          <Checkbox
                            checked={
                              filteredConnectedMerchants.length > 0 &&
                              filteredConnectedMerchants.every((merchant) => pendingRemoveKeys.has(merchant.merchantKey))
                                ? true
                                : pendingRemoveKeys.size > 0
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={(checked) => {
                              const next = new Set(pendingRemoveKeys);
                              filteredConnectedMerchants.forEach((merchant) => {
                                if (checked) {
                                  next.add(merchant.merchantKey);
                                } else {
                                  next.delete(merchant.merchantKey);
                                }
                              });
                              setPendingRemoveKeys(next);
                            }}
                          />
                          <span>Pilih Semua ({connectedSelectedCount} terpilih)</span>
                        </label>
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-hidden">
                      <div className="h-full overflow-y-auto">
                        <div className="grid grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.1fr)] border-b border-border/70 bg-muted/20 px-6 py-3 text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                          <div />
                          <div>Merchant Name</div>
                          <div>Merchant ID</div>
                          <div>Branch</div>
                          <div>Category</div>
                          <div>Status</div>
                        </div>
                        {filteredConnectedMerchants.map((merchant) => (
                          <div
                            key={merchant.merchantKey}
                            onClick={() => togglePendingRemove(merchant.merchantKey)}
                            className={cn(
                              "grid cursor-pointer grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-3 border-b border-border/60 px-6 py-4 transition-colors",
                              pendingRemoveKeys.has(merchant.merchantKey) && "bg-destructive/5",
                            )}
                          >
                            <div onClick={(event) => event.stopPropagation()}>
                              <Checkbox
                                checked={pendingRemoveKeys.has(merchant.merchantKey)}
                                onCheckedChange={() => togglePendingRemove(merchant.merchantKey)}
                              />
                            </div>
                            <div className="min-w-0">
                              <div className="truncate font-medium text-foreground">{merchant.merchantName}</div>
                              <div className="mt-1 truncate text-xs text-muted-foreground">
                                {merchant.uniqMerchant}
                              </div>
                            </div>
                            <div className="font-mono text-sm text-muted-foreground">{merchant.keywordCode}</div>
                            <div className="truncate text-sm text-muted-foreground">{merchant.branchName ?? "-"}</div>
                            <div className="truncate text-sm text-muted-foreground">{merchant.categoryName ?? "-"}</div>
                            <div className="min-w-0">
                              {merchant.ownerUserId != null ? (
                                <Link
                                  href={`/account-management?userId=${merchant.ownerUserId}`}
                                  className="truncate text-sm font-medium text-primary transition-colors hover:underline"
                                  onClick={(event) => event.stopPropagation()}
                                >
                                  Terhubung
                                </Link>
                              ) : (
                                <span className="text-sm text-muted-foreground">Belum terhubung</span>
                              )}
                            </div>
                          </div>
                        ))}
                        {filteredConnectedMerchants.length === 0 ? (
                          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                            Tidak ada merchant terhubung pada account ini.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="available" className="m-0 flex min-h-0 flex-1 flex-col">
                    <div className="border-b border-border/70 px-5 py-3">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <label className="flex items-center gap-3 text-sm text-foreground">
                          <Checkbox
                            checked={
                              filteredAvailableMerchants.length > 0 &&
                              filteredAvailableMerchants.every((merchant) => pendingAddKeys.has(merchant.merchantKey))
                                ? true
                                : pendingAddKeys.size > 0
                                  ? "indeterminate"
                                  : false
                            }
                            onCheckedChange={(checked) => {
                              const next = new Set(pendingAddKeys);
                              filteredAvailableMerchants.forEach((merchant) => {
                                if (checked) {
                                  next.add(merchant.merchantKey);
                                } else {
                                  next.delete(merchant.merchantKey);
                                }
                              });
                              setPendingAddKeys(next);
                            }}
                          />
                          <span>Pilih Semua ({availableSelectedCount} terpilih)</span>
                        </label>
                        <div className="flex flex-wrap gap-2">
                          {([
                            { key: "all", label: "Semua" },
                            { key: "unlinked", label: "Belum Terhubung" },
                            { key: "linked", label: "Sudah Terhubung" },
                          ] as const).map((option) => (
                            <Button
                              key={option.key}
                              type="button"
                              variant={merchantConnectionFilter === option.key ? "default" : "outline"}
                              size="sm"
                              className="h-8"
                              onClick={() => setMerchantConnectionFilter(option.key)}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                      <div className="mt-3 flex flex-col gap-2 lg:flex-row lg:items-center">
                        <div className="relative w-full max-w-md">
                          <IconSearch className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                          <Input
                            value={availableMerchantQuery}
                            onChange={(event) => setAvailableMerchantQuery(event.target.value)}
                            placeholder="Cari merchant, pisahkan dengan koma"
                            className="h-10 rounded-xl pl-9"
                          />
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                            Mode Search
                          </span>
                          {([
                            { key: "some", label: "Some" },
                            { key: "all", label: "All" },
                          ] as const).map((option) => (
                            <Button
                              key={option.key}
                              type="button"
                              variant={merchantSearchMode === option.key ? "default" : "outline"}
                              size="sm"
                              className="h-8"
                              onClick={() => setMerchantSearchMode(option.key)}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="min-h-0 flex-1 overflow-hidden">
                      <div className="h-full overflow-y-auto">
                        <div className="grid grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.1fr)] border-b border-border/70 bg-muted/20 px-6 py-3 text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase">
                          <div />
                          <div>Merchant Name</div>
                          <div>Merchant ID</div>
                          <div>Branch</div>
                          <div>Category</div>
                          <div>Status</div>
                        </div>
                        {filteredAvailableMerchants.map((merchant) => {
                          const ownerLabel =
                            merchant.ownerUserId == null
                              ? "Belum terhubung"
                              : merchant.ownerUsername ?? merchant.ownerEmail ?? `Account #${merchant.ownerUserId}`;

                          return (
                            <div
                              key={merchant.merchantKey}
                              onClick={() => togglePendingAdd(merchant.merchantKey)}
                              className={cn(
                                "grid cursor-pointer grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_minmax(0,1.1fr)] items-center gap-3 border-b border-border/60 px-6 py-4 transition-colors",
                                pendingAddKeys.has(merchant.merchantKey) && "bg-primary/5",
                              )}
                            >
                              <div onClick={(event) => event.stopPropagation()}>
                                <Checkbox
                                  checked={pendingAddKeys.has(merchant.merchantKey)}
                                  onCheckedChange={() => togglePendingAdd(merchant.merchantKey)}
                                />
                              </div>
                              <div className="min-w-0">
                                <div className="truncate font-medium text-foreground">{merchant.merchantName}</div>
                                <div className="mt-1 truncate text-xs text-muted-foreground">
                                  {merchant.uniqMerchant}
                                </div>
                              </div>
                              <div className="font-mono text-sm text-muted-foreground">{merchant.keywordCode}</div>
                              <div className="truncate text-sm text-muted-foreground">{merchant.branchName ?? "-"}</div>
                              <div className="truncate text-sm text-muted-foreground">{merchant.categoryName ?? "-"}</div>
                              <div className="min-w-0">
                                {merchant.ownerUserId != null ? (
                                  <Link
                                    href={`/account-management?userId=${merchant.ownerUserId}`}
                                    className="truncate text-sm font-medium text-primary transition-colors hover:underline"
                                    onClick={(event) => event.stopPropagation()}
                                  >
                                    {ownerLabel}
                                  </Link>
                                ) : (
                                  <span className="text-sm text-muted-foreground">Belum terhubung</span>
                                )}
                              </div>
                            </div>
                          );
                        })}
                        {filteredAvailableMerchants.length === 0 ? (
                          <div className="px-6 py-10 text-center text-sm text-muted-foreground">
                            Tidak ada merchant yang cocok dengan pencarian.
                          </div>
                        ) : null}
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <div className="flex min-h-0 flex-1 items-center justify-center px-5 py-10">
                  <div className="w-full max-w-2xl rounded-3xl border border-dashed border-border/80 bg-muted/20 p-8 text-center">
                    <div className="text-xs font-semibold tracking-[0.22em] uppercase text-primary">
                      Empty State
                    </div>
                    <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
                      Tidak ada user account
                    </h2>
                    <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground">
                      Admin tetap bisa membuat account baru dari tombol Tambah. Setelah account dibuat, merchant
                      bisa langsung dihubungkan ke account tersebut.
                    </p>
                    <div className="mt-6 flex justify-center">
                      <Button type="button" className="gap-2" onClick={openCreateSheet}>
                        <IconPlus className="size-4" />
                        Tambah Account
                      </Button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border/70 bg-background/95 px-5 py-4 backdrop-blur">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex flex-col gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-emerald-700 px-2 text-xs font-semibold text-white">
                      +{pendingAddKeys.size}
                    </span>
                    <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-destructive px-2 text-xs font-semibold text-white">
                      -{pendingRemoveKeys.size}
                    </span>
                    <p className="text-sm text-muted-foreground">
                      {pendingAddText}. {pendingRemoveText}
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Merchant dipindahkan ke kolom `dim_merchant.user_account_id` saat tombol simpan ditekan.
                  </p>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Button type="button" variant="ghost" className="gap-2" onClick={resetSelections} disabled={isSaving}>
                    <IconTrash className="size-4" />
                    Batalkan Semua
                  </Button>
                  <Button type="button" className="gap-2 px-6" onClick={handleSaveChanges} disabled={isSaving}>
                    <IconDeviceFloppy className="size-4" />
                    Review Ringkasan &amp; Simpan
                  </Button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
