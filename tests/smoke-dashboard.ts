// Smoke test: drives the built app in Edge via Playwright.
// Run with: npx tsx smoke.ts   (expects `npm run preview` on :4173)
import { readFileSync } from "node:fs"
import { chromium, type ConsoleMessage } from "playwright"

const BASE = "http://localhost:4173/"
let failures = 0

function rgbToHex(value: string): string {
  const m = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!m) return value
  const hex = (n: string) => Number(n).toString(16).padStart(2, "0")
  return `#${hex(m[1])}${hex(m[2])}${hex(m[3])}`
}

function check(name: string, ok: boolean, detail = "") {
  if (ok) {
    console.log(`  PASS  ${name}`)
  } else {
    failures++
    console.log(`  FAIL  ${name}${detail ? `\n          ${detail}` : ""}`)
  }
}

const browser = await chromium.launch({ channel: "msedge" })
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } })

const errors: string[] = []
page.on("console", (m: ConsoleMessage) => {
  if (m.type() === "error") errors.push(m.text())
})
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`))

await page.goto(BASE, { waitUntil: "networkidle" })

console.log("dashboard")
check("title is set", (await page.title()) === "Tier List Maker", await page.title())
check(
  "empty state renders",
  await page.getByText("No tier lists yet").isVisible(),
)
check("sidebar rail is visible at 1280px", await page.getByRole("button", { name: /Home/ }).first().isVisible())

// --- the generic button still asks which kind it is ---
await page.getByRole("button", { name: "New tier list" }).first().click()
check(
  "generic new button still asks for the kind",
  await page.getByText("What kind of tier list?").isVisible(),
)

// --- the Game tile skips that question ---
await page.keyboard.press("Escape")
await page.waitForTimeout(200)
await page.getByRole("button", { name: /Game tier list/ }).click()
await page.waitForTimeout(200)
check(
  "game tile skips the kind question",
  !(await page.getByText("What kind of tier list?").isVisible()),
)
check(
  "game tile lands on the rarity step",
  await page.getByText("Pick a rarity system").isVisible(),
)
check(
  "no Back from a preset entry",
  (await page.getByRole("dialog").getByRole("button", { name: "Back" }).count()) === 0,
)

// --- the General tile skips it too ---
await page.keyboard.press("Escape")
await page.waitForTimeout(200)
await page.getByRole("button", { name: /General tier list/ }).click()
await page.waitForTimeout(200)
check(
  "general tile skips the kind question",
  !(await page.getByText("What kind of tier list?").isVisible()),
)
check(
  "general tile lands on the title field",
  await page.locator("#list-title").isVisible(),
)
check(
  "general tile has no Back either",
  (await page.getByRole("dialog").getByRole("button", { name: "Back" }).count()) === 0,
)

// --- create a General list through the generic path ---
await page.keyboard.press("Escape")
await page.waitForTimeout(200)
await page.getByRole("button", { name: "New tier list" }).first().click()
await page.getByRole("dialog").getByRole("button", { name: /^General/ }).click()
await page.locator("#list-title").fill("Smoke General")
await page.getByRole("button", { name: /^Create/ }).click()

console.log("editor")
check("editor opened", await page.getByRole("heading", { name: "Smoke General" }).isVisible())
for (const t of ["S", "A", "B", "C", "D"]) {
  check(
    `default tier ${t} present`,
    (await page.getByRole("button", { name: t, exact: true }).count()) > 0,
  )
}
check("unplaced dropzone present", await page.getByText("Unplaced").first().isVisible())

// --- tier actions live behind one menu, not four buttons ---
console.log("tier menu")
const aMenu = page.getByRole("button", { name: "Tier options for A" })
check("tier menu trigger present", await aMenu.isVisible())
check(
  "old icon buttons are gone from the tier block",
  (await page.getByTitle("Move up").count()) === 0 &&
    (await page.getByTitle("Delete tier").count()) === 0 &&
    (await page.getByTitle("Change tier colour").count()) === 0,
)
// Radix menus mark the rest of the page aria-hidden, so close cleanly between
// assertions or the next trigger won't be reachable by role.
async function openTierMenu(tier: string) {
  await page.getByRole("button", { name: `Tier options for ${tier}` }).click()
  await page.waitForTimeout(200)
  return page.getByRole("menu")
}
async function closeTierMenu() {
  await page.keyboard.press("Escape")
  await page.waitForFunction(() => document.querySelectorAll('[role="menu"]').length === 0)
}

const tierMenu = await openTierMenu("A")
for (const label of ["Rename", "Move up", "Move down", "Change colour", "Delete tier"]) {
  check(`menu exposes ${label}`, await tierMenu.getByRole("menuitem", { name: label }).isVisible())
}
// The menu opened for A, which is the second tier, so Move up is available.
check(
  "second tier can move up",
  !(await tierMenu.getByRole("menuitem", { name: "Move up" }).isDisabled()),
)
// Rename through the menu to prove the inline editor still opens.
await tierMenu.getByRole("menuitem", { name: "Rename" }).click()
await page.waitForTimeout(200)
check("menu rename opens the inline input", await page.locator('input[value="A"]').isVisible())
await page.locator('input[value="A"]').fill("Alpha")
await page.keyboard.press("Enter")
await page.waitForTimeout(300)
check(
  "menu rename applied",
  (await page.getByRole("button", { name: "Alpha", exact: true }).count()) > 0,
)

// The edges of the list disable the move that would go nowhere.
const sMenu = await openTierMenu("S")
check(
  "first tier cannot move up",
  await sMenu.getByRole("menuitem", { name: "Move up" }).isDisabled(),
)
await closeTierMenu()
const dMenu = await openTierMenu("D")
check(
  "last tier cannot move down",
  await dMenu.getByRole("menuitem", { name: "Move down" }).isDisabled(),
)
await closeTierMenu()

// Recolor via the submenu.
await openTierMenu("Alpha")
await page.getByRole("menuitem", { name: "Change colour" }).hover()
await page.waitForTimeout(300)
await page.getByRole("menuitem", { name: "#da77f2" }).click()
await page.waitForFunction(() => document.querySelectorAll('[role="menu"]').length === 0)
const alphaBg = await page.evaluate(() => {
  const name = [...document.querySelectorAll("button")].find(
    (b) => b.textContent?.trim() === "Alpha",
  )
  return name?.parentElement?.style.backgroundColor ?? ""
})
check(
  "menu recolor applied",
  rgbToHex(alphaBg) === "#da77f2",
  `got ${alphaBg}`,
)

// Move down through the menu, then put it back.
await openTierMenu("Alpha")
await page.getByRole("menuitem", { name: "Move down" }).click()
await page.waitForTimeout(400)
const tierOrder = await page.evaluate(() =>
  [...document.querySelectorAll('[aria-label^="Tier options for "]')].map(
    (b) => b.getAttribute("aria-label")?.replace("Tier options for ", "") ?? "",
  ),
)
// Alpha started second (index 1); moving down swaps it past B to index 2.
check("menu moved the tier down", tierOrder[2] === "Alpha", tierOrder.join(","))
await openTierMenu("Alpha")
await page.getByRole("menuitem", { name: "Move up" }).click()
await page.waitForTimeout(400)
const restored = await page.evaluate(() =>
  [...document.querySelectorAll('[aria-label^="Tier options for "]')].map(
    (b) => b.getAttribute("aria-label")?.replace("Tier options for ", "") ?? "",
  ),
)
check("menu moved it back up", restored[1] === "Alpha", restored.join(","))

// --- add a tier ---
await page.getByPlaceholder(/Add a tier/).fill("Favourites")
await page.getByRole("button", { name: "Add tier" }).click()
check(
  "custom tier added",
  (await page.getByRole("button", { name: "Favourites", exact: true }).count()) > 0,
)

// --- add an item by importing a generated PNG ---
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAT0lEQVRoge3OMQEAAAgDoK1/aM3g4QcJ" +
    "ZFxBTEyMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTExMTFjxIkj" +
    "KgAAHg4AAF3rZbUAAAAASUVORK5CYII=",
  "base64",
)
await page.locator('input[type="file"][accept*="image"]').setInputFiles({
  name: "alpha.png",
  mimeType: "image/png",
  buffer: png,
})

await page.waitForTimeout(600)
check(
  "item added to pool",
  (await page.getByRole("img", { name: "alpha" }).count()) > 0,
)

// --- select item, then tap a tier to place it ---
await page.getByRole("img", { name: "alpha" }).first().click()
check("selection banner appears", await page.getByText(/tap a tier to place it/).isVisible())
await page.getByRole("button", { name: "Favourites", exact: true }).click()
await page.getByText(/tap a tier to place it/).waitFor({ state: "detached", timeout: 3000 }).catch(() => {})
check(
  "item placed in Favourites",
  (await page.locator('[data-item-tile]').count()) === 1,
)

// --- add a second item and place it in S ---
await page.locator('input[type="file"][accept*="image"]').setInputFiles({
  name: "beta.png",
  mimeType: "image/png",
  buffer: png,
})
await page.waitForTimeout(600)
await page.getByRole("img", { name: "beta" }).first().click()
await page.getByRole("button", { name: "S", exact: true }).click()
await page.waitForTimeout(300)
check("two items placed", (await page.locator("[data-item-tile]").count()) === 2)

// --- persistence across reload ---
await page.reload({ waitUntil: "networkidle" })
await page.getByRole("button", { name: "Smoke General" }).first().click().catch(() => {})
await page.waitForTimeout(400)
check(
  "list survived reload with items",
  (await page.locator("[data-item-tile]").count()) === 2,
)

// --- theme + accent (both live in the accent popover) ---
const beforeDark = await page.evaluate(() => document.documentElement.classList.contains("dark"))
await page.getByRole("button", { name: "Change accent colour" }).first().click()
await page.getByRole("button", { name: /^Dark$|^Light$/ }).click()
await page.waitForTimeout(200)
const afterDark = await page.evaluate(() => document.documentElement.classList.contains("dark"))
check("theme toggles", beforeDark !== afterDark, `before=${beforeDark} after=${afterDark}`)

// accent stylesheet should change and survive a reload
await page.getByRole("button", { name: "Emerald" }).click()
await page.waitForTimeout(150)
const accentNow = await page.evaluate(
  () => document.getElementById("tlm-accent-style")?.textContent ?? "",
)
check("accent stylesheet injected", accentNow.includes("--primary:"), accentNow.slice(0, 80))
await page.keyboard.press("Escape")
await page.reload({ waitUntil: "networkidle" })
const accentAfter = await page.evaluate(
  () => document.getElementById("tlm-accent-style")?.textContent ?? "",
)
check("accent persisted across reload", accentAfter === accentNow)
const darkPersisted = await page.evaluate(() =>
  document.documentElement.classList.contains("dark"),
)
check("theme persisted across reload", darkPersisted === afterDark)

// A reload returns to the dashboard: the open-list id isn't persisted.
check("reload lands on dashboard", await page.getByText("Your tier lists").isVisible())

// --- back and forth navigation ---
await page.getByRole("button", { name: "Open Smoke General" }).click()
await page.getByRole("heading", { name: "Smoke General" }).waitFor({ timeout: 3000 })
check("card opens the editor", true)
await page.getByRole("button", { name: "Back to dashboard" }).click()
await page.getByText("Your tier lists").waitFor({ timeout: 3000 })
check("back button returns to dashboard", true)

// --- JSON export + round-trip import ---
const [download] = await Promise.all([
  page.waitForEvent("download"),
  page.getByRole("button", { name: "Actions for Smoke General" }).click()
    .then(() => page.getByRole("menuitem", { name: /Export JSON/ }).click()),
])
const path = await download.path()
const json = JSON.parse(readFileSync(path!, "utf8")) as {
  version: number
  lists: { id: string; title: string; items: unknown[]; tiers: unknown[]; rarity: unknown }[]
}
check("exported filename is slugified", download.suggestedFilename() === "smoke-general.json",
  download.suggestedFilename())
check("export shape is {version, lists}", json.version === 1 && Array.isArray(json.lists))
check("exported list has items", json.lists[0]?.items.length === 2)
check("exported list has tiers", (json.lists[0]?.tiers.length ?? 0) === 6)
check("general list has null rarity", json.lists[0]?.rarity === null)

// Re-importing the same file must not reuse the list id.
await page.locator('input[type="file"][accept*="json"]').setInputFiles(path!)
await page.getByText("Imported 1 tier list").waitFor({ timeout: 5000 })
await page.waitForTimeout(400)
const cards = await page.getByRole("button", { name: /^Open / }).count()
check("import created a second card", cards === 2, `cards=${cards}`)

// localStorage writes are debounced by 300ms.
await page.waitForTimeout(600)
const ids = await page.evaluate(() => {
  const raw = window.localStorage.getItem("tier-list-maker:v1")
  return raw ? (JSON.parse(raw).lists as { id: string }[]).map((l) => l.id) : []
})
check("imported list has a unique id", new Set(ids).size === ids.length, ids.join(","))
check("stored list count is 2", ids.length === 2, `count=${ids.length}`)

console.log("console errors")
check("no console errors", errors.length === 0, errors.slice(0, 5).join("\n          "))

// --- mobile: the rail is hidden below lg, so the header must carry the nav ---
console.log("mobile")
await page.setViewportSize({ width: 390, height: 844 })
await page.waitForTimeout(400)
// The rail <aside> is lg-only; the header nav replaces it below that.
check(
  "rail hidden on mobile",
  !(await page.locator("aside").isVisible()),
)
check(
  "header nav is visible on mobile",
  await page.getByRole("button", { name: "All lists", exact: true }).isVisible(),
)
await page.getByRole("button", { name: "All lists", exact: true }).click()
await page.waitForTimeout(300)
check("mobile nav switches view", await page.getByRole("heading", { name: "All lists" }).isVisible())

await page.getByRole("button", { name: "Home", exact: true }).click()
await page.waitForTimeout(300)
check("mobile nav switches back", await page.getByRole("heading", { name: "Your tier lists" }).isVisible())
check("no console errors on mobile", errors.length === 0, errors.slice(0, 5).join("\n          "))

await browser.close()
console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
