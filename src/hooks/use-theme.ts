import { useCallback, useSyncExternalStore } from "react"
import { ACCENTS, DEFAULT_ACCENT_ID, type Accent, accentCss } from "@/data/defaults"

export type ThemeMode = "light" | "dark"

const THEME_KEY = "tier-list-maker:theme"
const ACCENT_KEY = "tier-list-maker:accent"
const STYLE_ID = "tlm-accent-style"

/**
 * Theme lives in a module-level store rather than component state.
 *
 * Both the accent picker and the toaster need to read it, and they sit in
 * unrelated subtrees. A store keeps every `useTheme()` caller in sync without
 * needing a provider threaded through the app, and the theme is applied to
 * <html> as a side effect of subscribing rather than of any one component.
 */

const listeners = new Set<() => void>()

function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function readMode(): ThemeMode {
  const stored = readStored(THEME_KEY)
  if (stored === "light" || stored === "dark") return stored
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light"
}

function readAccentId(): string {
  const stored = readStored(ACCENT_KEY)
  return ACCENTS.some((a) => a.id === stored) ? (stored as string) : DEFAULT_ACCENT_ID
}

let mode: ThemeMode = readMode()
let accentId: string = readAccentId()
let applied = false

function applyMode(next: ThemeMode) {
  document.documentElement.classList.toggle("dark", next === "dark")
  document.documentElement.style.colorScheme = next
}

function applyAccent(next: Accent) {
  let style = document.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = document.createElement("style")
    style.id = STYLE_ID
    document.head.appendChild(style)
  }
  style.textContent = accentCss(next)
}

/** Runs once per page load; safe to call repeatedly. */
function ensureApplied() {
  if (applied) return
  applied = true
  applyMode(mode)
  applyAccent(ACCENTS.find((a) => a.id === accentId) ?? ACCENTS[0])
}

function subscribe(onChange: () => void) {
  ensureApplied()
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

function setMode(next: ThemeMode) {
  if (next === mode) return
  mode = next
  applyMode(next)
  try {
    window.localStorage.setItem(THEME_KEY, next)
  } catch {
    /* the class is already applied, so this is safe to swallow */
  }
  for (const listener of listeners) listener()
}

function setAccentId(next: string) {
  if (next === accentId) return
  accentId = next
  applyAccent(ACCENTS.find((a) => a.id === next) ?? ACCENTS[0])
  try {
    window.localStorage.setItem(ACCENT_KEY, next)
  } catch {
    /* the stylesheet is already applied */
  }
  for (const listener of listeners) listener()
}

export function useTheme() {
  const currentMode = useSyncExternalStore(subscribe, () => mode)
  const currentAccentId = useSyncExternalStore(subscribe, () => accentId)

  const accent = ACCENTS.find((a) => a.id === currentAccentId) ?? ACCENTS[0]

  const toggleMode = useCallback(
    () => setMode(currentMode === "dark" ? "light" : "dark"),
    [currentMode],
  )

  const setAccent = useCallback((id: string) => setAccentId(id), [])

  return { mode: currentMode, setMode, toggleMode, accent, setAccent, accents: ACCENTS }
}
