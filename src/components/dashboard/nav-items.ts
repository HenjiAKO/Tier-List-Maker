import type { ComponentType } from "react"
import { LayoutGrid, Trophy } from "lucide-react"

export interface NavItem {
  id: "home" | "all"
  label: string
  icon: ComponentType<{ className?: string }>
}

/**
 * Kept out of the rail component so this file only exports components, which
 * keeps React Fast Refresh working in dev.
 */
export const NAV_ITEMS: NavItem[] = [
  { id: "home", label: "Home", icon: Trophy },
  { id: "all", label: "All lists", icon: LayoutGrid },
]
