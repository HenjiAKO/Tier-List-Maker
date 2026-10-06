import type { RarityScheme, SchemeId } from "@/types"

export const MIN_STAR_LEVELS = 2
export const MAX_STAR_LEVELS = 7
export const MAX_RARITY_VALUES = 24

export interface SchemePreset {
  id: SchemeId
  name: string
  description: string
  /** Short sample of the generated values, shown on the picker card. */
  example: string
  /** Values shown in the picker, highest-first. */
  build: (count: number) => string[]
  /** Star counts are the only preset the user sizes themselves. */
  asksForCount?: boolean
  defaultCount?: number
}

function stars(count: number): string[] {
  const n = Math.min(Math.max(Math.round(count) || 5, MIN_STAR_LEVELS), MAX_STAR_LEVELS)
  return Array.from({ length: n }, (_, i) => `${n - i}★`)
}

export const SCHEME_PRESETS: SchemePreset[] = [
  {
    id: "stars",
    name: "Stars",
    description: "1-star up to however many your game uses",
    example: "5★ 4★ 3★ 2★ 1★",
    build: stars,
    asksForCount: true,
    defaultCount: 5,
  },
  {
    id: "letters",
    name: "Letter grades",
    description: "The classic S to D grading",
    example: "S A B C D",
    build: () => ["S", "A", "B", "C", "D"],
  },
  {
    id: "common",
    name: "Common words",
    description: "Common through Legendary",
    example: "Legendary Epic Rare",
    build: () => ["Legendary", "Epic", "Rare", "Uncommon", "Common"],
  },
  {
    id: "gacha",
    name: "Gacha rarities",
    description: "The N / R / SR / SSR / UR ladder",
    example: "UR SSR SR R N",
    build: () => ["UR", "SSR", "SR", "R", "N"],
  },
]

/** Splits a user-typed list on commas or newlines, dropping blanks. */
export function parseCustomValues(input: string): string[] {
  return input
    .split(/[\n,]/)
    .map((v) => v.trim())
    .filter(Boolean)
    .slice(0, MAX_RARITY_VALUES)
}

export function makeScheme(id: SchemeId, values: string[], label?: string): RarityScheme {
  const preset = SCHEME_PRESETS.find((p) => p.id === id)
  return {
    scheme: id,
    label: label?.trim() || preset?.name || "Custom",
    values: values.map((v) => v.trim()).filter(Boolean).slice(0, MAX_RARITY_VALUES),
  }
}
