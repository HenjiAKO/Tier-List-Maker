import { toPng } from "html-to-image"
import { newId } from "@/data/defaults"
import { isDesktop, openJsonFile, saveFile } from "@/lib/desktop"
import { storeImage } from "@/utils/media-store"
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

function isDataUrl(value: string): boolean {
  return /^data:[^;,]+;base64,/.test(value)
}

/**
 * Reads a JSON file chosen by the user.
 *
 * Uses the native dialog on desktop and falls back to a hidden file input in a
 * browser. Returns null when the user cancels.
 */
export async function chooseJsonFile(): Promise<{ name: string; text: string } | null> {
  if (isDesktop()) {
    const text = await openJsonFile()
    return text === null ? null : { name: "tier list", text }
  }

  return new Promise((resolve) => {
    const input = document.createElement("input")
    input.type = "file"
    input.accept = "application/json,.json"
    input.onchange = async () => {
      const file = input.files?.[0]
      resolve(file ? { name: file.name, text: await file.text() } : null)
    }
    // A cancelled picker fires no event in most browsers, so the promise simply
    // never settles; that is fine for a transient helper input.
    input.click()
  })
}

/** Rewrites data-URL images to files under the library's media folder. */
export async function inlineImagesAsFiles(lists: TierList[]): Promise<TierList[]> {
  if (!isDesktop()) return lists

  const stored = new Map<string, string>()
  for (const list of lists) {
    for (const item of list.items) {
      if (!isDataUrl(item.image)) continue
      if (stored.has(item.image)) continue
      const { image } = await storeImage(item.id, item.image)
      stored.set(item.image, image)
    }
  }

  if (stored.size === 0) return lists

  const rewrite = (image: string) => stored.get(image) ?? image
  return lists.map((list) => ({
    ...list,
    items: list.items.map((item) => ({ ...item, image: rewrite(item.image) })),
  }))
}

const JSON_FILTERS = [{ name: "Tier list JSON", extensions: ["json"] }]
const PNG_FILTERS = [{ name: "PNG image", extensions: ["png"] }]

/**
 * Exports a list as JSON.
 *
 * On desktop the user picks the destination through the native save dialog; in
 * a browser this falls back to a download.
 */
export async function exportListJson(list: TierList): Promise<boolean> {
  return saveFile({
    title: "Export tier list",
    suggestedName: `${slugify(list.title)}.json`,
    data: JSON.stringify({ version: EXPORT_FILE_VERSION, lists: [list] }, null, 2),
    filters: JSON_FILTERS,
  })
}

/** Exports the whole library as one backup file. */
export async function exportAllJson(lists: TierList[]): Promise<boolean> {
  return saveFile({
    title: "Export all tier lists",
    suggestedName: "tier-list-maker.json",
    data: JSON.stringify({ version: EXPORT_FILE_VERSION, lists }, null, 2),
    filters: JSON_FILTERS,
  })
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
  return saveFile({
    title: "Export PNG",
    suggestedName: `${slugify(filename)}.png`,
    data: dataUrl,
    filters: PNG_FILTERS,
  })
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
