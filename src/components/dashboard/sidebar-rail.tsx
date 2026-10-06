import { Plus, Trophy } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { NAV_ITEMS, type NavItem } from "@/components/dashboard/nav-items"
import { cn } from "@/lib/utils"

interface SidebarRailProps {
  active: NavItem["id"]
  onSelect: (id: NavItem["id"]) => void
  onCreate: () => void
  /** Shown under the nav on wide screens only. */
  listCount: number
}

/**
 * Canva-style left rail. Full labels from `lg` up, icons only below that.
 */
export function SidebarRail({ active, onSelect, onCreate, listCount }: SidebarRailProps) {
  return (
    <aside className="hidden w-16 shrink-0 flex-col gap-1 border-r bg-sidebar p-3 lg:flex lg:w-56">
      <div className="mb-4 hidden items-center gap-2 px-2 lg:flex">
        <Trophy className="size-5 text-sidebar-primary" />
        <span className="text-sm font-semibold">Tier List Maker</span>
      </div>

      <Button
        onClick={onCreate}
        className="mb-2 w-full justify-start gap-2"
        title="Create a new tier list"
      >
        <Plus className="size-4" />
        <span className="hidden lg:inline">New tier list</span>
      </Button>

      <nav className="flex flex-col gap-1">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = active === item.id
          return (
            <Tooltip key={item.id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSelect(item.id)}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    "justify-center lg:justify-start",
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                  )}
                >
                  <Icon className="size-4 shrink-0" />
                  <span className="hidden lg:inline">{item.label}</span>
                  {item.id === "all" && (
                    <span className="ml-auto hidden text-xs text-muted-foreground lg:inline">
                      {listCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="lg:hidden">
                {item.label}
              </TooltipContent>
            </Tooltip>
          )
        })}
      </nav>
    </aside>
  )
}
