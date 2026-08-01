/** Hero portrait URLs — files live in `public/art/heroes/`. */

import type { HeroId } from "./heroes";
import { HERO_LIST } from "./heroes";

export function heroArtUrl(id: HeroId | string, ext: "png" | "svg" = "png"): string {
  return `./art/heroes/${id}.${ext}`;
}

/** `<img>` that prefers painted PNG, falls back to unique SVG icon. */
export function heroArtImg(id: HeroId | string, className = "hero-art"): string {
  const png = heroArtUrl(id, "png");
  const svg = heroArtUrl(id, "svg");
  return `<img class="${className}" src="${png}" alt="" loading="lazy" data-fallback="${svg}" onerror="if(this.dataset.fallback){const f=this.dataset.fallback;delete this.dataset.fallback;this.src=f;}else{this.style.display='none';}" />`;
}

export const HERO_ART: Record<string, string> = Object.fromEntries(
  HERO_LIST.map((h) => [h.id, heroArtUrl(h.id, "png")]),
);
