import {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  XIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * The shadcn registry ships icons as a multi-library `IconPlaceholder` so a
 * single component can be swapped between icon sets. We only ship lucide, so
 * this resolves the `lucide` name and drops the rest.
 */
const ICONS = {
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  XIcon,
} as const

export interface IconPlaceholderProps extends React.ComponentProps<"svg"> {
  lucide: keyof typeof ICONS
  className?: string
  /** Accepted and ignored: the registry offers alternative icon sets. */
  tabler?: string
  hugeicons?: string
  phosphor?: string
  remixicon?: string
}

export function IconPlaceholder({ lucide: name, className }: IconPlaceholderProps) {
  const Icon = ICONS[name]
  if (!Icon) return null
  return <Icon className={cn("size-4", className)} />
}
