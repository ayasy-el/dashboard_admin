"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

import { useBindGlobalLoading } from "@/components/global-loading-provider";
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
  placeholder: string;
  ariaLabel: string;
  className?: string;
};

export function QueryParamSelect({
  value,
  options,
  paramKey,
  placeholder,
  ariaLabel,
  className,
}: QueryParamSelectProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = React.useTransition();
  useBindGlobalLoading(isPending);

  const selectedValue = value ?? options[0]?.value ?? "";

  const onValueChange = (next: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set(paramKey, next);

    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  return (
    <Select value={selectedValue} onValueChange={onValueChange}>
      <SelectTrigger className={className} size="sm" aria-label={ariaLabel}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className="rounded-xl">
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className="rounded-lg">
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
