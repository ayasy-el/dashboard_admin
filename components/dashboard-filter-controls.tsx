"use client";

import * as React from "react";

import { useDashboardFilters } from "@/components/dashboard-filter-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getMonthLabel } from "@/lib/dashboard-metrics";

const toggleValue = (current: string[], value: string) =>
  current.includes(value)
    ? current.filter((item) => item !== value)
    : [...current, value];

export function DashboardFilterControls() {
  const { initialized, loading, options, applied, draft, latestMonth, setDraft, applyDraft, resetAll } =
    useDashboardFilters();
  const [isOpen, setIsOpen] = React.useState(false);

  const selectedSummary = React.useMemo(() => {
    const allMonths = options.months.map((option) => option.value);
    const monthIsNoFilter =
      applied.months.length === allMonths.length &&
      allMonths.every((month) => applied.months.includes(month));

    const findLabel = (optionList: { value: string; label: string }[], value: string) =>
      optionList.find((option) => option.value === value)?.label ?? value;

    return {
      month: monthIsNoFilter
        ? "Semua Periode"
        : applied.months.length === 1
          ? findLabel(options.months, applied.months[0])
          : `${applied.months.length} periode`,
      category:
        applied.categories.length === 0
          ? "Semua Kategori"
          : applied.categories.length === 1
            ? findLabel(options.categories, applied.categories[0])
            : `${applied.categories.length} kategori`,
      branch:
        applied.branches.length === 0
          ? "Semua Branch"
          : applied.branches.length === 1
            ? findLabel(options.branches, applied.branches[0])
            : `${applied.branches.length} branch`,
      merchant:
        applied.merchants.length === 0
          ? "Semua Merchant"
          : applied.merchants.length === 1
            ? findLabel(options.merchants, applied.merchants[0])
            : `${applied.merchants.length} merchant`,
    };
  }, [applied, options.months, options.categories, options.branches, options.merchants]);

  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <DropdownMenu
          open={isOpen}
          onOpenChange={(nextOpen) => {
            if (isOpen && !nextOpen) applyDraft();
            setIsOpen(nextOpen);
          }}
        >
          <DropdownMenuTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="rounded-full border-border/75 bg-card px-4 font-semibold"
              disabled={!initialized || loading}
            >
              Filter
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="start"
            className="w-[min(96vw,980px)] rounded-2xl border-border/70 bg-card/95 p-4 shadow-[0_20px_44px_-26px_rgba(2,6,23,0.35)]"
            sideOffset={8}
          >
            <div className="grid gap-4 lg:grid-cols-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-muted-foreground">Periode</div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => setDraft({ months: options.months.map((option) => option.value) })}
                    >
                      Select all
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => setDraft({ months: [] })}
                    >
                      Unselect all
                    </Button>
                  </div>
                </div>
                <div className="max-h-64 space-y-2 overflow-auto rounded-xl border border-border/70 bg-muted/30 p-2">
                  {options.months.map((option) => (
                    <label key={option.value} className="flex cursor-pointer items-center gap-2 text-xs">
                      <Checkbox
                        checked={draft.months.includes(option.value)}
                        onCheckedChange={() =>
                          setDraft({ months: toggleValue(draft.months, option.value) })
                        }
                      />
                      <span className="truncate">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-muted-foreground">Category</div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => setDraft({ categories: options.categories.map((option) => option.value) })}
                    >
                      Select all
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => setDraft({ categories: [] })}
                    >
                      Unselect all
                    </Button>
                  </div>
                </div>
                <div className="max-h-64 space-y-2 overflow-auto rounded-xl border border-border/70 bg-muted/30 p-2">
                  {options.categories.map((option) => (
                    <label key={option.value} className="flex cursor-pointer items-center gap-2 text-xs">
                      <Checkbox
                        checked={draft.categories.includes(option.value)}
                        onCheckedChange={() =>
                          setDraft({ categories: toggleValue(draft.categories, option.value) })
                        }
                      />
                      <span className="truncate">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-muted-foreground">Branch</div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => setDraft({ branches: options.branches.map((option) => option.value) })}
                    >
                      Select all
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => setDraft({ branches: [] })}
                    >
                      Unselect all
                    </Button>
                  </div>
                </div>
                <div className="max-h-64 space-y-2 overflow-auto rounded-xl border border-border/70 bg-muted/30 p-2">
                  {options.branches.map((option) => (
                    <label key={option.value} className="flex cursor-pointer items-center gap-2 text-xs">
                      <Checkbox
                        checked={draft.branches.includes(option.value)}
                        onCheckedChange={() =>
                          setDraft({ branches: toggleValue(draft.branches, option.value) })
                        }
                      />
                      <span className="truncate">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="min-w-0">
                <div className="mb-2 flex items-center justify-between gap-2">
                  <div className="text-xs font-semibold text-muted-foreground">Merchant</div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => setDraft({ merchants: options.merchants.map((option) => option.value) })}
                    >
                      Select all
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2 text-[10px]"
                      onClick={() => setDraft({ merchants: [] })}
                    >
                      Unselect all
                    </Button>
                  </div>
                </div>
                <div className="max-h-64 space-y-2 overflow-auto rounded-xl border border-border/70 bg-muted/30 p-2">
                  {options.merchants.map((option) => (
                    <label key={option.value} className="flex cursor-pointer items-center gap-2 text-xs">
                      <Checkbox
                        checked={draft.merchants.includes(option.value)}
                        onCheckedChange={() =>
                          setDraft({ merchants: toggleValue(draft.merchants, option.value) })
                        }
                      />
                      <span className="truncate">{option.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={resetAll}>
                Reset filter
              </Button>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>
        <Badge variant="secondary" className="rounded-full px-3 py-1 text-[11px] font-semibold">
          Latest update {latestMonth ? getMonthLabel(latestMonth) : "-"}
        </Badge>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="text-[11px]">
          {selectedSummary.month}
        </Badge>
        <Badge variant="outline" className="text-[11px]">
          {selectedSummary.category}
        </Badge>
        <Badge variant="outline" className="text-[11px]">
          {selectedSummary.branch}
        </Badge>
        <Badge variant="outline" className="text-[11px]">
          {selectedSummary.merchant}
        </Badge>
      </div>
    </div>
  );
}
