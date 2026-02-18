"use client";

import * as React from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type FilterOption = {
  value: string;
  label: string;
};

type MultiFilterDropdownProps = {
  title: string;
  paramKey: string;
  options: FilterOption[];
  selectedValues: string[];
  className?: string;
};

type SingleFilterDropdownProps = {
  title: string;
  paramKey: string;
  options: FilterOption[];
  selectedValue: string;
  className?: string;
};

const normalize = (value: string) => value.toLowerCase().trim();

function updateMultiParam({
  params,
  paramKey,
  values,
}: {
  params: URLSearchParams;
  paramKey: string;
  values: string[];
}) {
  params.delete(paramKey);
  for (const value of values) {
    params.append(paramKey, value);
  }
}

export function MultiFilterDropdown({
  title,
  paramKey,
  options,
  selectedValues,
  className,
}: MultiFilterDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = React.useState("");

  const selectedSet = React.useMemo(() => new Set(selectedValues), [selectedValues]);
  const allSelected = options.length > 0 && selectedValues.length === options.length;
  const filteredOptions = React.useMemo(() => {
    const keyword = normalize(query);
    if (!keyword) return options;
    return options.filter((option) => normalize(option.label).includes(keyword));
  }, [options, query]);

  const pushValues = (values: string[]) => {
    const params = new URLSearchParams(searchParams.toString());
    updateMultiParam({ params, paramKey, values });
    router.push(`${pathname}?${params.toString()}`);
  };

  const toggleValue = (value: string) => {
    if (selectedSet.has(value)) {
      pushValues(selectedValues.filter((item) => item !== value));
      return;
    }
    pushValues([...selectedValues, value]);
  };

  const selectOnly = (value: string) => {
    pushValues([value]);
  };

  // const toggleAll = () => {
  //   if (allSelected) {
  //     pushValues([]);
  //     return;
  //   }
  //   pushValues(options.map((option) => option.value));
  // };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("w-[200px] justify-between", className)}>
          <span className="truncate text-left">
            {selectedValues.length === 0 ? title : `${title} (${selectedValues.length})`}
          </span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[300px] p-0" align="end">
        <div className="space-y-3 p-3">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left text-base font-semibold uppercase hover:bg-muted/50"
            onClick={() => pushValues([])}
          >
            <span
              className={cn(
                "inline-flex size-4 items-center justify-center rounded-sm border",
                allSelected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
              )}
            >
              {allSelected ? <Check className="size-3" /> : null}
            </span>
            {title}
          </button>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ketik untuk menelusuri"
              className="h-9 pl-8 text-sm"
            />
          </div>
          {/* <div className="flex gap-2">
            <Button type="button" size="xs" variant="secondary" onClick={() => pushValues(options.map((item) => item.value))}>
              Pilih Semua
            </Button>
            <Button type="button" size="xs" variant="ghost" onClick={() => pushValues([])}>
              Batal Semua
            </Button>
          </div> */}
          <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
            {filteredOptions.map((option) => {
              const checked = selectedSet.has(option.value);
              return (
                <div key={option.value} className="group/item flex items-center gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm hover:bg-muted/50"
                    onClick={() => toggleValue(option.value)}
                  >
                    <span
                      className={cn(
                        "inline-flex size-4 shrink-0 items-center justify-center rounded-sm border",
                        checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                      )}
                    >
                      {checked ? <Check className="size-3" /> : null}
                    </span>
                    <span className="truncate">{option.label}</span>
                  </button>
                  <Button
                    type="button"
                    size="xs"
                    variant="secondary"
                    className="h-7 px-2 text-[11px] opacity-0 pointer-events-none transition-opacity group-hover/item:opacity-100 group-hover/item:pointer-events-auto focus-visible:opacity-100 focus-visible:pointer-events-auto"
                    onClick={() => selectOnly(option.value)}
                  >
                    HANYA
                  </Button>
                </div>
              );
            })}
            {filteredOptions.length === 0 ? (
              <div className="px-1 py-2 text-sm text-muted-foreground">Tidak ada data.</div>
            ) : null}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function SingleFilterDropdown({
  title,
  paramKey,
  options,
  selectedValue,
  className,
}: SingleFilterDropdownProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");

  const selectedLabel = options.find((option) => option.value === selectedValue)?.label ?? title;
  const filteredOptions = React.useMemo(() => {
    const keyword = normalize(query);
    if (!keyword) return options;
    return options.filter((option) => normalize(option.label).includes(keyword));
  }, [options, query]);

  const setValue = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramKey, value);
    router.push(`${pathname}?${params.toString()}`);
    setOpen(false);
  };

  return (
    <DropdownMenu modal={false} open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={cn("w-[220px] justify-between", className)}>
          <span className="truncate text-left">{selectedLabel}</span>
          <ChevronDown className="size-4 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-[320px] p-0" align="end">
        <div className="space-y-3 p-3">
          <div className="px-1 text-base font-semibold uppercase">{title}</div>
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ketik untuk menelusuri"
              className="h-9 pl-8 text-sm"
            />
          </div>
          <div className="max-h-72 space-y-1 overflow-y-auto pr-1">
            {filteredOptions.map((option) => {
              const checked = option.value === selectedValue;
              return (
                <button
                  key={option.value}
                  type="button"
                  className="flex w-full items-center gap-2 rounded-md px-1 py-1.5 text-left text-sm hover:bg-muted/50"
                  onClick={() => setValue(option.value)}
                >
                  <span
                    className={cn(
                      "inline-flex size-4 shrink-0 items-center justify-center rounded-full border",
                      checked ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40",
                    )}
                  >
                    {checked ? <Check className="size-3" /> : null}
                  </span>
                  <span className="truncate">{option.label}</span>
                </button>
              );
            })}
            {filteredOptions.length === 0 ? (
              <div className="px-1 py-2 text-sm text-muted-foreground">Tidak ada data.</div>
            ) : null}
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
