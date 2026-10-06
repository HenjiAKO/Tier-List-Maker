import { useState } from "react"
import { Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { ACCEPT_ATTRIBUTE, processImageFiles } from "@/utils/image"
import { toast } from "sonner"
import type { RarityScheme, TierItem } from "@/types"

const NO_RARITY = "__none__"

interface ItemEditDialogProps {
  /**
   * Non-null by design: the caller keys this component on the item id so
   * editing a different item remounts it with fresh initial state.
   */
  item: TierItem
  rarity: RarityScheme | null
  onOpenChange: (open: boolean) => void
  onSave: (itemId: string, patch: Partial<Omit<TierItem, "id">>) => void
  onDelete: (itemId: string) => void
}

export function ItemEditDialog({
  item,
  rarity,
  onOpenChange,
  onSave,
  onDelete,
}: ItemEditDialogProps) {
  const [name, setName] = useState(item.name)
  const [note, setNote] = useState(item.note)
  const [value, setValue] = useState<string>(item.rarity ?? NO_RARITY)
  const [image, setImage] = useState(item.image)

  const replaceImage = async (files: FileList | File[] | null) => {
    if (!files?.length) return
    const { accepted, rejected } = await processImageFiles(files)
    if (accepted[0]) setImage(accepted[0].dataUrl)
    for (const r of rejected) toast.error(r.reason)
  }

  const save = () => {
    onSave(item.id, { name: name.trim(), note: note.trim(), rarity: value === NO_RARITY ? null : value, image })
    onOpenChange(false)
  }

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit item</DialogTitle>
          <DialogDescription>Name it, tag its rarity and jot down a note.</DialogDescription>
        </DialogHeader>

        <div className="flex gap-4">
          <div className="shrink-0">
            <img
              src={image}
              alt=""
              className="size-24 rounded-lg object-cover ring-1 ring-border"
            />
            <button
              type="button"
              onClick={() => document.getElementById("item-image-input")?.click()}
              className="mt-2 block w-full cursor-pointer text-center text-xs text-primary hover:underline"
            >
              Replace
            </button>
            <input
              id="item-image-input"
              type="file"
              accept={ACCEPT_ATTRIBUTE}
              className="hidden"
              onChange={(e) => {
                void replaceImage(e.target.files)
                e.target.value = ""
              }}
            />
          </div>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="item-name">Name</Label>
              <Input
                id="item-name"
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") save()
                }}
              />
            </div>

            {rarity && (
              <div className="space-y-1.5">
                <Label htmlFor="item-rarity">Rarity</Label>
                <Select value={value} onValueChange={setValue}>
                  <SelectTrigger id="item-rarity" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_RARITY}>No rarity</SelectItem>
                    {rarity.values.map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="item-note">Note</Label>
          <Textarea
            id="item-note"
            rows={3}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Why it landed here…"
          />
        </div>

        <DialogFooter className="sm:justify-between">
          <Button
            variant="destructive"
            onClick={() => {
              onDelete(item.id)
              onOpenChange(false)
            }}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
