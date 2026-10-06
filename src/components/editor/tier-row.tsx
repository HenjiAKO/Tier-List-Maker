import { useRef, useState } from "react"
import { ChevronDown, ChevronUp, MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { TIER_COLOR_PALETTE } from "@/data/defaults"
import { ItemTile, DRAG_MIME } from "@/components/editor/item-tile"
import { cn } from "@/lib/utils"
import type { Tier, TierItem } from "@/types"

/** Where in the row a dragged item would land, from the pointer's x position. */
function indexFromPoint(container: HTMLElement, clientX: number): number {
  const tiles = Array.from(container.querySelectorAll<HTMLElement>("[data-item-tile]"))
  for (let i = 0; i < tiles.length; i += 1) {
    const rect = tiles[i].getBoundingClientRect()
    if (clientX < rect.left + rect.width / 2) return i
  }
  return tiles.length
}

interface TierRowProps {
  tier: Tier
  index: number
  total: number
  items: TierItem[]
  selectedItemId: string | null
  onPlace: (itemId: string, tierId: string, index: number) => void
  onRename: (tierId: string, name: string) => void
  onRecolor: (tierId: string, color: string) => void
  onRemove: (tierId: string) => void
  onMove: (tierId: string, direction: -1 | 1) => void
  onSelectItem: (itemId: string | null) => void
  onEditItem: (itemId: string) => void
}

export function TierRow({
  tier,
  index,
  total,
  items,
  selectedItemId,
  onPlace,
  onRename,
  onRecolor,
  onRemove,
  onMove,
  onSelectItem,
  onEditItem,
}: TierRowProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(tier.name)
  const [dropIndex, setDropIndex] = useState<number | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const itemsRef = useRef<HTMLDivElement>(null)

  const startRename = () => {
    setDraft(tier.name)
    setEditing(true)
  }

  const commitRename = () => {
    const next = draft.trim()
    if (next) onRename(tier.id, next)
    else setDraft(tier.name)
    setEditing(false)
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes(DRAG_MIME)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = "move"
    setDragOver(true)
    setDropIndex(itemsRef.current ? indexFromPoint(itemsRef.current, e.clientX) : 0)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const itemId = e.dataTransfer.getData(DRAG_MIME)
    const at = itemsRef.current ? indexFromPoint(itemsRef.current, e.clientX) : 0
    setDropIndex(null)
    if (!itemId) return
    if (itemId === selectedItemId) onSelectItem(null)
    onPlace(itemId, tier.id, at)
  }

  return (
    <div
      className={cn(
        "flex rounded-lg border bg-card transition-colors",
        dragOver && "border-primary bg-accent/40",
        selectedItemId && "ring-1 ring-primary/40",
      )}
      onDragOver={handleDragOver}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        setDragOver(false)
        setDropIndex(null)
      }}
      onDrop={handleDrop}
    >
      {/* label block */}
      <div
        className="flex w-20 shrink-0 flex-col items-center justify-center gap-1 rounded-l-lg p-2 text-black/80 sm:w-28"
        style={{ backgroundColor: tier.color }}
      >
        {editing ? (
          <Input
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitRename()
              if (e.key === "Escape") {
                setDraft(tier.name)
                setEditing(false)
              }
            }}
            onClick={(e) => e.stopPropagation()}
            className="h-7 border-black/20 bg-white/80 px-1 text-center text-sm font-bold"
          />
        ) : (
          <button
            type="button"
            onDoubleClick={startRename}
            title="Double-click to rename"
            className="max-w-full truncate text-sm font-bold"
          >
            {tier.name}
          </button>
        )}

        <span className="text-[10px] font-medium opacity-70">{items.length}</span>

        {/* The block only has room for a name and a count, so every action
            lives in one menu instead of a row of icon buttons. */}
        {!editing && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                title="Tier options"
                aria-label={`Tier options for ${tier.name}`}
                className="rounded p-0.5 hover:bg-black/10 focus-visible:ring-2 focus-visible:ring-black/40 focus-visible:outline-none"
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-44">
              <DropdownMenuItem onSelect={startRename}>
                <Pencil className="mr-2 size-4" />
                Rename
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={index === 0}
                onSelect={() => onMove(tier.id, -1)}
              >
                <ChevronUp className="mr-2 size-4" />
                Move up
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={index === total - 1}
                onSelect={() => onMove(tier.id, 1)}
              >
                <ChevronDown className="mr-2 size-4" />
                Move down
              </DropdownMenuItem>

              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Change colour</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-52">
                  {TIER_COLOR_PALETTE.map((color) => (
                    <DropdownMenuItem
                      key={color}
                      onSelect={() => onRecolor(tier.id, color)}
                      className={cn(
                        "gap-2",
                        tier.color.toLowerCase() === color.toLowerCase() && "font-semibold",
                      )}
                    >
                      <span
                        className={cn(
                          "size-4 shrink-0 rounded-full border border-black/30",
                          tier.color.toLowerCase() === color.toLowerCase() &&
                            "ring-2 ring-ring ring-offset-1 ring-offset-background",
                        )}
                        style={{ backgroundColor: color }}
                      />
                      {color}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>

              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                onSelect={() => onRemove(tier.id)}
              >
                <Trash2 className="mr-2 size-4" />
                Delete tier
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* items */}
      <div
        ref={itemsRef}
        className="flex min-h-20 flex-1 flex-wrap items-start gap-1 p-2"
        onClick={(e) => {
          // Clicking the empty part of the row places the selected item.
          // A tile click is handled by the tile itself, so anything that is
          // not inside one counts as empty space.
          const onTile = (e.target as HTMLElement).closest("[data-item-tile]")
          if (onTile || !selectedItemId) return
          onPlace(selectedItemId, tier.id, items.length)
          onSelectItem(null)
        }}
      >
        {items.map((item, i) => (
          <div
            key={item.id}
            className="flex items-center"
            onDoubleClick={() => onEditItem(item.id)}
          >
            {dropIndex === i && <span className="mx-0.5 h-10 w-0.5 rounded bg-primary" />}
            <ItemTile
              item={item}
              selected={selectedItemId === item.id}
              onClick={() => {
                onSelectItem(selectedItemId === item.id ? null : item.id)
              }}
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_MIME, item.id)
                e.dataTransfer.effectAllowed = "move"
              }}
              onDragEnd={() => setDropIndex(null)}
            />
          </div>
        ))}

        {dropIndex === items.length && dropIndex !== null && (
          <span className="mx-0.5 h-10 w-0.5 rounded bg-primary" />
        )}

        {items.length === 0 && dropIndex === null && (
          <span className="m-auto text-xs text-muted-foreground">
            {dragOver || selectedItemId ? "Click here to place" : "Drop items here"}
          </span>
        )}
      </div>
    </div>
  )
}
