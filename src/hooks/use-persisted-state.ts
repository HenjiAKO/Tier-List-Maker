import { useCallback, useEffect, useRef, useState } from "react"

const WRITE_DEBOUNCE_MS = 300

export type StorageError = "write-failed" | null

export interface PersistedState<T> {
  value: T
  setValue: React.Dispatch<React.SetStateAction<T>>
  error: StorageError
  flush: () => void
}

function read<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

/**
 * Persisted state with debounced writes.
 *
 * Writes are debounced so dragging an item across a dozen tiers doesn't
 * serialise the whole library on every pointer move, and the pending write is
 * flushed on unmount so nothing is lost on navigation.
 */
export function usePersistedState<T>(key: string, initial: T): PersistedState<T> {
  const [value, setValue] = useState<T>(() => read(key, initial))
  const [error, setError] = useState<StorageError>(null)

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Mirrors `value` so the unmount flush can read it without re-subscribing.
  const latest = useRef(value)

  useEffect(() => {
    latest.current = value
  }, [value])

  const flush = useCallback(() => {
    if (timer.current) {
      clearTimeout(timer.current)
      timer.current = null
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(latest.current))
      setError(null)
    } catch {
      // Quota exceeded, private browsing, or storage disabled by the browser.
      setError("write-failed")
    }
  }, [key])

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(flush, WRITE_DEBOUNCE_MS)
    return () => {
      if (timer.current) clearTimeout(timer.current)
    }
  }, [value, flush])

  // Last-chance flush for in-flight edits.
  useEffect(() => flush, [flush])

  return { value, setValue, error, flush }
}
