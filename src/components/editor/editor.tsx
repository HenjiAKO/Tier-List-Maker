import { useMemo, useRef, useState } from "react"
import { ArrowLeft, Download, FileDown, Plus, Search, SlidersHorizontal, X } from "lucide-react"
import { toast } from "sonner"
import { ThemeControls } from "@/components/theme-controls"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ItemEditDialog } from "@/components/editor/item-edit-dialog"
import { ItemPool } from "@/components/editor/item-pool"
import { TierRow } from "@/components/editor/tier-row"
import { itemMap, unplacedIds, type ListsApi } from "@/hooks/use-lists"
import { cn } from "@/lib/utils"
import type { TierItem, TierList } from "@/types"
import { exportListJson, downloadNodeAsPng } from "@/utils/files"

const ALL_RARITIES = "__all__"
const NO_RARITY = "__none__"

interface EditorProps {
  list: TierList
  api: ListsApi
  onBack: () => void
}

export function Editor({ list, api, onBack }: EditorProps) {
  const [query, setQuery] = useState("")
  const [rarityFilter, setRarityFilter] = useState<string>(ALL_RARITIES)
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)
  const [newTierName, setNewTierName] = useState("")
  const [busy, setBusy] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

  const items = useMemo(() => itemMap(list), [list])
  const loose = useMemo(() => unplacedIds(list).map((id) => items.get(id)).filter(isItem), [list, items])

  const matchedIds = useMemo(() => {
    const q = query.trim().toLowerCase()
    const out = new Set<string>()
    for (const item of list.items) {
      if (q && !item.name.toLowerCase().includes(q) && !item.note.toLowerCase().includes(q)) continue
      if (rarityFilter === NO_RARITY && item.rarity !== null) continue
      if (rarityFilter !== ALL_RARITIES && rarityFilter !== NO_RARITY && item.rarity !== rarityFilter) {
        continue
      }
      out.add(item.id)
    }
    return out
  }, [list.items, query, rarityFilter])

  const filtering = query.trim().length > 0 || rarityFilter !== ALL_RARITIES
  const hasRarity = list.kind === "game" && list.rarity !== null

  const exportPng = async () => {
    if (!exportRef.current) return
    setBusy(true)
    try {
      const saved = await downloadNodeAsPng(exportRef.current, list.title)
      if (saved) toast.success("Saved PNG")
    } catch {
      toast.error("Could not render the image.")
    } finally {
      setBusy(false)
    }
  }

  const addTier = () => {
    const name = newTierName.trim()
    if (!name) return
    api.addTier(list.id, name)
    setNewTierName("")
  }

  const selectedItem = selectedItemId ? items.get(selectedItemId) ?? null : null
  const editingItem = editingItemId ? items.get(editingItemId) ?? null : null

  return (
    <div className="flex min-h-svh flex-col bg-background">
      <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur sm:px-4">
        <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to dashboard">
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="truncate text-sm font-semibold sm:text-base">{list.title}</h1>
        <Badge variant={hasRarity ? "default" : "secondary"} className="hidden text-[10px] sm:inline-flex">
          {hasRarity ? list.rarity?.label : "General"}
        </Badge>

        <div className="ml-auto flex items-center gap-1.5">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Export">
                <Download className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Export</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => void exportPng()} disabled={busy}>
                <FileDown className="size-4" />
                {busy ? "Rendering…" : "PNG image"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  if (exportListJson(list)) toast.success("Exported JSON")
                }}
              >
                <FileDown className="size-4" />
                JSON file
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <ThemeControls />
        </div>
      </header>

      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4">
        <div className="relative min-w-48 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search items"
            aria-label="Search items"
            className="h-9 pl-9"
          />
        </div>

        {hasRarity && (
          <Select value={rarityFilter} onValueChange={setRarityFilter}>
            <SelectTrigger className="h-9 w-40" aria-label="Filter by rarity">
              <SlidersHorizontal className="size-4" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_RARITIES}>All rarities</SelectItem>
              <SelectItem value={NO_RARITY}>No rarity</SelectItem>
              {list.rarity?.values.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {filtering && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setQuery("")
              setRarityFilter(ALL_RARITIES)
            }}
          >
            <X className="size-4" />
            Clear
          </Button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {list.items.length} items · {list.items.length - loose.length} placed
        </span>
      </div>

      {/* selection banner for touch users */}
      {selectedItem && (
        <div className="flex items-center gap-2 border-b bg-accent/50 px-3 py-2 text-sm sm:px-4">
          <span className="text-xs font-medium">Selected:</span>
          <span className="truncate font-medium">{selectedItem.name || "Unnamed"}</span>
          <span className="text-xs text-muted-foreground">— tap a tier to place it</span>
          <div className="ml-auto flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                api.placeItem(list.id, selectedItem.id, null)
                setSelectedItemId(null)
              }}
            >
              Unplace
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setEditingItemId(selectedItem.id)}
            >
              Edit
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedItemId(null)}
              aria-label="Deselect"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      )}

      <main className="flex-1 space-y-4 p-3 sm:p-4">
        <div className="space-y-2">
          {list.tiers.map((tier, i) => (
            <TierRow
              key={tier.id}
              tier={tier}
              index={i}
              total={list.tiers.length}
              items={tier.itemIds.map((id) => items.get(id)).filter(isItem)}
              selectedItemId={selectedItemId}
              onPlace={(itemId, tierId, index) => api.placeItem(list.id, itemId, tierId, index)}
              onRename={(tierId, name) => api.updateTier(list.id, tierId, { name })}
              onRecolor={(tierId, color) => api.updateTier(list.id, tierId, { color })}
              onRemove={(tierId) => api.removeTier(list.id, tierId)}
              onMove={(tierId, dir) => api.moveTier(list.id, tierId, dir)}
              onSelectItem={setSelectedItemId}
              onEditItem={setEditingItemId}
            />
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Input
            value={newTierName}
            onChange={(e) => setNewTierName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") addTier()
            }}
            placeholder="Add a tier — e.g. Favourites, Trash"
            className="h-9 max-w-xs"
          />
          <Button variant="outline" size="sm" onClick={addTier}>
            <Plus className="size-4" />
            Add tier
          </Button>
        </div>

        <ItemPool
          items={loose}
          matchedIds={matchedIds}
          hasRarityFilter={filtering}
          selectedItemId={selectedItemId}
          onAdd={(added) => api.addItems(list.id, added)}
          onUnplace={(itemId) => api.placeItem(list.id, itemId, null)}
          onSelectItem={setSelectedItemId}
          onEditItem={setEditingItemId}
        />
      </main>

      {editingItem && (
        <ItemEditDialog
          key={editingItem.id}
          item={editingItem}
          rarity={list.rarity}
          onOpenChange={(open) => !open && setEditingItemId(null)}
          onSave={(itemId, patch) => api.updateItem(list.id, itemId, patch)}
          onDelete={(itemId) => api.removeItem(list.id, itemId)}
        />
      )}

      {/* Offscreen clean render used only for the PNG export. */}
      <div className="pointer-events-none fixed -left-[9999px] top-0" aria-hidden>
        <div
          ref={exportRef}
          className="w-[900px] bg-background p-8"
          data-export-surface=""
        >
          <ExportSurface list={list} items={items} />
        </div>
      </div>
    </div>
  )
}

