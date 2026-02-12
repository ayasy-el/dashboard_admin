import * as React from "react"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cn } from "@/lib/utils"

type TableCardProps = {
  title?: string
  description?: string
  className?: string
  contentClassName?: string
  headerClassName?: string
  children: React.ReactNode
}

export function TableCard({
  title,
  description,
  className,
  contentClassName,
  headerClassName,
  children,
}: TableCardProps) {
  return (
    <Card className={cn("gap-0 overflow-hidden py-0", className)}>
      {(title || description) && (
        <CardHeader className={cn("border-b border-border/70 px-8 py-6", headerClassName)}>
          {title ? <CardTitle className="text-base font-semibold">{title}</CardTitle> : null}
          {description ? <CardDescription>{description}</CardDescription> : null}
        </CardHeader>
      )}
      <CardContent className={cn("p-0", contentClassName)}>
        {children}
      </CardContent>
    </Card>
  )
}
