import { useMemo, useState } from "react"
import {
  ArrowLeft,
  Check,
  ChevronUp,
  Gamepad2,
  Package,
  Pencil,
  Plus,
  RotateCcw,
  X,
} from "lucide-react"
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
  MAX_RARITY_VALUES,
  MAX_STAR_LEVELS,
  MIN_STAR_LEVELS,
  SCHEME_PRESETS,
  parseCustomValues,
} from "@/data/rarity-schemes"
import { cn } from "@/lib/utils"
import type { ListKind, NewListInput, RarityScheme, SchemeId } from "@/types"

type Step = "kind" | "rarity" | "details"

/** The step that follows each entry point: a preset kind skips "kind". */
function stepForKind(kind: ListKind | null): Step {
  if (kind === "game") return "rarity"
  if (kind === "general") return "details"
  return "kind"
}

interface CreateListDialogProps {
  open: boolean
  initialKind?: ListKind | null
  onOpenChange: (open: boolean) => void
  onCreate: (input: NewListInput) => void
}

export function CreateListDialog({
  open,
  initialKind = null,
  onOpenChange,
  onCreate,
}: CreateListDialogProps) {
  const [step, setStep] = useState<Step>(() => stepForKind(initialKind))
  const [kind, setKind] = useState<ListKind | null>(initialKind)
  const [schemeId, setSchemeId] = useState<SchemeId>("stars")
  const [starCount, setStarCount] = useState(5)
  const [customValues, setCustomValues] = useState("")
  const [values, setValues] = useState<string[]>([])
  const [title, setTitle] = useState("")

  // A preset already answered the kind question, so Back must not return to it.
  const fromPreset = initialKind !== null

  const reset = () => {
    setStep(stepForKind(initialKind))
    setKind(initialKind)
    setSchemeId("stars")
    setStarCount(5)
    setCustomValues("")
    setValues([])
    setTitle("")
  }

  const close = (next: boolean) => {
    if (!next) reset()
    onOpenChange(next)
  }

  const preset = SCHEME_PRESETS.find((p) => p.id === schemeId)

  // Stars/custom always need their own value editor; the fixed presets don't.
  const editValues = schemeId === "stars" || schemeId === "custom"

  const generated = useMemo(() => {
    if (schemeId === "custom") return parseCustomValues(customValues)
    return preset?.build(starCount) ?? []
  }, [schemeId, customValues, starCount, preset])

  // Manual edits are kept verbatim so a row can be blank while typing; blanks
  // and duplicates are stripped before the scheme is built.
  const effectiveValues = useMemo(() => {
    if (!editValues || values.length === 0) return generated
    const seen = new Set<string>()
    const cleaned = values
      .map((v) => v.trim())
      .filter((v) => {
        if (!v || seen.has(v)) return false
        seen.add(v)
        return true
      })
    return cleaned.length > 0 ? cleaned : generated
  }, [editValues, values, generated])

  const chooseKind = (next: ListKind) => {
    setKind(next)
    setStep(next === "game" ? "rarity" : "details")
  }

  const chooseScheme = (next: SchemeId) => {
    setSchemeId(next)
    setValues([])
  }

  const rarity: RarityScheme | null = useMemo(() => {
    if (kind !== "game" || effectiveValues.length === 0) return null
    return {
      scheme: schemeId,
      label: preset?.name ?? "Custom",
      values: effectiveValues,
    }
  }, [kind, effectiveValues, schemeId, preset])

  const submit = () => {
    if (!kind) return
    onCreate({ title: title.trim() || "Untitled tier list", kind, rarity })
    close(false)
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {step === "kind" && "What kind of tier list?"}
            {step === "rarity" && "Pick a rarity system"}
            {step === "details" && (kind === "game" ? "Name your game list" : "Name your list")}
          </DialogTitle>
          <DialogDescription>
            {step === "kind" &&
              "Game lists add a rarity badge to every item. General lists are the same without it."}
            {step === "rarity" &&
              "Choose how your game grades rarity. Every item you add will pick a value from this list."}
            {step === "details" && "You can change the title and rarity later."}
          </DialogDescription>
        </DialogHeader>

        {step === "kind" && (
          <div className="grid gap-3 sm:grid-cols-2">
            <KindOption
              icon={Gamepad2}
              title="Game"
              description="Items carry a rarity badge"
              onClick={() => chooseKind("game")}
            />
            <KindOption
              icon={Package}
              title="General"
              description="Images, names and notes only"
              onClick={() => chooseKind("general")}
            />
          </div>
        )}

        {step === "rarity" && (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-2">
              {SCHEME_PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => chooseScheme(p.id)}
                  className={cn(
                    "rounded-lg border p-3 text-left transition-colors",
                    "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                    schemeId === p.id && "border-primary bg-accent",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{p.name}</span>
                    {schemeId === p.id && <Check className="size-4 text-primary" />}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">{p.description}</p>
                  <p className="mt-2 font-mono text-[11px] text-muted-foreground">{p.example}</p>
                </button>
              ))}

              <button
                type="button"
                onClick={() => chooseScheme("custom")}
                className={cn(
                  "rounded-lg border p-3 text-left transition-colors",
                  "hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                  schemeId === "custom" && "border-primary bg-accent",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Custom</span>
                  {schemeId === "custom" && <Check className="size-4 text-primary" />}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">Type your own values</p>
                <p className="mt-2 font-mono text-[11px] text-muted-foreground">Godly, Mythic, Trash…</p>
              </button>
            </div>

            {preset?.asksForCount && (
              <div className="space-y-2">
                <Label htmlFor="star-count">How many star levels?</Label>
                <div className="flex items-center gap-3">
                  <input
                    id="star-count"
                    type="range"
                    min={MIN_STAR_LEVELS}
                    max={MAX_STAR_LEVELS}
                    value={starCount}
                    onChange={(e) => {
                      setStarCount(Number(e.target.value))
                      setValues([])
                    }}
                    className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary"
                  />
                  <span className="w-8 text-center text-sm font-medium tabular-nums">
                    {starCount}
                  </span>
                </div>
              </div>
            )}

            {schemeId === "custom" && (
              <div className="space-y-2">
                <Label htmlFor="custom-values">Rarity values</Label>
                <Input
                  id="custom-values"
                  value={customValues}
                  onChange={(e) => {
                    setCustomValues(e.target.value)
                    setValues([])
                  }}
                  placeholder="Godly, Mythic, Trash"
                />
                <p className="text-xs text-muted-foreground">
                  Separate with commas, highest first.
                </p>
              </div>
            )}

            {effectiveValues.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Items can be tagged</Label>
                  {editValues && (
                    <div className="flex items-center gap-1">
                      {values.length > 0 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setValues([])}
                        >
                          <RotateCcw className="mr-1 size-3" />
                          Reset
                        </Button>
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() =>
                          setValues(values.length > 0 ? values : [...generated])
                        }
                      >
                        <Pencil className="mr-1 size-3" />
                        {values.length > 0 ? "Done editing" : "Edit values"}
                      </Button>
                    </div>
                  )}
                </div>

                {values.length > 0 ? (
                  <div className="space-y-2">
                    {values.map((v, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        <span className="w-5 shrink-0 text-center text-xs text-muted-foreground">
                          {i === 0 ? "1st" : `${i + 1}th`}
                        </span>
                        <Input
                          value={v}
                          onChange={(e) =>
                            setValues(values.map((old, j) => (j === i ? e.target.value : old)))
                          }
                          className="h-8 font-mono text-xs"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          aria-label={`Move ${v || "value"} up`}
                          disabled={i === 0}
                          onClick={() => {
                            const next = [...values]
                            ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
                            setValues(next)
                          }}
                        >
                          <ChevronUp className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 shrink-0"
                          aria-label={`Remove ${v || "value"}`}
                          disabled={values.length <= 1}
                          onClick={() => setValues(values.filter((_, j) => j !== i))}
                        >
                          <X className="size-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 w-full text-xs"
                      disabled={MAX_RARITY_VALUES <= values.length}
                      onClick={() => setValues([...values, ""])}
                    >
                      <Plus className="mr-1 size-3" />
                      Add value
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {effectiveValues.map((v) => (
                      <span
                        key={v}
                        className="rounded-md bg-secondary px-2 py-1 font-mono text-xs font-medium"
                      >
                        {v}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {step === "details" && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="list-title">Title</Label>
              <Input
                id="list-title"
                autoFocus
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && kind) submit()
                }}
                placeholder={kind === "game" ? "Best gacha characters" : "Best foods"}
              />
            </div>
            {rarity && (
              <div className="rounded-lg border bg-muted/40 p-3">
                <p className="text-xs font-medium text-muted-foreground">Rarity</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {rarity.values.map((v) => (
                    <span key={v} className="rounded-md bg-background px-2 py-1 font-mono text-xs">
                      {v}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <DialogFooter className="sm:justify-between">
          {step === "kind" || fromPreset ? (
            <span />
          ) : (
            <Button
              variant="ghost"
              onClick={() => setStep(step === "details" ? (kind === "game" ? "rarity" : "kind") : "kind")}
            >
              <ArrowLeft className="mr-1 size-4" />
              Back
            </Button>
          )}
          {step === "rarity" && (
            <Button onClick={() => setStep("details")}>Continue</Button>
          )}
          {step === "details" && (
            <Button onClick={submit} disabled={!kind}>
              Create list
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function KindOption({
  icon: Icon,
  title,
  description,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex flex-col items-start gap-2 rounded-lg border p-4 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
    >
      <Icon className="size-6 text-primary" />
      <span className="text-sm font-medium">{title}</span>
      <span className="text-xs text-muted-foreground">{description}</span>
    </button>
  )
}
