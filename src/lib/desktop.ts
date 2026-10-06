/**
 * Typed access to the Electron shell.
 *
 * The renderer is written so it also runs as a plain web app: every call here
 * checks for the preload bridge and falls back to the browser equivalent. That
 * keeps `npm run preview` and the Playwright suite working unchanged while the
 * desktop build gets real files and real dialogs.
 */

export type Ok<T extends object> = { ok: true } & T

export interface Err {
  ok: false
  error: string
}

export type Result<T extends object> = Ok<T> | Err

export type MenuCommand = "new-list" | "import" | "export-all" | "toggle-theme"

export interface DesktopBridge {
  isDesktop: true
  platform: string
  loadState(): Promise<Result<{ state: { version: number; lists: unknown[] } }>>
  saveState(state: { version: number; lists: unknown[] }): Promise<Result<object>>
  putMedia(payload: {
    id: string
    extension: "png" | "jpg"
    dataUrl: string
  }): Promise<Result<{ image: string }>>
  deleteMedia(ids: string[]): Promise<Result<object>>
  pickImages(): Promise<Result<{ files: { name: string; dataUrl: string }[] }>>
  openJson(): Promise<Result<{ canceled: boolean; text?: string }>>
  saveFile(payload: {
    title?: string
    suggestedName: string
    data: string
    filters?: { name: string; extensions: string[] }[]
  }): Promise<Result<{ canceled: boolean; path?: string }>>
  migrateLegacy(entries: Record<string, string>): Promise<Result<{ migrated: boolean }>>
  onMenuCommand(handler: (command: MenuCommand) => void): () => void
}

declare global {
  interface Window {
    desktop?: DesktopBridge
  }
}

/** True when running inside the Electron shell. */
export const isDesktop = (): boolean => typeof window !== "undefined" && Boolean(window.desktop)

/**
 * Resolves a stored image reference to something an <img> can load.
 *
 * On disk images live at `media/<id>.png`, served by the main process over the
 * privileged `media:` scheme. In a browser they stay data URLs, so this only
 * rewrites the desktop case.
 */
export function resolveImageUrl(image: string): string {
  if (!image) return ""
  if (!isDesktop()) return image
  if (/^(data:|blob:|media:|https?:)/.test(image)) return image
  return `media://${image.replace(/^\/+/, "")}`
}

/* -------------------------------- dialogs --------------------------------- */

export interface PickedFile {
  name: string
  dataUrl: string
}

/**
 * Opens the OS file picker for images.
 *
 * Contents come back as data URLs so the renderer can rebuild real File objects
 * and reuse the browser downscale pipeline unchanged. Empty when cancelled.
 */
export async function pickImages(): Promise<File[]> {
  if (!isDesktop()) return []
  const result = await window.desktop!.pickImages()
  if (!result.ok) return []
  return result.files.map((file) => dataUrlToFile(file.name, file.dataUrl))
}

/** Rebuilds a File from the data URL the main process returned. */
export function dataUrlToFile(name: string, dataUrl: string): File {
  const match = /^data:([^;,]+);base64,(.+)$/.exec(dataUrl)
  if (!match) return new File([], name)

  const bytes = Uint8Array.from(atob(match[2]), (c) => c.charCodeAt(0))
  return new File([bytes], name, { type: match[1] })
}

/** Reads a JSON file chosen by the user, or null when cancelled. */
export async function openJsonFile(): Promise<string | null> {
  if (!isDesktop()) return null
  const result = await window.desktop!.openJson()
  if (!result.ok) throw new Error(result.error)
  if (result.canceled || !result.text) return null
  return result.text
}

export interface SaveFileOptions {
  title?: string
  suggestedName: string
  data: string
  filters?: { name: string; extensions: string[] }[]
}

/**
 * Writes a file where the user chooses. Returns false when cancelled.
 * Falls back to a browser download outside the desktop shell.
 */
export async function saveFile(options: SaveFileOptions): Promise<boolean> {
  if (!isDesktop()) {
    downloadInBrowser(options)
    return true
  }
  const result = await window.desktop!.saveFile(options)
  if (!result.ok) throw new Error(result.error)
  return !result.canceled
}

function downloadInBrowser(options: SaveFileOptions) {
  // A data URL is already a complete payload; wrapping it in a Blob would
  // save the base64 text instead of the decoded image.
  const url = options.data.startsWith("data:")
    ? options.data
    : URL.createObjectURL(new Blob([options.data]))

  const a = document.createElement("a")
  a.href = url
  a.download = options.suggestedName
  document.body.appendChild(a)
  a.click()
  a.remove()
  // Revoking synchronously can cancel the download in some browsers.
  if (!url.startsWith("data:")) setTimeout(() => URL.revokeObjectURL(url), 10_000)
}
