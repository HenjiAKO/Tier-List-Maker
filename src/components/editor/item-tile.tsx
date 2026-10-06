import { memo } from "react"
import { ImageIcon, StickyNote } from "lucide-react"
import { cn } from "@/lib/utils"
import type { TierItem } from "@/types"

export const DRAG_MIME = "application/x-tlm-item"

interface ItemTileProps {
  item: TierItem
  size?: "sm" | "md"
  selected?: boolean
  /** Active drop indicator while reordering. */
  dropSide?: "left" | "right" | null
  /** Dimmed when a search or rarity filter excludes it. */
  dimmed?: boolean
  showRarity?: boolean
  onClick?: () => void
  onDragStart?: (e: React.DragEvent) => void
  onDragEnd?: () => void
  onDragOver?: (e: React.DragEvent) => void
}

const SIZES = {
  sm: { img: "size-8", label: "text-[9px]", badge: "text-[8px]" },
  md: { img: "size-12", label: "text-[10px]", badge: "text-[9px]" },
} as const

function ItemTileBase({
  item,
  size = "md",
  selected = false,
  dropSide = null,
  dimmed = false,
  showRarity = true,
  onClick,
  onDragStart,
  onDragEnd,
  onDragOver,
}: ItemTileProps) {
  const s = SIZES[size]

  return (
    <div
      data-item-tile=""
      className={cn(
        "group relative flex shrink-0 cursor-grab flex-col items-center gap-0.5 rounded-lg p-1 transition-all active:cursor-grabbing",
        onClick && "cursor-pointer hover:bg-accent",
        dimmed && "opacity-25",
        selected && "bg-accent ring-2 ring-ring",
        dropSide === "left" && "ring-2 ring-primary ring-offset-1 ring-offset-background",
        dropSide === "right" && "-ml-0.5 ring-2 ring-primary ring-offset-1 ring-offset-background",
      )}
      draggable={Boolean(onDragStart)}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                onClick()
              }
            }
          : undefined
      }
      title={item.note ? `${item.name} — ${item.note}` : item.name || "Unnamed"}
    >
      <div className="relative">
        {item.image ? (
          <img
            src={item.image}
            alt={item.name || "Item"}
            draggable={false}
            className={cn(s.img, "rounded-md object-cover ring-1 ring-border")}
          />
        ) : (
          <div
            className={cn(
              s.img,
              "flex items-center justify-center rounded-md bg-muted ring-1 ring-border",
            )}
          >
            <ImageIcon className="size-4 text-muted-foreground" />
          </div>
        )}

        {showRarity && item.rarity && (
          <span
            className={cn(
              s.badge,
              "absolute -top-1 -left-1 rounded bg-black/80 px-1 font-bold text-white",
            )}
          >
            {item.rarity}
          </span>
        )}

        {item.note && (
          <span className="absolute -right-1 -bottom-1 flex size-3.5 items-center justify-center rounded-full bg-background ring-1 ring-border">
            <StickyNote className="size-2 text-muted-foreground" />
          </span>
        )}
      </div>

      {item.name && (
        <span className={cn(s.label, "w-full truncate text-center leading-tight")}>
          {item.name}
        </span>
      )}
    </div>
  )
}

export const ItemTile = memo(ItemTileBase)