function isItem(value: TierItem | undefined): value is TierItem {
  return value !== undefined
}

/**
 * Deliberately plain markup: this is what gets rasterised, so it avoids
 * hover states, focus rings and anything that only makes sense on screen.
 */
function ExportSurface({ list, items }: { list: TierList; items: Map<string, TierItem> }) {
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{list.title}</h1>
        {list.rarity && (
          <p className="mt-1 text-sm text-muted-foreground">
            Rarity: {list.rarity.values.join(" · ")}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {list.tiers.map((tier) => (
          <div key={tier.id} className="flex overflow-hidden rounded-lg border-2" style={{ borderColor: tier.color }}>
            <div
              className="flex w-28 shrink-0 items-center justify-center p-4 text-xl font-bold text-black/80"
              style={{ backgroundColor: tier.color }}
            >
              {tier.name}
            </div>
            <div className="flex flex-wrap gap-2 bg-card p-3">
              {tier.itemIds.map((id) => {
                const item = items.get(id)
                if (!item) return null
                return (
                  <div key={id} className="flex w-20 flex-col items-center gap-1">
                      <img src={item.image} alt="" className="size-20 rounded-md object-cover" />
                    <span className="w-full truncate text-center text-xs font-medium">
                      {item.name || "—"}
                    </span>
                    {item.rarity && (
                      <span className="rounded bg-black/80 px-1.5 text-[10px] font-bold text-white">
                        {item.rarity}
                      </span>
                    )}
                  </div>
                )
              })}
              {tier.itemIds.length === 0 && (
                <span className={cn("m-auto py-6 text-xs text-muted-foreground")}>Empty</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
