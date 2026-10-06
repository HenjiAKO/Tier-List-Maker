// Renders the app to PNGs so the UI can be eyeballed.
// Run with: npx tsx shots.ts   (expects `npm run preview` on :4173)
import { deflateSync } from "node:zlib"
import { chromium } from "playwright"

const OUT = "C:/Users/macas/AppData/Local/Temp/opencode/tlm-check"

function solidPng(hex: string) {
  const w = 64
  const h = 64
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  const raw = Buffer.alloc(h * (1 + w * 3))
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const o = y * (1 + w * 3) + 1 + x * 3
      raw[o] = r
      raw[o + 1] = g
      raw[o + 2] = b
    }
  }
  const table: number[] = []
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type, "ascii"), data])
    let c = 0xffffffff
    for (const byte of body) c = table[(c ^ byte) & 0xff] ^ (c >>> 8)
    const crc = Buffer.alloc(4)
    crc.writeUInt32BE((c ^ 0xffffffff) >>> 0)
    return Buffer.concat([len, body, crc])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", Buffer.concat([Buffer.from("789c", "hex"), deflateSync(raw)])),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

const browser = await chromium.launch({ channel: "msedge" })
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 2 })
await page.goto("http://localhost:4173/", { waitUntil: "networkidle" })

await page.screenshot({ path: `${OUT}/01-dashboard-empty.png` })

// Create a game list with gacha rarity.
await page.getByRole("button", { name: "New tier list" }).first().click()
const dialog = page.getByRole("dialog")
await page.screenshot({ path: `${OUT}/02-wizard-kind.png` })
await dialog.getByRole("button", { name: /^Game/ }).click()
await page.waitForTimeout(200)
await dialog.getByRole("button", { name: /^Gacha/ }).click()
await page.waitForTimeout(200)
await page.screenshot({ path: `${OUT}/03-wizard-rarity.png` })
await page.getByRole("button", { name: "Continue" }).click()
await page.locator("#list-title").fill("Arknights Operators")
await page.getByRole("button", { name: /^Create/ }).click()
await page.waitForTimeout(400)

// Populate tiers.
const plan: [string, string, string][] = [
  ["S", "Exusiai", "#ff5555"],
  ["S", "Bagpipe", "#ff8800"],
  ["A", "Mlynar", "#ffdd00"],
  ["A", "W", "#88dd44"],
  ["A", "Saria", "#44dd88"],
  ["B", "Amiya", "#44bbff"],
  ["B", "Ch'en", "#8888ff"],
  ["C", "Hoshiguma", "#ff88cc"],
  ["C", "Rosmontis", "#dddddd"],
  ["D", "Varner", "#999977"],
]
await page.locator('input[type="file"][accept*="image"]').setInputFiles(
  plan.map(([, name, color]) => ({
    name: `${name}.png`,
    mimeType: "image/png",
    buffer: solidPng(color),
  })),
)
await page.waitForTimeout(900)

const rowSel = (n: number) => `div.rounded-lg.border.bg-card:nth-of-type(${n})`
for (const [i, [, name]] of plan.entries()) {
  await page.evaluate(
    ({ name, rowSelector }) => {
      const tiles = Array.from(document.querySelectorAll("[data-item-tile]")) as HTMLElement[]
      const tile = tiles.find((t) => t.getAttribute("title")?.startsWith(name))
      const row = document.querySelector(rowSelector) as HTMLElement | null
      if (!tile || !row) throw new Error(`missing ${name}`)
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
    },
    { name, rowSelector: rowSel(i < 2 ? 1 : i < 5 ? 2 : i < 7 ? 3 : i < 9 ? 4 : 5) },
  )
  await page.waitForTimeout(120)
}
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/04-editor-light.png`, fullPage: true })

// Dark mode + emerald accent.
await page.getByRole("button", { name: "Change accent colour" }).click()
await page.waitForTimeout(200)
await page.screenshot({ path: `${OUT}/05-accent-picker.png` })
await page.getByRole("button", { name: "Emerald" }).click()
await page.getByRole("button", { name: /^Dark$|^Light$/ }).click()
await page.waitForTimeout(300)
await page.keyboard.press("Escape")
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/06-editor-dark.png`, fullPage: true })

// Item edit dialog.
await page.locator('[data-item-tile]').filter({ hasText: "Exusiai" }).first().dblclick()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/07-item-edit.png` })
await page.keyboard.press("Escape")
await page.waitForTimeout(300)

// The real PNG export.
const [dl] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "Export" }).click()
    .then(() => page.getByRole("menuitem", { name: /PNG image/ }).click()),
])
await dl.saveAs(`${OUT}/08-exported-tier-list.png`)
console.log("saved 08-exported-tier-list.png")

// Back to the dashboard with cards.
await page.getByRole("button", { name: "Back to dashboard" }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/09-dashboard-filled.png`, fullPage: true })

// Mobile.
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(300)
await page.screenshot({ path: `${OUT}/10-mobile-dashboard.png` })
await page.getByRole("button", { name: "Open Arknights Operators" }).click()
await page.waitForTimeout(400)
await page.screenshot({ path: `${OUT}/11-mobile-editor.png`, fullPage: true })

await browser.close()
console.log("screenshots written to", OUT)
