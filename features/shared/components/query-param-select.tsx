"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type QueryParamOption = {
  value: string;
  label: string;
};

type QueryParamSelectProps = {
  value: string | null;
  options: QueryParamOption[];
  paramKey: string;
  allLabel: string;
  placeholder: string;
  ariaLabel: string;
  className?: string;
};

const ALL_VALUE = "__all__";

export function QueryParamSelect({
  value,
  options,
  paramKey,
  allLabel,
  placeholder,
  ariaLabel,
  className,
}: QueryParamSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const selectedValue = value ?? ALL_VALUE;

  const onValueChange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());

    if (next === ALL_VALUE) {
      params.delete(paramKey);
    } else {
      params.set(paramKey, next);
    }

    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <Select value={selectedValue} onValueChange={onValueChange}>
      <SelectTrigger className={className} size="sm" aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        <SelectItem value={ALL_VALUE} className="rounded-lg">
          {allLabel}
        </SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="rounded-lg">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
