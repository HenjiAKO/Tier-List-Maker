export type ListKind = "game" | "general"

export type SchemeId = "stars" | "letters" | "common" | "gacha" | "custom"

/** Rarity values are stored highest-first, the way gacha banners list them. */
export interface RarityScheme {
  scheme: SchemeId
  label: string
  values: string[]
}

export interface TierItem {
  id: string
  name: string
  /** Resized image as a data URL. */
  image: string
  rarity: string | null
  note: string
}

export interface Tier {
  id: string
  name: string
  color: string
  itemIds: string[]
}

export interface TierList {
  id: string
  title: string
  kind: ListKind
  /** null for general lists, which have no rarity. */
  rarity: RarityScheme | null
  tiers: Tier[]
  /** Placement is derived: an item is placed if its id sits in some tier's itemIds. */
  items: TierItem[]
  createdAt: number
  updatedAt: number
}

export interface AppData {
  version: number
  lists: TierList[]
}

export interface NewListInput {
  title: string
  kind: ListKind
  rarity: RarityScheme | null
}
