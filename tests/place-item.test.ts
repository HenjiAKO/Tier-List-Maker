// Unit checks for the placeItem reducer in src/hooks/use-lists.ts.
//
// The reducer is mirrored here rather than imported because useLists depends on
// React state and localStorage; this keeps the index maths testable in isolation.
// Run with: npm run test:unit

interface Tier {
  id: string
  itemIds: string[]
}
interface List {
  tiers: Tier[]
}

/** Mirrors placeItem in src/hooks/use-lists.ts. */
function placeItem(list: List, itemId: string, tierId: string | null, index?: number): List {
  const origin = list.tiers.find((tier) => tier.itemIds.includes(itemId))
  const fromInOrigin = origin ? origin.itemIds.indexOf(itemId) : -1

  const tiers: Tier[] = list.tiers.map((tier) => ({
    ...tier,
    itemIds: tier.itemIds.filter((id) => id !== itemId),
  }))

  if (tierId === null) return { tiers }

  const target = tiers.find((tier) => tier.id === tierId)
  if (!target) return { tiers }

  let at =
    typeof index === "number"
      ? Math.min(Math.max(index, 0), target.itemIds.length + 1)
      : target.itemIds.length

  // Pulling the item out of this same row shifts every later index down by one.
  if (origin && origin.id === tierId && fromInOrigin < at) at -= 1

  target.itemIds.splice(Math.max(0, at), 0, itemId)
  return { tiers }
}

let failures = 0
function check(name: string, actual: unknown, expected: unknown) {
  const a = JSON.stringify(actual)
  const e = JSON.stringify(expected)
  if (a === e) {
    console.log(`  PASS  ${name}`)
  } else {
    failures++
    console.log(`  FAIL  ${name}\n          expected >${e}<\n          actual   >${a}<`)
  }
}

const tier = (id: string, itemIds: string[]): Tier => ({ id, itemIds })
const list = (tiers: Tier[]): List => ({ tiers })
const rows = (l: List) => l.tiers.map((t) => `${t.id}:[${t.itemIds.join(",")}]`).join(" ")

console.log("placeItem: placing and unplacing")

check("into an empty tier", rows(placeItem(list([tier("S", []), tier("A", ["x"])]), "n", "S", 0)), "S:[n] A:[x]")
check("at index 1", rows(placeItem(list([tier("S", ["x", "y", "z"])]), "n", "S", 1)), "S:[x,n,y,z]")
check("index past the end clamps", rows(placeItem(list([tier("S", ["x", "y"])]), "n", "S", 99)), "S:[x,y,n]")
check("between tiers", rows(placeItem(list([tier("S", ["x"]), tier("A", ["y"])]), "x", "A", 1)), "S:[] A:[y,x]")
check("unplace returns it to the pool", rows(placeItem(list([tier("S", ["x", "y"]), tier("A", [])]), "x", null)), "S:[y] A:[]")
check("unknown tier is a no-op", rows(placeItem(list([tier("S", ["x"])]), "x", "nope", 0)), "S:[]")

console.log("placeItem: reordering within a tier")

// The drop index is measured against the row as displayed, which still contains
// the dragged tile, so index N means "before the tile currently at N".
check("before tile at index 2", rows(placeItem(list([tier("S", ["a", "b", "c"])]), "a", "S", 2)), "S:[b,a,c]")
check("past the last tile appends", rows(placeItem(list([tier("S", ["a", "b", "c"])]), "a", "S", 3)), "S:[b,c,a]")
check("backwards to the front", rows(placeItem(list([tier("S", ["a", "b", "c"])]), "c", "S", 0)), "S:[c,a,b]")
check("into the middle", rows(placeItem(list([tier("S", ["a", "b", "c", "d"])]), "d", "S", 2)), "S:[a,b,d,c]")
check("dropped on itself changes nothing", rows(placeItem(list([tier("S", ["a", "b"])]), "a", "S", 0)), "S:[a,b]")

// The regression this guards: the old reducer kept the dragged id in the target
// row and then inserted it again, duplicating the item.
const forward = placeItem(list([tier("S", ["a", "b", "c"])]), "a", "S", 3)
const ids = forward.tiers.flatMap((t) => t.itemIds)
check("no duplicate after a forward move", { total: ids.length, unique: new Set(ids).size }, { total: 3, unique: 3 })

// Every item must still exist somewhere exactly once after any move.
for (const [itemId, index] of [
  ["a", 0], ["a", 1], ["a", 2], ["a", 3],
  ["b", 0], ["b", 1], ["b", 2], ["b", 3],
  ["c", 0], ["c", 1], ["c", 2], ["c", 3],
] as [string, number][]) {
  const after = placeItem(list([tier("S", ["a", "b", "c"])]), itemId, "S", index)
  const got = after.tiers.flatMap((t) => t.itemIds)
  check(`invariant holds moving ${itemId} to index ${index}`, [...got].sort(), ["a", "b", "c"])
}

console.log(failures === 0 ? "\nAll checks passed." : `\n${failures} check(s) failed.`)
process.exit(failures === 0 ? 0 : 1)
