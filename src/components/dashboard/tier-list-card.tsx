import { useEffect, useRef, useState } from "react"
import {
  Copy,
  Download,
  MoreHorizontal,
  Pencil,
  Trash2,
  type LucideIcon,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { itemMap } from "@/hooks/use-lists"
import { cn } from "@/lib/utils"
import type { TierList } from "@/types"
import { itemCount, relativeTime } from "@/utils/format"

const MAX_ITEMS_PER_TIER = 7

/**
 * A real miniature of the list: one coloured bar per tier with that tier's
 * actual item thumbnails inside it.
 */
function TierListThumbnail({ list }: { list: TierList }) {
  const items = itemMap(list)

  if (list.tiers.length === 0) {
    return <div className="flex h-full items-center justify-center text-xs text-muted-foreground">No tiers</div>
  }

  return (
    <div className="flex h-full flex-col justify-center gap-1 p-3">
      {list.tiers.slice(0, 6).map((tier) => (
        <div key={tier.id} className="flex items-center gap-1.5">
          <div
            className="flex h-5 w-6 shrink-0 items-center justify-center rounded-[3px] text-[8px] font-bold text-black/70"
            style={{ backgroundColor: tier.color }}
          >
            {tier.name.slice(0, 2)}
          </div>
          <div className="flex min-w-0 flex-1 gap-px overflow-hidden">
            {tier.itemIds.slice(0, MAX_ITEMS_PER_TIER).map((id) => {
              const item = items.get(id)
              if (!item) return null
              return (
                <img
                  key={id}
                  src={item.image}
                  alt=""
                  loading="lazy"
                  className="size-5 shrink-0 rounded-[3px] object-cover"
                />
              )
            })}
            {tier.itemIds.length > MAX_ITEMS_PER_TIER && (
              <span className="flex size-5 shrink-0 items-center justify-center rounded-[3px] bg-muted text-[8px] font-semibold text-muted-foreground">
                +{tier.itemIds.length - MAX_ITEMS_PER_TIER}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

function KindBadge({ kind }: { kind: TierList["kind"] }) {
  const isGame = kind === "game"
  return (
    <Badge variant={isGame ? "default" : "secondary"} className="gap-1 text-[10px]">
      {isGame ? "Game" : "General"}
    </Badge>
  )
}

interface TierListCardProps {
  list: TierList
  onOpen: (id: string) => void
  onRename: (id: string, title: string) => void
  onDuplicate: (id: string) => void
  onExport: (id: string) => void
  onDelete: (id: string) => void
}

export function TierListCard({
  list,
  onOpen,
  onRename,
  onDuplicate,
  onExport,
  onDelete,
}: TierListCardProps) {
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(list.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (renaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [renaming])

  const commitRename = () => {
    const next = draft.trim()
    if (next && next !== list.title) onRename(list.id, next)
    else setDraft(list.title)
    setRenaming(false)
  }

  const actions: { label: string; icon: LucideIcon; run: () => void }[] = [
    { label: "Rename", icon: Pencil, run: () => setRenaming(true) },
    { label: "Duplicate", icon: Copy, run: () => onDuplicate(list.id) },
    { label: "Export JSON", icon: Download, run: () => onExport(list.id) },
  ]

  return (
    <div className="group relative overflow-hidden rounded-xl border bg-card transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={() => onOpen(list.id)}
        className="block w-full focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        aria-label={`Open ${list.title}`}
      >
        <div className="aspect-4/3 w-full overflow-hidden border-b bg-muted/40">
          <TierListThumbnail list={list} />
        </div>
      </button>

      <div className="absolute top-2 right-2 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="secondary"
              size="icon"
              className="size-7 shadow-sm"
              aria-label={`Actions for ${list.title}`}
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onSelect={() => onOpen(list.id)}>
              <Pencil className="size-4" />
              Open
            </DropdownMenuItem>
            {actions.map(({ label, icon: Icon, run }) => (
              <DropdownMenuItem key={label} onSelect={run}>
                <Icon className="size-4" />
                {label}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => onDelete(list.id)}
            >
              <Trash2 className="size-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          {renaming ? (
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === "Enter") commitRename()
                if (e.key === "Escape") {
                  setDraft(list.title)
                  setRenaming(false)
                }
              }}
              className="min-w-0 flex-1 rounded-md border bg-background px-1.5 py-0.5 text-sm font-medium focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setRenaming(true)}
              title="Rename"
              className={cn(
                "min-w-0 flex-1 truncate text-left text-sm font-medium hover:underline",
                "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
              )}
            >
              {list.title}
            </button>
          )}
          <KindBadge kind={list.kind} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {itemCount(list.items.length)} · Edited {relativeTime(list.updatedAt)}
        </p>
      </div>
    </div>
  )
}
