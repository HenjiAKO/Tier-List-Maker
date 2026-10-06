import { useRef, useState } from "react"
import { ImagePlus, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { ItemTile, DRAG_MIME } from "@/components/editor/item-tile"
import {
  ACCEPT_ATTRIBUTE,
  imageFilesFromDrop,
  processImageFiles,
} from "@/utils/image"
import type { NewItemInput } from "@/hooks/use-lists"
import { isDesktop, pickImages } from "@/lib/desktop"
import { cn } from "@/lib/utils"
import type { TierItem } from "@/types"

interface ItemPoolProps {
  items: TierItem[]
  /** Ids matching the active search / rarity filter. */
  matchedIds: Set<string>
  selectedItemId: string | null
  hasRarityFilter: boolean
  onAdd: (items: NewItemInput[]) => void
  onUnplace: (itemId: string) => void
  onSelectItem: (itemId: string | null) => void
  onEditItem: (itemId: string) => void
}

export function ItemPool({
  items,
  matchedIds,
  selectedItemId,
  hasRarityFilter,
  onAdd,
  onUnplace,
  onSelectItem,
  onEditItem,
}: ItemPoolProps) {
  const [over, setOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const ingest = async (files: FileList | File[] | null) => {
    if (!files || !("length" in files) || files.length === 0) return
    const { accepted, rejected } = await processImageFiles(files)
    if (accepted.length > 0) {
      onAdd(accepted.map((a) => ({ image: a.dataUrl, name: a.name })))
      toast.success(`Added ${accepted.length} ${accepted.length === 1 ? "item" : "items"}`)
    }
    for (const r of rejected) toast.error(r.reason)
  }

  const handleDrop = (e: React.DragEvent) => {
    // Items dragged out of a tier come back to the pool.
    const itemId = e.dataTransfer.getData(DRAG_MIME)
    if (itemId) {
      e.preventDefault()
      onUnplace(itemId)
      onSelectItem(null)
      return
    }
    // Otherwise it's files coming from the desktop.
    const files = imageFilesFromDrop(e.dataTransfer)
    if (files.length === 0) return
    e.preventDefault()
    void ingest(files)
  }

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault()
        setOver(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        setOver(false)
      }}
      onDrop={handleDrop}
      className={cn(
        "rounded-lg border border-dashed bg-card p-3 transition-colors",
        over && "border-primary bg-accent/40",
      )}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-semibold">
          Unplaced
          <span className="ml-1.5 font-normal text-muted-foreground">{items.length}</span>
        </h2>
        <p className="text-xs text-muted-foreground">
          Drop PNG or JPG files here, or click to pick them.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT_ATTRIBUTE}
          multiple
          className="hidden"
          onChange={(e) => {
            void ingest(e.target.files)
            e.target.value = ""
          }}
        />
        <Button
          variant="outline"
          size="sm"
          className="ml-auto"
          onClick={() => {
            // Desktop gets the native picker; the browser keeps the hidden input.
            if (isDesktop()) {
              void pickImages().then((files) => {
                if (files.length > 0) void ingest(files)
              })
              return
            }
            fileRef.current?.click()
          }}
        >
          <Upload className="size-4" />
          Add images
        </Button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-10 text-center">
          <ImagePlus className="size-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">No items yet</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">
            Add PNG or JPG images. Each one becomes an item you can name and drag into a tier.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-1">
          {items.map((item) => (
            <div key={item.id} onDoubleClick={() => onEditItem(item.id)}>
              <ItemTile
                item={item}
                size="sm"
                dimmed={hasRarityFilter && !matchedIds.has(item.id)}
                selected={selectedItemId === item.id}
                onClick={() => {
                  if (selectedItemId === item.id) onSelectItem(null)
                  else onSelectItem(item.id)
                }}
                onDragStart={(e) => {
                  e.dataTransfer.setData(DRAG_MIME, item.id)
                  e.dataTransfer.effectAllowed = "move"
                }}
              />
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
