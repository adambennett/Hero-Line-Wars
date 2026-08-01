/** Relic portrait URLs — files live in `public/art/relics/`. */

import type { RelicId } from "./relics";
import { RELIC_LIST } from "./relics";

export function relicArtUrl(id: RelicId, ext: "png" | "svg" = "png"): string {
  return `./art/relics/${id}.${ext}`;
}

/** `<img>` that prefers painted PNG, falls back to unique SVG icon. */
export function relicArtImg(id: RelicId, className = "relic-art"): string {
  const png = relicArtUrl(id, "png");
  const svg = relicArtUrl(id, "svg");
  return `<img class="${className}" src="${png}" alt="" loading="lazy" data-fallback="${svg}" onerror="if(this.dataset.fallback){const f=this.dataset.fallback;delete this.dataset.fallback;this.src=f;}" />`;
}

export const RELIC_ART: Record<RelicId, string> = Object.fromEntries(
  RELIC_LIST.map((r) => [r.id, relicArtUrl(r.id, "png")]),
) as Record<RelicId, string>;
