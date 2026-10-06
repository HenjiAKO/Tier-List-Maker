import { toPng } from "html-to-image"
import { newId } from "@/data/defaults"
import type { SchemeId, TierItem, TierList } from "@/types"

export const EXPORT_FILE_VERSION = 1

const SCHEME_IDS: SchemeId[] = ["stars", "letters", "common", "gacha", "custom"]

function slugify(text: string): string {
  return (
    text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "tier-list"
  )
}

/**
 * Reads a JSON file chosen by the user.
 *
 * Uses a transient hidden file input. A cancelled picker fires no event in most
 * browsers, so the promise simply never settles; that is fine for a helper
 * input that gets garbage collected with it.
 */
export function chooseJsonFile(): Promise<{ name: string; text: string } | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/json,.json"
    input.onchange = async () => {
      const file = input.files?.[0]
      resolve(file ? { name: file.name, text: await file.text() } : null)
    }
    input.click()
  })
}

/**
 * Saves text or a data URL to disk.
 *
 * A data URL is decoded to real bytes first, otherwise the PNG would land on
 * disk as the base64 string rather than an image.
 */
function saveFile(suggestedName: string, data: string): boolean {
  const match = /^data:[^;,]*;base64,(.+)$/.exec(data)
  const parts = match
    ? [Uint8Array.from(atob(match[1]), (c) => c.charCodeAt(0))]
    : [data]

  const url = URL.createObjectURL(new Blob(parts, { type: match ? "image/png" : "application/json" }))
  const link = document.createElement("a")
  link.href = url
  link.download = suggestedName
  link.click()
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

/** Exports a list as JSON. */
export function exportListJson(list: TierList): boolean {
  return saveFile(
    `${slugify(list.title)}.json`,
    JSON.stringify({ version: EXPORT_FILE_VERSION, lists: [list] }, null, 2),
  )
}

/** Exports the whole library as one backup file. */
export function exportAllJson(lists: TierList[]): boolean {
  return saveFile(
    "tier-list-maker.json",
    JSON.stringify({ version: EXPORT_FILE_VERSION, lists }, null, 2),
  )
}

/**
 * Renders a node to PNG.
 *
 * html-to-image goes through SVG foreignObject, so the browser paints the
 * result itself — which is why the shadcn theme's oklch() colours come out
 * correctly (html2canvas cannot parse them).
 */
export async function downloadNodeAsPng(
  node: HTMLElement,
  filename: string,
  onBefore?: () => Promise<void> | void,
) {
  await onBefore?.()
  const dataUrl = await toPng(node, {
    pixelRatio: 2,
    cacheBust: true,
    backgroundColor: getComputedStyle(document.body).backgroundColor,
  })
  return saveFile(`${slugify(filename)}.png`, dataUrl)
}

/* -------------------------------- importing -------------------------------- */

function asItem(value: unknown): TierItem | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  if (typeof v.id !== "string" || typeof v.image !== "string") return null
  return {
    id: v.id,
    name: typeof v.name === "string" ? v.name : "",
    image: v.image,
    rarity: typeof v.rarity === "string" ? v.rarity : null,
    note: typeof v.note === "string" ? v.note : "",
  }
}

function asList(value: unknown): TierList | null {
  if (!value || typeof value !== "object") return null
  const v = value as Record<string, unknown>
  if (!Array.isArray(v.tiers) || !Array.isArray(v.items)) return null

  const knownItems = new Set<string>()
  const items = (v.items as unknown[]).map(asItem).filter((i): i is TierItem => Boolean(i))
  for (const item of items) knownItems.add(item.id)

  const tiers = (v.tiers as unknown[])
    .filter((t): t is Record<string, unknown> => Boolean(t) && typeof t === "object")
    .map((t) => ({
      id: typeof t.id === "string" ? t.id : newId(),
      name: typeof t.name === "string" ? t.name : "Tier",
      color: typeof t.color === "string" ? t.color : "#94a3b8",
      // Drop references to items the file didn't include.
      itemIds: Array.isArray(t.itemIds)
        ? t.itemIds.filter((id): id is string => typeof id === "string" && knownItems.has(id))
        : [],
    }))

  if (tiers.length === 0) return null

  const now = Date.now()
  const rarity = v.rarity as Record<string, unknown> | null | undefined
  const rarityValues =
    rarity && typeof rarity === "object" && Array.isArray(rarity.values)
      ? rarity.values.filter((x): x is string => typeof x === "string" && Boolean(x.trim()))
      : []

  return {
    // Always mint a fresh id: importing the same file twice must not produce
    // two lists sharing an id, which would collide in keys and React state.
    id: newId(),
    title: typeof v.title === "string" && v.title.trim() ? v.title : "Imported tier list",
    kind: v.kind === "game" ? "game" : "general",
    rarity:
      rarityValues.length > 0
        ? {
            scheme: SCHEME_IDS.includes(rarity?.scheme as SchemeId)
              ? (rarity?.scheme as SchemeId)
              : "custom",
            label: typeof rarity?.label === "string" ? rarity.label : "Custom",
            values: rarityValues,
          }
        : null,
    tiers,
    items,
    createdAt: typeof v.createdAt === "number" ? v.createdAt : now,
    updatedAt: now,
  }
}

/**
 * Accepts a single list, a bare array, or a `{ version, lists }` bundle, so
 * files exported from any of those shapes open cleanly.
 */
export function parseListJson(text: string): TierList[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error("That file isn't valid JSON.")
  }

  const candidates = Array.isArray(data)
    ? data
    : data && typeof data === "object"
      ? Array.isArray((data as Record<string, unknown>).lists)
        ? ((data as Record<string, unknown>).lists as unknown[])
        : [data]
      : []

  const lists = candidates.map(asList).filter((l): l is TierList => Boolean(l))
  if (lists.length === 0) {
    throw new Error("No tier lists found in that file.")
  }
  return lists
}
