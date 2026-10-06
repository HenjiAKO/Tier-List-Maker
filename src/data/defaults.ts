import type { Tier } from "@/types"

export const STORAGE_KEY = "tier-list-maker:v1"
export const DATA_VERSION = 1

export const DEFAULT_TIER_NAMES = ["S", "A", "B", "C", "D"] as const

export const DEFAULT_TIER_COLORS = [
  "#ff6b6b",
  "#ffa94d",
  "#ffd43b",
  "#69db7c",
  "#4dabf7",
] as const

export function makeDefaultTiers(): Tier[] {
  return DEFAULT_TIER_NAMES.map((name, i) => ({
    id: newId(),
    name,
    color: DEFAULT_TIER_COLORS[i % DEFAULT_TIER_COLORS.length],
    itemIds: [],
  }))
}

/** New tiers cycle through this so they never arrive colourless. */
export const TIER_COLOR_PALETTE = [
  "#ff6b6b",
  "#ff922b",
  "#ffd43b",
  "#69db7c",
  "#38d9a9",
  "#4dabf7",
  "#748ffc",
  "#b197fc",
  "#da77f2",
  "#f783ac",
  "#8d9397",
  "#5c7cfa",
] as const

export function nextTierColor(index: number): string {
  return TIER_COLOR_PALETTE[index % TIER_COLOR_PALETTE.length]
}

/**
 * Accent presets. Each entry is one hue in oklch, given a lightness/chroma per
 * mode, so the same hue stays recognisable in both themes.
 */
export interface Accent {
  id: string
  name: string
  h: number
  light: { l: number; c: number }
  dark: { l: number; c: number }
  /** Whether the light-mode primary needs dark text for contrast. */
  darkTextOnLight: boolean
}

export const ACCENTS: Accent[] = [
  { id: "violet", name: "Violet", h: 293, light: { l: 0.55, c: 0.22 }, dark: { l: 0.72, c: 0.16 }, darkTextOnLight: false },
  { id: "blue", name: "Blue", h: 255, light: { l: 0.58, c: 0.19 }, dark: { l: 0.7, c: 0.15 }, darkTextOnLight: false },
  { id: "cyan", name: "Cyan", h: 210, light: { l: 0.6, c: 0.13 }, dark: { l: 0.75, c: 0.12 }, darkTextOnLight: false },
  { id: "teal", name: "Teal", h: 180, light: { l: 0.6, c: 0.12 }, dark: { l: 0.76, c: 0.11 }, darkTextOnLight: false },
  { id: "emerald", name: "Emerald", h: 155, light: { l: 0.58, c: 0.14 }, dark: { l: 0.75, c: 0.14 }, darkTextOnLight: false },
  { id: "amber", name: "Amber", h: 70, light: { l: 0.72, c: 0.16 }, dark: { l: 0.82, c: 0.15 }, darkTextOnLight: true },
  { id: "orange", name: "Orange", h: 40, light: { l: 0.66, c: 0.19 }, dark: { l: 0.78, c: 0.16 }, darkTextOnLight: true },
  { id: "rose", name: "Rose", h: 15, light: { l: 0.58, c: 0.2 }, dark: { l: 0.73, c: 0.16 }, darkTextOnLight: false },
  { id: "pink", name: "Pink", h: 350, light: { l: 0.6, c: 0.2 }, dark: { l: 0.75, c: 0.15 }, darkTextOnLight: false },
  { id: "fuchsia", name: "Fuchsia", h: 330, light: { l: 0.56, c: 0.22 }, dark: { l: 0.74, c: 0.17 }, darkTextOnLight: false },
  { id: "slate", name: "Slate", h: 260, light: { l: 0.48, c: 0.03 }, dark: { l: 0.72, c: 0.02 }, darkTextOnLight: false },
]

export const DEFAULT_ACCENT_ID = "violet"

function oklch(l: number, c: number, h: number, alpha?: number): string {
  return alpha === undefined
    ? `oklch(${l} ${c} ${h})`
    : `oklch(${l} ${c} ${h} / ${alpha})`
}

/**
 * Builds the stylesheet that repaints the accent tokens. Injected as a
 * dedicated <style> rather than inline styles, because `.dark` rules have to
 * be able to override it.
 */
export function accentCss(accent: Accent): string {
  const { h } = accent
  const lightPrimary = oklch(accent.light.l, accent.light.c, h)
  const darkPrimary = oklch(accent.dark.l, accent.dark.c, h)

  return `
:root {
  --primary: ${lightPrimary};
  --primary-foreground: ${accent.darkTextOnLight ? "oklch(0.2 0 0)" : "oklch(0.99 0 0)"};
  --ring: ${lightPrimary};
  --accent: ${oklch(0.965, accent.light.c * 0.14, h)};
  --accent-foreground: ${lightPrimary};
  --sidebar-primary: ${lightPrimary};
  --sidebar-primary-foreground: ${accent.darkTextOnLight ? "oklch(0.2 0 0)" : "oklch(0.99 0 0)"};
  --sidebar-accent: ${oklch(0.965, accent.light.c * 0.14, h)};
  --sidebar-accent-foreground: ${lightPrimary};
}
.dark {
  --primary: ${darkPrimary};
  --primary-foreground: oklch(0.2 0 0);
  --ring: ${darkPrimary};
  --accent: ${oklch(0.3, accent.dark.c * 0.32, h)};
  --accent-foreground: ${darkPrimary};
  --sidebar-primary: ${darkPrimary};
  --sidebar-primary-foreground: oklch(0.2 0 0);
  --sidebar-accent: ${oklch(0.3, accent.dark.c * 0.32, h)};
  --sidebar-accent-foreground: ${darkPrimary};
}
`.trim()
}

let counter = 0

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID()
  }
  counter += 1
  return `id-${Date.now().toString(36)}-${counter.toString(36)}`
}
