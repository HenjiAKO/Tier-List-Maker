import { useCallback, useMemo } from "react"
import {
  DATA_VERSION,
  STORAGE_KEY,
  makeDefaultTiers,
  newId,
  nextTierColor,
} from "@/data/defaults"
import { usePersistedState } from "@/hooks/use-persisted-state"
import type { AppData, NewListInput, Tier, TierItem, TierList } from "@/types"

const EMPTY: AppData = { version: DATA_VERSION, lists: [] }

export interface NewItemInput {
  /** Canvas output from processImageFile. */
  image: string
  name: string
}

/** The full surface returned by useLists, handy for prop typing. */
export type ListsApi = ReturnType<typeof useLists>

export function useLists() {
  const { value, setValue, error, flush } = usePersistedState<AppData>(STORAGE_KEY, EMPTY)

  const lists = value.lists

  const write = useCallback(
    (updater: (prev: AppData) => AppData) => {
      setValue((prev) => updater(prev))
    },
    [setValue],
  )

  /**
   * Applies a partial change to one list and stamps updatedAt. Returning a
   * partial keeps call sites from having to spread the whole list back.
   */
  const updateList = useCallback(
    (listId: string, updater: (list: TierList) => Partial<TierList>) => {
      write((prev) => ({
        ...prev,
        lists: prev.lists.map((list) =>
          list.id === listId ? { ...list, ...updater(list), updatedAt: Date.now() } : list,
        ),
      }))
    },
    [write],
  )

  const createList = useCallback(
    ({ title, kind, rarity }: NewListInput): TierList => {
      const now = Date.now()
      const list: TierList = {
        id: newId(),
        title: title.trim() || "Untitled tier list",
        kind,
        rarity: kind === "game" ? rarity : null,
        tiers: makeDefaultTiers(),
        items: [],
        createdAt: now,
        updatedAt: now,
      }
      write((prev) => ({ ...prev, lists: [list, ...prev.lists] }))
      return list
    },
    [write],
  )

  const deleteList = useCallback(
    (listId: string) => {
      write((prev) => ({ ...prev, lists: prev.lists.filter((l) => l.id !== listId) }))
    },
    [write],
  )

  const duplicateList = useCallback(
    (listId: string): TierList | null => {
      const source = lists.find((l) => l.id === listId)
      if (!source) return null

      // Remap item ids so the copy is fully independent.
      const idMap = new Map<string, string>()
      const items: TierItem[] = source.items.map((item) => {
        const id = newId()
        idMap.set(item.id, id)
        return { ...item, id }
      })

      const now = Date.now()
      const copy: TierList = {
        ...source,
        id: newId(),
        title: `${source.title} (copy)`,
        items,
        tiers: source.tiers.map((tier) => ({
          ...tier,
          id: newId(),
          itemIds: tier.itemIds
            .map((id) => idMap.get(id))
            .filter((id): id is string => Boolean(id)),
        })),
        createdAt: now,
        updatedAt: now,
      }

      write((prev) => ({ ...prev, lists: [copy, ...prev.lists] }))
      return copy
    },
    [lists, write],
  )

  const renameList = useCallback(
    (listId: string, title: string) => {
      const trimmed = title.trim()
      if (!trimmed) return
      updateList(listId, (list) => ({ ...list, title: trimmed }))
    },
    [updateList],
  )

  /* ---------------------------------- items --------------------------------- */

  /** Adds imported images as items. */
  const addItems = useCallback(
    (listId: string, incoming: NewItemInput[]) => {
      if (incoming.length === 0) return

      const items: TierItem[] = incoming.map((input) => ({
        id: newId(),
        image: input.image,
        name: input.name.trim(),
        rarity: null,
        note: "",
      }))

      updateList(listId, (list) => ({ ...list, items: [...list.items, ...items] }))
    },
    [updateList],
  )

  const updateItem = useCallback(
    (listId: string, itemId: string, patch: Partial<Omit<TierItem, "id">>) => {
      updateList(listId, (list) => ({
        ...list,
        items: list.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      }))
    },
    [updateList],
  )

  const removeItem = useCallback(
    (listId: string, itemId: string) => {
      updateList(listId, (list) => ({
        items: list.items.filter((item) => item.id !== itemId),
        tiers: list.tiers.map((tier) => ({
          ...tier,
          itemIds: tier.itemIds.filter((id) => id !== itemId),
        })),
      }))
    },
    [updateList],
  )

  /**
   * Places an item in a tier at `index`, or unplaces it when tierId is null.
   *
   * `index` is measured by the UI with the dragged tile still in the row, so
   * when the item is already in the target tier it has to be removed first and
   * the index shifted back by one.
   */
  const placeItem = useCallback(
    (listId: string, itemId: string, tierId: string | null, index?: number) => {
      updateList(listId, (list) => {
        const origin = list.tiers.find((tier) => tier.itemIds.includes(itemId))
        const fromInOrigin = origin ? origin.itemIds.indexOf(itemId) : -1

        const tiers: Tier[] = list.tiers.map((tier) => ({
          ...tier,
          itemIds: tier.itemIds.filter((id) => id !== itemId),
        }))

        if (tierId === null) return { ...list, tiers }

        const target = tiers.find((tier) => tier.id === tierId)
        if (!target) return { ...list, tiers }

        let at =
          typeof index === "number"
            ? Math.min(Math.max(index, 0), target.itemIds.length + 1)
            : target.itemIds.length

        // Undo the shift caused by pulling the item out of this same row.
        if (origin && origin.id === tierId && fromInOrigin < at) at -= 1

        target.itemIds.splice(Math.max(0, at), 0, itemId)
        return { ...list, tiers }
      })
    },
    [updateList],
  )

  /* ---------------------------------- tiers --------------------------------- */

  const addTier = useCallback(
    (listId: string, name: string) => {
      const trimmed = name.trim()
      if (!trimmed) return
      updateList(listId, (list) => ({
        tiers: [
          ...list.tiers,
          {
            id: newId(),
            name: trimmed,
            color: nextTierColor(list.tiers.length),
            itemIds: [],
          },
        ],
      }))
    },
    [updateList],
  )

  const updateTier = useCallback(
    (listId: string, tierId: string, patch: Partial<Omit<Tier, "id" | "itemIds">>) => {
      updateList(listId, (list) => ({
        tiers: list.tiers.map((tier) => (tier.id === tierId ? { ...tier, ...patch } : tier)),
      }))
    },
    [updateList],
  )

  /** Deleting a tier never deletes items — they simply become unplaced again. */
  const removeTier = useCallback(
    (listId: string, tierId: string) => {
      updateList(listId, (list) => ({
        tiers: list.tiers.filter((tier) => tier.id !== tierId),
      }))
    },
    [updateList],
  )

  const moveTier = useCallback(
    (listId: string, tierId: string, direction: -1 | 1) => {
      updateList(listId, (list) => {
        const from = list.tiers.findIndex((t) => t.id === tierId)
        const to = from + direction
        if (from < 0 || to < 0 || to >= list.tiers.length) return list
        const tiers = [...list.tiers]
        const [moved] = tiers.splice(from, 1)
        tiers.splice(to, 0, moved)
        return { ...list, tiers }
      })
    },
    [updateList],
  )

  /* --------------------------------- library -------------------------------- */

  const importLists = useCallback(
    (incoming: TierList[]) => {
      write((prev) => ({ ...prev, lists: [...incoming, ...prev.lists] }))
    },
    [write],
  )

  const sortedLists = useMemo(
    () => [...lists].sort((a, b) => b.updatedAt - a.updatedAt),
    [lists],
  )

  return {
    lists,
    sortedLists,
    error,
    flush,
    createList,
    deleteList,
    duplicateList,
    renameList,
    addItems,
    updateItem,
    removeItem,
    placeItem,
    addTier,
    updateTier,
    removeTier,
    moveTier,
    importLists,
  }
}

/** Ids of items that are not referenced by any tier. */
export function unplacedIds(list: TierList): string[] {
  const placed = new Set(list.tiers.flatMap((t) => t.itemIds))
  return list.items.filter((item) => !placed.has(item.id)).map((item) => item.id)
}

export function itemMap(list: TierList): Map<string, TierItem> {
  return new Map(list.items.map((item) => [item.id, item]))
}
