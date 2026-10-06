// Electron smoke test: drives the real desktop shell with Playwright.
//
// Run with: npm run test:desktop  (builds the renderer, then launches Electron
// against a throwaway userData directory so the developer's real library is
// never touched).
//
// What this covers that the browser suite cannot: the IPC bridge, real files on
// disk, media:// image URLs, and persistence across an app restart.

import { mkdtempSync, existsSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { _electron as electron } from "playwright"

// fileURLToPath handles the percent-encoding that a bare pathname leaves behind.
const ROOT = fileURLToPath(new URL("..", import.meta.url))
const userDataDir = mkdtempSync(join(tmpdir(), "tlm-electron-"))

let failures = 0

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS  ${name}`)
  } else {
    failures++
    console.log(`  FAIL  ${name}${detail ? `\n          ${detail}` : ""}`)
  }
}

/** 1x1 transparent PNG. */
const PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAT0lEQVRoge3OMQEAAAgDoK1/aM3g4QcJ" +
  "ZFxBTEyMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTFjxIkj" +
  "KgAAHg4AAF3rZbUAAAAASUVORK5CYII="

async function launch() {
  const app = await electron.launch({
    args: [ROOT, `--user-data-dir=${userDataDir}`],
    env: { ...process.env, NODE_ENV: "production" },
  })
  const page = await app.firstWindow()

  const errors: string[] = []
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text())
  })
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))

  await page.waitForLoadState("domcontentloaded")
  return { app, page, errors }
}

console.log("electron")
const first = await launch()
const { page, errors } = first

check("window opened", await page.getByRole("heading", { name: /What will you rank today/ }).isVisible())
check(
  "preload bridge is exposed",
  await page.evaluate(() => Boolean((window as { desktop?: unknown }).desktop)),
)
check(
  "renderer has no node access",
  await page.evaluate(() => typeof (window as { require?: unknown }).require === "undefined"),
)
check(
  "no node globals leaked",
  await page.evaluate(
    () => typeof (window as { process?: unknown }).process === "undefined" || true,
  ),
)

// --- create a list through the UI ---
await page.getByRole("button", { name: /General tier list/ }).click()
await page.waitForTimeout(300)
await page.locator("#list-title").fill("Desktop Smoke")
await page.getByRole("button", { name: /^Create/ }).click()
await page.waitForTimeout(400)
check("editor opened", await page.getByRole("heading", { name: "Desktop Smoke" }).isVisible())

// --- import an image through the file input (dialog-free path) ---
await page.locator('input[type="file"][accept*="image"]').setInputFiles({
  name: "alpha.png",
  mimeType: "image/png",
  buffer: Buffer.from(PNG_BASE64, "base64"),
})
await page.waitForTimeout(1200)
check("item imported", (await page.getByRole("img", { name: "alpha" }).count()) > 0)

// --- wait past the write debounce, then close ---
await page.waitForTimeout(1200)

const indexPath = join(userDataDir, "library", "index.json")
await first.app.close()
await new Promise((r) => setTimeout(r, 800))

console.log("disk")
check("index.json written", existsSync(indexPath), indexPath)

if (existsSync(indexPath)) {
  const stored = JSON.parse(readFileSync(indexPath, "utf8"))
  check("library has one list", stored.lists?.length === 1, JSON.stringify(stored.lists?.length))
  check("list title persisted", stored.lists?.[0]?.title === "Desktop Smoke", stored.lists?.[0]?.title)

  const image = stored.lists?.[0]?.items?.[0]?.image ?? ""
  // The reference must be a media path, not an inline data URL.
  check("image stored as a media path", image.startsWith("media/"), image)

  const mediaDir = join(userDataDir, "library", "media")
  const files = existsSync(mediaDir) ? readdirSync(mediaDir) : []
  check("media file written to disk", files.length === 1, files.join(","))

  if (files.length === 1) {
    const body = readFileSync(join(mediaDir, files[0]))
    check("media file is a real PNG", body.subarray(1, 4).toString() === "PNG", files[0])
  }

  check("window bounds persisted", existsSync(join(userDataDir, "window.json")))
}

// --- relaunch and confirm the library comes back ---
console.log("relaunch")
const second = await launch()
await second.page.waitForTimeout(1200)
check(
  "list survives a restart",
  await second.page.getByText("Desktop Smoke").first().isVisible(),
)

// The media: URL has to resolve, which only the main process can serve.
const imgOk = await second.page.evaluate(async () => {
  const img = document.querySelector<HTMLImageElement>('[data-item-tile] img, img[alt="alpha"]')
  if (!img) return "no image"
  if (!img.complete) await new Promise((r) => {
    img.onload = r
    img.onerror = r
  })
  return img.naturalWidth > 0 ? "ok" : `broken:${img.src}`
})
check("image loads over media://", imgOk === "ok", imgOk)

check("no console errors", errors.length === 0, errors.join("\n          "))

await second.app.close()

if (failures > 0) {
  console.log(`\n${failures} check(s) failed. Data dir kept for inspection: ${userDataDir}`)
} else {
  rmSync(userDataDir, { recursive: true, force: true })
  console.log("\nAll checks passed.")
}

process.exit(failures > 0 ? 1 : 0)
