// Smoke test 2: game/rarity wizard, drag reorder, PNG export, filters.
// Run with: npx tsx smoke2.ts   (expects `npm run preview` on :4173)
import { readFileSync } from "node:fs"
import { deflateSync } from "node:zlib"
import { chromium, type ConsoleMessage, type Page } from "playwright"

const BASE = "http://localhost:4173/"
let failures = 0

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS  ${name}`)
  } else {
    failures++
    console.log(`  FAIL  ${name}${detail ? `\n          ${detail}` : ""}`)
  }
}

/** Generates distinct solid-colour PNGs so tiles are visually distinguishable. */
function solidPng(hex: string): Buffer {
  const w = 8
  const h = 8
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const raw = Buffer.alloc(h * (1 + w * 3))
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0
    for (let x = 0; x < w; x++) {
      const o = y * (1 + w * 3) + 1 + x * 3
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, "ascii"), data])
    const crcTable = solidPng.table ?? (solidPng.table = buildCrcTable())
    let c = 0xffffffff
    for (const byte of body) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE((c ^ 0xffffffff) >>> 0)
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const idat = Buffer.concat([Buffer.from("789c", "hex"), deflateSync(raw)])
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", idat),
    chunk("IEND", Buffer.alloc(0)),
  ])
}
function buildCrcTable(): number[] {
  const t: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c
  }
  return t
}

async function addItems(page: Page, names: string[], colors: string[]) {
  const files = names.map((name, i) => ({
    name: `${name}.png`,
    mimeType: "image/png",
    buffer: solidPng(colors[i]),
  }))
  await page.locator('input[type="file"][accept*="image"]').setInputFiles(files)
  await page.waitForTimeout(800)
}

/** HTML5 drag-and-drop does not fire in synthetic pointer events, so drive it directly. */
async function dragTileToRow(page: Page, tileName: string, rowSelector: string) {
  await page.evaluate(
    ({ tileName, rowSelector }) => {
      const tiles = Array.from(document.querySelectorAll("[data-item-tile]")) as HTMLElement[]
      const tile = tiles.find((t) => t.getAttribute("title")?.startsWith(tileName))
      const row = document.querySelector(rowSelector) as HTMLElement | null
      if (!tile || !row) throw new Error(`drag source/target missing: ${tileName} -> ${rowSelector}`)

      const dt = new DataTransfer()
      tile.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true }))
      const rect = row.getBoundingClientRect()
      const opts = {
        dataTransfer: dt,
        bubbles: true,
        clientX: rect.left + rect.width - 20,
        clientY: rect.top + rect.height / 2,
      }
      row.dispatchEvent(new DragEvent("dragover", opts))
      row.dispatchEvent(new DragEvent("drop", opts))
      tile.dispatchEvent(new DragEvent("dragend", { dataTransfer: dt, bubbles: true }))
    },
    { tileName, rowSelector },
  )
  await page.waitForTimeout(200)
}

const browser = await chromium.launch({ channel: "msedge" })
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
const errors: string[] = []
page.on("console", (m: ConsoleMessage) => {
  if (m.type() === "error") errors.push(m.text())
})
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))

await page.goto(BASE, { waitUntil: "networkidle" })

// ---------- Game list wizard ----------
console.log("game wizard")
await page.getByRole("button", { name: "New tier list" }).first().click()
const dialog = page.getByRole("dialog")
await dialog.getByRole("button", { name: /^Game/ }).click()
await page.waitForTimeout(150)
check("rarity step shown", await page.getByText("Pick a rarity system").isVisible())

await dialog.getByRole("button", { name: /^Gacha/ }).click()
await page.waitForTimeout(150)
check("gacha values previewed", await page.getByText("UR", { exact: true }).first().isVisible())
check(
  "fixed preset has no value editor",
  (await page.getByRole("button", { name: "Edit values" }).count()) === 0,
)

// Switch to Custom: type values, then refine them in the editor.
await dialog.getByRole("button", { name: /^Custom/ }).click()
await page.locator("#custom-values").fill("MYTHIC, LEGEND, TRASH")
await page.waitForTimeout(200)
check("custom values parsed", await page.getByText("MYTHIC", { exact: true }).first().isVisible())

await page.getByRole("button", { name: "Edit values" }).click()
await page.waitForTimeout(200)
const valueInputs = dialog.locator('input.font-mono')
check("value editor opened with 3 rows", (await valueInputs.count()) === 3,
  String(await valueInputs.count()))

await valueInputs.first().fill("SUPREME")
await page.waitForTimeout(200)
const edited = await valueInputs.evaluateAll((els) =>
  (els as HTMLInputElement[]).map((e) => e.value),
)
check("edited value applied to first row", edited[0] === "SUPREME", edited.join(","))
check("other rows untouched", edited[1] === "LEGEND" && edited[2] === "TRASH", edited.join(","))

// Remove the middle value.
await dialog.locator('button[aria-label^="Remove"]').nth(1).click()
await page.waitForTimeout(200)
const afterRemove = await dialog
  .locator("input.font-mono")
  .evaluateAll((els) => (els as HTMLInputElement[]).map((e) => e.value))
check("value removed", !afterRemove.includes("LEGEND"), afterRemove.join(","))

// Add a value back via the "Add value" button.
await dialog.getByRole("button", { name: "Add value" }).click()
await page.waitForTimeout(150)
check("value added", (await dialog.locator("input.font-mono").count()) === 3)

await page.getByRole("button", { name: "Done editing" }).click()
await page.waitForTimeout(200)
const chips = await dialog.locator("span.rounded-md").allTextContents()
check("blank rows dropped from chips", !chips.includes(""), chips.join(","))

await page.getByRole("button", { name: "Reset" }).click()
await page.waitForTimeout(250)
check("reset restores typed values", await page.getByText("MYTHIC", { exact: true }).first().isVisible())

await page.getByRole("button", { name: "Continue" }).click()
await page.waitForTimeout(200)
check("advanced to details step", await page.locator("#list-title").isVisible())

await page.locator("#list-title").fill("Smoke Game")
await page.getByRole("button", { name: /^Create/ }).click()

check("game editor opened", await page.getByRole("heading", { name: "Smoke Game" }).isVisible())
check("rarity badge shows", await page.getByText(/^Rarity:/).isVisible())
check("rarity filter present", await page.getByLabel("Filter by rarity").isVisible())

// ---------- items, rarity assignment, filter ----------
console.log("rarity + filter")
await addItems(page, ["one", "two", "three"], ["#ff0000", "#00ff00", "#0000ff"])

// Select then use the banner's Edit action (the primary, discoverable path).
await page.locator('[data-item-tile]').filter({ hasText: "one" }).first().click()
await page.waitForTimeout(200)
await page.getByRole("button", { name: "Edit", exact: true }).click()
await page.waitForTimeout(400)
const itemDialog = page.getByRole("dialog")
check("edit dialog opened", await itemDialog.isVisible())

// Set a rarity via the dialog's select.
await itemDialog.locator("#item-rarity").click()
await page.waitForTimeout(250)
await page.getByRole("option", { name: "MYTHIC" }).click()
await page.waitForTimeout(200)
await itemDialog.getByRole("button", { name: "Save" }).click()
await page.waitForTimeout(400)
check("edit dialog closed after save", (await itemDialog.count()) === 0)
check("rarity badge on tile", await page.getByText("MYTHIC", { exact: true }).first().isVisible())

// Filter to MYTHIC: only one tile should remain undimmed.
await page.getByLabel("Filter by rarity").click()
await page.waitForTimeout(200)
await page.getByRole("option", { name: "MYTHIC" }).click()
await page.waitForTimeout(300)
const dimmed = await page.locator("[data-item-tile].opacity-25").count()
check("filter dims non-matching tiles", dimmed === 2, `dimmed=${dimmed}`)

// Search
await page.getByLabel("Filter by rarity").click()
await page.waitForTimeout(150)
await page.getByRole("option", { name: "All rarities" }).click()
await page.waitForTimeout(200)
await page.getByLabel("Search items").fill("thr")
await page.waitForTimeout(300)
check(
  "search dims non-matches",
  (await page.locator("[data-item-tile].opacity-25").count()) === 2,
)
await page.getByRole("button", { name: "Clear" }).click()
await page.waitForTimeout(200)

// ---------- drag and drop ----------
console.log("drag and drop")
const rowSel = (n: number) => `div.rounded-lg.border.bg-card:nth-of-type(${n})`
await addItems(page, ["d1", "d2", "d3"], ["#ff00ff", "#00ffff", "#ffff00"])
await dragTileToRow(page, "d1", rowSel(1))
const inS = await page
  .locator(`${rowSel(1)} [data-item-tile]`)
  .evaluateAll((els) => els.map((e) => e.getAttribute("title")))
check("dragged item landed in S", inS.length === 1 && inS[0]?.startsWith("d1"), inS.join(","))

// Reorder within S: add three more and drag each into the same row.
await addItems(page, ["e1", "e2", "e3"], ["#884400", "#008844", "#444488"])
for (const name of ["e1", "e2", "e3"]) {
  await dragTileToRow(page, name, rowSel(1))
}
const beforeOrder = await page
  .locator(`${rowSel(1)} [data-item-tile]`)
  .evaluateAll((els) => els.map((e) => e.getAttribute("title")?.split(" ")[0]))
// d1 plus the three e-items.
check("four items in S", beforeOrder.length === 4, beforeOrder.join(","))

// Drag the first tile to the far right of the same row.
await page.evaluate((rowSelector) => {
  const row = document.querySelector(rowSelector) as HTMLElement
  const tile = row.querySelector("[data-item-tile]") as HTMLElement
  const dt = new DataTransfer()
  tile.dispatchEvent(new DragEvent("dragstart", { dataTransfer: dt, bubbles: true }))
  const rect = row.getBoundingClientRect()
  const opts = {
    dataTransfer: dt,
    bubbles: true,
    clientX: rect.left + rect.width - 5,
    clientY: rect.top + rect.height / 2,
  }
  row.dispatchEvent(new DragEvent("dragover", opts))
  row.dispatchEvent(new DragEvent("drop", opts))
}, rowSel(1))
await page.waitForTimeout(250)
const afterOrder = await page
  .locator(`${rowSel(1)} [data-item-tile]`)
  .evaluateAll((els) => els.map((e) => e.getAttribute("title")?.split(" ")[0]))
check("reorder moved the tile to the end", afterOrder[afterOrder.length - 1] === beforeOrder[0],
  `${beforeOrder.join(",")} -> ${afterOrder.join(",")}`)
check("reorder did not duplicate", afterOrder.length === 4, afterOrder.join(","))
check("reorder kept every item", [...afterOrder].sort().join(",") === [...beforeOrder].sort().join(","),
  `${beforeOrder.join(",")} vs ${afterOrder.join(",")}`)

const allIds = await page.evaluate(() => {
  const raw = window.localStorage.getItem("tier-list-maker:v1")
  const list = raw ? (JSON.parse(raw).lists as { items: { id: string }[] }[])[0] : null
  return list ? list.items.map((i) => i.id) : []
})
// one,two,three + d1,d2,d3 + e1,e2,e3
check("item count is stable in storage", allIds.length === 9, `n=${allIds.length}`)
check("no duplicate item ids in storage", new Set(allIds).size === allIds.length)

// ---------- PNG export ----------
console.log("png export")
const [png] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "Export" }).click()
    .then(() => page.getByRole("menuitem", { name: /PNG image/ }).click()),
])
const pngPath = await png.path()
const buf = readFileSync(pngPath!)
check("png filename is slugified", png.suggestedFilename() === "smoke-game.png", png.suggestedFilename())
check("png has PNG magic bytes", buf.subarray(0, 8).toString("hex") === "89504e470d0a1a0a",
  buf.subarray(0, 8).toString("hex"))
check("png is non-trivial in size", buf.length > 5000, `${buf.length} bytes`)

const dims = await page.evaluate(() => {
  const el = document.querySelector("[data-export-surface]")
  return el ? { w: el.getBoundingClientRect().width, rows: el.querySelectorAll("img").length } : null
})
check("export surface exists", dims !== null)
check("export surface is 900px wide", dims?.w === 900, String(dims?.w))
// Only the 4 items placed in S appear in the export.
check("export surface renders placed item images", (dims?.rows ?? 0) === 4, String(dims?.rows))

console.log("console errors")
check("no console errors", errors.length === 0, errors.slice(0, 6).join("\n          "))

await browser.close()
console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
