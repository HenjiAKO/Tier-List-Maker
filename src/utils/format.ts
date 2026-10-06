const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR

/** "just now" / "12m ago" / "3h ago" / "5d ago" / a real date past a month. */
export function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  if (diff < MINUTE) return "just now"
  if (diff < HOUR) return `${Math.floor(diff / MINUTE)}m ago`
  if (diff < DAY) return `${Math.floor(diff / HOUR)}h ago`
  if (diff < 30 * DAY) return `${Math.floor(diff / DAY)}d ago`
  return new Date(timestamp).toLocaleDateString()
}

/** "12 items" / "1 item", with a count of 0 still reading naturally. */
export function itemCount(n: number): string {
  return `${n} ${n === 1 ? "item" : "items"}`
}
