// Decodes the exported PNG and checks it structurally, since the layout
// can't be eyeballed. Run with: npx tsx verify-png.ts
import { readFileSync } from "node:fs"
import { inflateSync } from "node:zlib"

const path = "C:/Users/macas/AppData/Local/Temp/opencode/tlm-check/08-exported-tier-list.png"
const buf = readFileSync(path)

let failures = 0
function check(name: string, ok: boolean, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${!ok && detail ? `\n          ${detail}` : ""}`)
  if (!ok) failures++
}

// --- chunk walk ---
const sig = buf.subarray(0, 8)
check("PNG signature", sig.toString("hex") === "89504e470d0a1a0a", sig.toString("hex"))

let off = 8
const chunks: Record<string, Buffer[]> = {}
const order: string[] = []
while (off < buf.length) {
  const len = buf.readUInt32BE(off)
  const type = buf.subarray(off + 4, off + 8).toString("ascii")
  order.push(type)
  // PNG data can be split across many IDAT chunks, so collect them all.
  ;(chunks[type] ??= []).push(buf.subarray(off + 8, off + 8 + len))
  off += 12 + len
}
const first = (t: string) => chunks[t][0]
check("has IHDR/IDAT/IEND", ["IHDR", "IDAT", "IEND"].every((t) => t in chunks), order.join(","))
check("first chunk is IHDR", order[0] === "IHDR", order[0])
check("last chunk is IEND", order[order.length - 1] === "IEND", order[order.length - 1])

const ihdr = first("IHDR")
const width = ihdr.readUInt32BE(0)
const height = ihdr.readUInt32BE(4)
const bitDepth = ihdr[8]
const colorType = ihdr[9]
const interlace = ihdr[12]
console.log(`        ${width}x${height}, depth=${bitDepth}, colorType=${colorType}`)

// --- unfilter to raw pixels ---
const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType as 0 | 2 | 3 | 4 | 6] ?? 4
check("8-bit RGB/RGBA", bitDepth === 8 && (colorType === 2 || colorType === 6), `depth=${bitDepth} type=${colorType}`)
check("not interlaced", interlace === 0)

const raw = inflateSync(Buffer.concat(chunks.IDAT))
const stride = width * channels
const expected = (stride + 1) * height
check("raw size matches header", raw.length === expected, `${raw.length} vs ${expected}`)

const out = Buffer.alloc(stride * height)
let pos = 0
for (let y = 0; y < height; y++) {
  const filter = raw[pos++]
  const row = raw.subarray(pos, pos + stride)
  pos += stride
  const cur = out.subarray(y * stride, (y + 1) * stride)
  const prior = y > 0 ? out.subarray((y - 1) * stride, y * stride) : Buffer.alloc(stride)
  for (let x = 0; x < stride; x++) {
    const a = x >= channels ? cur[x - channels] : 0
    const b = prior[x]
    const c = x >= channels ? prior[x - channels] : 0
    let v = row[x]
    switch (filter) {
      case 0: break
      case 1: v = (v + a) & 0xff; break
      case 2: v = (v + b) & 0xff; break
      case 3: v = (v + ((a + b) >> 1)) & 0xff; break
      case 4: {
        const p = a + b - c
        const pa = Math.abs(p - a)
        const pb = Math.abs(p - b)
        const pc = Math.abs(p - c)
        v = (v + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 0xff
        break
      }
      default: throw new Error(`bad filter ${filter} on row ${y}`)
    }
    cur[x] = v
  }
}
check("all scanlines decoded", pos === raw.length, `${pos}/${raw.length}`)

// --- content checks ---
const px = (x: number, y: number) => {
  const o = y * stride + x * channels
  return [out[o], out[o + 1], out[o + 2]]
}

// Debug: dump the distinct colours found down the label column.
const labelX = Math.round(width * 0.055)
const column = new Map<string, number>()
for (let y = 0; y < height; y++) {
  const c = px(labelX, y).join(",")
  column.set(c, (column.get(c) ?? 0) + 1)
}
const ranked = [...column.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
console.log(`        column x=${labelX} top colours: ${ranked.map(([c, n]) => `${c}(${n})`).join(" ")}`)

// Tier block colours come from DEFAULT_TIER_COLORS.
import { DEFAULT_TIER_COLORS, DEFAULT_TIER_NAMES } from "./src/data/defaults"

const expectedTiers = DEFAULT_TIER_NAMES.map((name, i) => {
  const hex = DEFAULT_TIER_COLORS[i % DEFAULT_TIER_COLORS.length]
  return [
    `${name} (${hex})`,
    [
      parseInt(hex.slice(1, 3), 16),
      parseInt(hex.slice(3, 5), 16),
      parseInt(hex.slice(5, 7), 16),
    ],
  ] as [string, number[]]
})

for (const [name, want] of expectedTiers) {
  const hit = ranked.find(
    ([c]) =>
      Math.abs(Number(c.split(",")[0]) - want[0]) < 12 &&
      Math.abs(Number(c.split(",")[1]) - want[1]) < 12 &&
      Math.abs(Number(c.split(",")[2]) - want[2]) < 12,
  )
  check(`tier colour band rendered — ${name}`, Boolean(hit), hit?.[0] ?? "not found")
}

// Item images are solid colours; look for variety in the body area.
const bodyX = Math.round(width * 0.75)
const distinct = new Set<string>()
for (let y = 0; y < height; y += 7) {
  distinct.add(px(bodyX, y).join(","))
}
check("body has multiple colours (items rendered)", distinct.size > 4, `distinct=${distinct.size}`)

// Not blank.
let nonWhite = 0
for (let y = 0; y < height; y += 5) {
  for (let x = 0; x < width; x += 5) {
    const [r, g, b] = px(x, y)
    if (r > 245 && g > 245 && b > 245) continue
    nonWhite++
  }
}
check("image is not blank", nonWhite > 200, `nonWhite=${nonWhite}`)

// Aspect ratio: a 900px-wide layout with 5 tiers + title should be tall-ish.
const ratio = width / height
check("plausible aspect ratio", ratio > 0.5 && ratio < 2.5, `w/h=${ratio.toFixed(2)}`)
check("file size sane", buf.length > 5000 && buf.length < 8_000_000, `${buf.length} bytes`)

console.log(`\n${failures === 0 ? "All checks passed." : `${failures} check(s) failed.`}`)
process.exit(failures === 0 ? 0 : 1)
