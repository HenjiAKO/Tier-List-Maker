import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { isDesktop } from "@/lib/desktop"

const WRITE_DEBOUNCE_MS = 300

export type StorageError = "write-failed" | null

export interface PersistenceAdapter {
  /** Reads the initial value. May be async on desktop, sync in a browser. */
  load<T>(fallback: T): T | Promise<T>
  write<T>(value: T): void | Promise<void>
}

export interface PersistedState<T> {
  value: T
  setValue: React.Dispatch<React.SetStateAction<T>>
  error: StorageError
  /** False until an async adapter has finished its first read. */
  ready: boolean
  flush: () => void
}

/* ------------------------------ browser side ------------------------------ */

function browserRead<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function browserWrite(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value))
}

/* --------------------------------- hook ----------------------------------- */

/**
 * Persisted state with debounced writes.
 *
 * Writes are debounced so dragging an item across a dozen tiers doesn't
 * serialise the whole library on every pointer move, and the pending write is
 * flushed on unmount so nothing is lost on navigation.
 *
 * The desktop adapter writes real files through IPC; the browser adapter keeps
 * the existing localStorage behaviour so the web build is unaffected.
 */
export function usePersistedState<T>(key: string, initial: T): PersistedState<T> {
  const adapter = useMemo<PersistenceAdapter>(
    () => (isDesktop() ? desktopAdapter() : browserAdapter(key)),
    [key],
  )

  // Read once. A synchronous adapter (browser) seeds state outright; an async
  // one (desktop) starts from the fallback and is replaced when it resolves.
  const [boot] = useState(() => {
    const loaded = adapter.load(initial)
    return loaded instanceof Promise
      ? { promise: loaded, seeded: initial }
      : { promise: null, seeded: loaded }
  })

  const [value, setValue] = useState<T>(boot.seeded)
  const [error, setError] = useState<StorageError>(null)
  const [ready, setReady] = useState(boot.promise === null)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mirrors `value` so the unmount flush can read it without re-subscribing.
  const latest = useRef(value)

  useEffect(() => {
    latest.current = value
  }, [value])

  // Async initial read, used only by the desktop adapter. Keyed on the adapter
  // alone so later data changes don't re-trigger a load.
  useEffect(() => {
    if (!boot.promise) return

    let cancelled = false
    boot.promise.then(
      (resolved) => {
        if (cancelled) return
        latest.current = resolved as T
        setValue(resolved as T)
        setReady(true)
      },
      () => {
        if (!cancelled) setReady(true)
      },
    )

    return () => {
      cancelled = true
    }
  }, [boot])

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    try {
      void Promise.resolve(adapter.write(latest.current)).then(
        () => setError(null),
        () => setError("write-failed"),
      )
    } catch {
      setError("write-failed")
    }
  }, [adapter])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, WRITE_DEBOUNCE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [value, flush])

  // Last-chance flush for in-flight edits.
  useEffect(() => flush, [flush])

  return { value, setValue, error, ready, flush }
}

function browserAdapter(key: string): PersistenceAdapter {
  return {
    load: <T,>(fallback: T) => browserRead(key, fallback),
    write: <T,>(value: T) => browserWrite(key, value),
  }
}

/* ------------------------------- desktop side ------------------------------ */

interface LegacyDesktopBridge {
  loadState(): Promise<{ ok: boolean; state?: { version: number; lists: unknown[] }; error?: string }>
  saveState(state: unknown): Promise<{ ok: boolean; error?: string }>
  migrateLegacy(entries: Record<string, string>): Promise<{ ok: boolean; migrated?: boolean }>
}

/** The key a previous browser-only install would have used. */
const LEGACY_KEY = "tier-list-maker:v1"

/**
 * Reads and writes library/index.json through the main process.
 *
 * On the very first desktop launch any library left in Chromium's localStorage
 * is copied across, with its images written out as media files. The original
 * localStorage entry is left in place as a backup.
 */
function desktopAdapter(): PersistenceAdapter {
  return {
    async load<T>(fallback: T): Promise<T> {
      const bridge = window.desktop as unknown as LegacyDesktopBridge | undefined
      if (!bridge) return fallback

      const result = await bridge.loadState()
      if (!result.ok || !result.state) return fallback

      const hasLists = Array.isArray(result.state.lists) && result.state.lists.length > 0
      if (hasLists) return result.state as T

      // Empty library: this may be a first launch after using the web build.
      let legacy: Record<string, string> = {}
      try {
        const raw = window.localStorage.getItem(LEGACY_KEY)
        if (raw) legacy[LEGACY_KEY] = raw
      } catch {
        // localStorage unavailable; nothing to migrate.
      }

      if (Object.keys(legacy).length === 0) return fallback

      await bridge.migrateLegacy(legacy)
      const migrated = await bridge.loadState()
      if (migrated.ok && migrated.state && migrated.state.lists.length > 0) {
        return migrated.state as T
      }
      return fallback
    },

    write<T>(value: T): Promise<void> {
      const bridge = window.desktop as unknown as LegacyDesktopBridge | undefined
      if (!bridge) return Promise.resolve()
      return bridge.saveState(value).then((result) => {
        if (!result.ok) throw new Error(result.error ?? "write failed")
      })
    },
  }
}
