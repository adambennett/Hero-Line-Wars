/** Shop item portrait URLs — files live in `public/art/items/`. */

import type { ShopItemId } from "./shop";
import { SHOP_ITEMS } from "./shop";

export function itemArtUrl(id: ShopItemId, ext: "png" | "svg" = "png"): string {
  return `./art/items/${id}.${ext}`;
}

/** `<img>` that prefers painted PNG, falls back to unique SVG icon. */
export function itemArtImg(id: ShopItemId, className = "item-art"): string {
  const png = itemArtUrl(id, "png");
  const svg = itemArtUrl(id, "svg");
  return `<img class="${className}" src="${png}" alt="" loading="lazy" data-fallback="${svg}" onerror="if(this.dataset.fallback){const f=this.dataset.fallback;delete this.dataset.fallback;this.src=f;}" />`;
}

export const ITEM_ART: Partial<Record<ShopItemId, string>> = Object.fromEntries(
  SHOP_ITEMS.map((i) => [i.id, itemArtUrl(i.id, "png")]),
);
