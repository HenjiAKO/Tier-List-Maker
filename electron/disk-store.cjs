"use strict"

/**
 * On-disk library.
 *
 * Layout under app.getPath("userData"):
 *   library/index.json    list metadata, tiers, item records (no image bytes)
 *   library/media/<id>.png images referenced by relative path
 *   window.json           window bounds
 *
 * index.json is replaced atomically: every write goes to a sibling .tmp file
 * first and is then renamed, because rename is the only operation Windows
 * guarantees to be all-or-nothing. A crash mid-write therefore leaves the
 * previous good copy intact.
 */

const fsp = require("node:fs/promises")
const path = require("node:path")

const DATA_VERSION = 1

class DiskStore {
  /** @param {string} userDataDir */
  constructor(userDataDir) {
    this.userDataDir = userDataDir
    this.dataDir = path.join(userDataDir, "library")
    this.indexPath = path.join(this.dataDir, "index.json")
    this.mediaDir = path.join(this.dataDir, "media")
    this.windowPath = path.join(userDataDir, "window.json")
    this.writing = Promise.resolve()
  }

  async init() {
    await fsp.mkdir(this.mediaDir, { recursive: true })
  }

  /* --------------------------------- state --------------------------------- */

  /**
   * @returns {Promise<{ version: number, lists: unknown[] }>}
   */
  async load() {
    try {
      const raw = await fsp.readFile(this.indexPath, "utf8")
      const parsed = JSON.parse(raw)
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.lists)) {
        return { version: DATA_VERSION, lists: [] }
      }
      return { version: DATA_VERSION, lists: parsed.lists }
    } catch (err) {
      // ENOENT is simply a first launch; anything else is worth surfacing to
      // the renderer rather than silently discarding the user's library.
      if (err && err.code === "ENOENT") return { version: DATA_VERSION, lists: [] }
      if (err instanceof SyntaxError) {
        const backup = `${this.indexPath}.corrupt-${Date.now()}`
        await fsp.rename(this.indexPath, backup).catch(() => {})
        return { version: DATA_VERSION, lists: [] }
      }
      throw err
    }
  }

  /**
   * @param {{ version: number, lists: unknown[] }} state
   */
  async saveState(state) {
    const payload = JSON.stringify(
      { version: DATA_VERSION, lists: state?.lists ?? [] },
      null,
      2,
    )

    // Serialise writes so a fast drag can't interleave two renames.
    this.writing = this.writing.then(async () => {
      await fsp.mkdir(this.mediaDir, { recursive: true })
      const tmp = `${this.indexPath}.tmp`
      await fsp.writeFile(tmp, payload, "utf8")
      await fsp.rename(tmp, this.indexPath)
    })

    return this.writing
  }

  /* --------------------------------- media --------------------------------- */

  /**
   * Decodes a canvas data URL and writes the bytes to media/<id>.<ext>.
   *
   * @param {string} id
   * @param {string} extension png or jpg
   * @param {string} dataUrl
   * @returns {Promise<string>} the relative path to store in item.image
   */
  async putMedia(id, extension, dataUrl) {
    const ext = extension === "jpg" || extension === "jpeg" ? "jpg" : "png"
    const match = /^data:image\/(png|jpeg);base64,(.+)$/.exec(String(dataUrl))
    if (!match) throw new Error("That image data could not be read.")

    const name = `${sanitize(id)}.${ext}`
    const target = path.join(this.mediaDir, name)
    await fsp.mkdir(this.mediaDir, { recursive: true })
    await fsp.writeFile(target, Buffer.from(match[2], "base64"))

    // Remove any sibling left over from a re-import under the same id.
    for (const other of ["png", "jpg"]) {
      if (other === ext) continue
      await fsp.rm(path.join(this.mediaDir, `${sanitize(id)}.${other}`), { force: true })
    }

    return `media/${name}`
  }

  /** @param {string[]} ids */
  async deleteMedia(ids) {
    await Promise.all(
      ids.map(async (id) => {
        const safe = sanitize(id)
        if (!safe) return
        for (const ext of ["png", "jpg"]) {
          await fsp.rm(path.join(this.mediaDir, `${safe}.${ext}`), { force: true })
        }
      }),
    )
  }

  /**
   * Serves a media/<name> URL from disk.
   *
   * @param {string} url
   * @returns {Promise<Response>}
   */
  async serveMedia(url) {
    const resolved = this.resolveMedia(url)
    if (!resolved) return new Response("forbidden", { status: 403 })

    try {
      const body = await fsp.readFile(resolved)
      const type = resolved.endsWith(".jpg") ? "image/jpeg" : "image/png"
      return new Response(body, { headers: { "content-type": type } })
    } catch {
      return new Response("not found", { status: 404 })
    }
  }

  /**
   * Serves a file from the library directory for the export pipeline.
   *
   * @param {string} url
   * @returns {Promise<Response>}
   */
  async serveDataFile(url) {
    const rel = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, "")
    const resolved = path.resolve(this.dataDir, rel)
    if (!resolved.startsWith(this.dataDir)) {
      return new Response("forbidden", { status: 403 })
    }

    try {
      const body = await fsp.readFile(resolved)
      const type = resolved.endsWith(".json") ? "application/json" : "application/octet-stream"
      return new Response(body, { headers: { "content-type": type } })
    } catch {
      return new Response("not found", { status: 404 })
    }
  }

  /**
   * Resolves a media URL, refusing anything that escapes the media directory.
   *
   * @param {string} url
   * @returns {string | null}
   */
  resolveMedia(url) {
    const rel = decodeURIComponent(new URL(url).pathname).replace(/^\/+/, "")
    const resolved = path.resolve(this.mediaDir, rel)
    return resolved.startsWith(this.mediaDir) ? resolved : null
  }

  /* ------------------------------ window state ----------------------------- */

  /** @returns {Promise<{width:number,height:number,x:number,y:number}|null>} */
  async loadWindowState() {
    try {
      const parsed = JSON.parse(await fsp.readFile(this.windowPath, "utf8"))
      if (typeof parsed?.width !== "number") return null
      return parsed
    } catch {
      return null
    }
  }

  /** @param {{width:number,height:number,x:number,y:number}} bounds */
  async saveWindowState(bounds) {
    await fsp.mkdir(this.userDataDir, { recursive: true })
    await fsp.writeFile(this.windowPath, JSON.stringify(bounds, null, 2), "utf8")
  }

  /* ------------------------------- migration ------------------------------- */

  /**
   * First desktop launch: pull lists out of Chromium's localStorage so an
   * existing browser library is not stranded. The original entry is left in
   * place as a backup rather than deleted.
   *
   * @param {Record<string, string>} legacyEntries localStorage contents
   * @returns {Promise<boolean>} whether anything was migrated
   */
  async migrateLegacy(legacyEntries) {
    const existing = await this.load()
    if (existing.lists.length > 0) return false

    const raw = legacyEntries?.["tier-list-maker:v1"]
    if (!raw) return false

    try {
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed?.lists) || parsed.lists.length === 0) return false

      // Images arrive as data URLs; write them out and rewrite each item to
      // point at the file it now lives in.
      const lists = []
      for (const list of parsed.lists) {
        const items = []
        for (const item of list.items ?? []) {
          const dataUrl = item.image
          if (typeof dataUrl === "string" && dataUrl.startsWith("data:image/")) {
            const ext = dataUrl.startsWith("data:image/png") ? "png" : "jpg"
            try {
              const image = await this.putMedia(item.id, ext, dataUrl)
              items.push({ ...item, image })
              continue
            } catch {
              // Fall through and keep whatever was there.
            }
          }
          items.push({ ...item })
        }
        lists.push({ ...list, items })
      }

      await this.saveState({ lists })
      return true
    } catch {
      return false
    }
  }
}

/** Keeps a caller-supplied id from escaping the media directory. */
function sanitize(id) {
  return String(id).replace(/[^a-zA-Z0-9_-]/g, "")
}

module.exports = { DiskStore, DATA_VERSION, sanitize }
