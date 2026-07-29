export type Rarity = "common" | "uncommon" | "rare" | "mythic" | "legendary";

export const RARITY_ORDER: Rarity[] = [
  "common",
  "uncommon",
  "rare",
  "mythic",
  "legendary",
];

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "Common",
  uncommon: "Uncommon",
  rare: "Rare",
  mythic: "Mythic",
  legendary: "Legendary",
};

export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#9aabc8",
  uncommon: "#5ecf8e",
  rare: "#5a9fff",
  mythic: "#c080ff",
  legendary: "#ffe08a",
};

export function rarityRank(r: Rarity): number {
  return RARITY_ORDER.indexOf(r);
}
