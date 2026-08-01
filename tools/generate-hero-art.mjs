/**
 * Generates stylized character portrait SVGs for every HeroId in public/art/heroes/.
 * Distinct silhouettes + palette per hero; readable as menu thumbs.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "public", "art", "heroes");

/** [id, displayName, color, glow, silhouetteKind] */
const HEROES = [
  ["ranger", "Ranger", "#5ec8f0", "#5ef0c8", "archer"],
  ["warden", "Warden", "#e0a045", "#ffe08a", "tank"],
  ["scatter", "Scatter", "#f07858", "#ffb090", "shotgun"],
  ["arbalest", "Arbalest", "#8a7cf0", "#c8b8ff", "crossbow"],
  ["prism", "Prism", "#5ef0a8", "#b8ffe0", "crystal"],
  ["frost", "Frost", "#7ec8ff", "#d0f0ff", "ice"],
  ["wizard", "Chaos", "#e070d0", "#ffb0f0", "chaos"],
  ["coil", "Coil", "#ffd24a", "#fff0a8", "coil"],
  ["thorn", "Thorn", "#6bcf5a", "#b8f0a0", "plant"],
  ["ember", "Ember", "#ff6a3a", "#ffc090", "flame"],
  ["void", "Void", "#7a5cff", "#c8b0ff", "rift"],
  ["titan", "Titan", "#c8a060", "#ffe0a8", "brute"],
  ["mirage", "Mirage", "#50d0d8", "#a8f0f8", "mirror"],
  ["medic", "Medic", "#70e090", "#c0ffd0", "medic"],
  ["tempest", "Tempest", "#90c8ff", "#d0e8ff", "wind"],
  ["curses", "Hex", "#a060c8", "#e0a0ff", "hex"],
  ["warp", "Warp", "#48c8e8", "#a8f0ff", "gate"],
  ["gyro", "Gyro", "#c0c8d8", "#e8f0ff", "blade"],
  ["lodestone", "Lodestone", "#6a8cff", "#b8c8ff", "magnet"],
  ["chrona", "Chrona", "#c8a0ff", "#e8d0ff", "clock"],
  ["hive", "Hive", "#d4a020", "#ffe08a", "swarm"],
];

function silhouette(kind, color, glow) {
  const c = color;
  const g = glow;
  // Shared torso + head base; props differ by kind
  const body = `
    <ellipse cx="32" cy="48" rx="14" ry="8" fill="${c}" opacity="0.35"/>
    <path d="M22 46c2-14 6-22 10-26 4 4 8 12 10 26" fill="${c}" opacity="0.9"/>
    <circle cx="32" cy="18" r="9" fill="${c}"/>
    <circle cx="32" cy="18" r="9" fill="none" stroke="${g}" stroke-width="1.5" opacity="0.7"/>
  `;
  const props = {
    archer: `<path d="M44 22 L52 14 M44 22 L54 28" stroke="${g}" stroke-width="2" stroke-linecap="round"/>
      <path d="M46 16c6 4 6 12 0 16" fill="none" stroke="${g}" stroke-width="1.8"/>`,
    tank: `<path d="M20 30h24v10c0 6-6 10-12 10s-12-4-12-10z" fill="${c}" opacity="0.55" stroke="${g}" stroke-width="1.5"/>`,
    shotgun: `<rect x="42" y="26" width="14" height="5" rx="1" fill="${g}"/>
      <circle cx="48" cy="22" r="2" fill="${g}" opacity="0.8"/><circle cx="52" cy="20" r="1.5" fill="${g}" opacity="0.5"/>`,
    crossbow: `<path d="M18 28h28M20 28l-4-8M46 28l4-8M32 28v14" stroke="${g}" stroke-width="2" stroke-linecap="round"/>`,
    crystal: `<path d="M32 6 L40 18 L32 22 L24 18 Z" fill="${g}" opacity="0.85"/>
      <path d="M26 34 L32 28 L38 34" fill="none" stroke="${g}" stroke-width="1.6"/>`,
    ice: `<path d="M32 8v8M28 12h8M24 28l8-6 8 6" stroke="${g}" stroke-width="1.8" stroke-linecap="round"/>
      <circle cx="20" cy="36" r="2" fill="${g}" opacity="0.6"/><circle cx="44" cy="34" r="1.5" fill="${g}" opacity="0.5"/>`,
    chaos: `<path d="M18 16c8-8 20 2 12 10M46 14c-6 8 2 16 8 8M22 40c10-4 18 6 10 10" fill="none" stroke="${g}" stroke-width="2" stroke-linecap="round"/>
      <circle cx="40" cy="12" r="3" fill="${g}"/>`,
    coil: `<circle cx="32" cy="32" r="16" fill="none" stroke="${g}" stroke-width="2" opacity="0.5"/>
      <path d="M24 40 Q32 20 40 40" fill="none" stroke="${g}" stroke-width="2.2"/>
      <circle cx="32" cy="28" r="3" fill="${g}"/>`,
    plant: `<path d="M32 28c-8-10-16-4-14 4 6 2 10 0 14-4c4 4 8 6 14 4 2-8-6-14-14-4z" fill="${g}" opacity="0.75"/>
      <path d="M32 28v18" stroke="${c}" stroke-width="2"/>`,
    flame: `<path d="M32 10c8 10 10 16 10 22a10 10 0 1 1-20 0c0-6 4-12 10-22z" fill="${g}" opacity="0.8"/>
      <path d="M32 22c4 6 4 10 4 12a4 4 0 1 1-8 0c0-2 2-6 4-12z" fill="${c}"/>`,
    rift: `<ellipse cx="32" cy="30" rx="6" ry="16" fill="#0a0618" stroke="${g}" stroke-width="2"/>
      <path d="M18 22c8 4 8 16 0 20M46 22c-8 4-8 16 0 20" fill="none" stroke="${g}" stroke-width="1.6" opacity="0.7"/>`,
    brute: `<rect x="18" y="28" width="28" height="18" rx="4" fill="${c}" opacity="0.7"/>
      <rect x="14" y="32" width="8" height="10" rx="2" fill="${g}" opacity="0.6"/>
      <rect x="42" y="32" width="8" height="10" rx="2" fill="${g}" opacity="0.6"/>`,
    mirror: `<path d="M24 14h16l4 20H20z" fill="none" stroke="${g}" stroke-width="2"/>
      <path d="M28 20h8M26 28h12" stroke="${g}" stroke-width="1.4" opacity="0.7"/>
      <circle cx="44" cy="36" r="5" fill="none" stroke="${g}" stroke-width="1.5" opacity="0.5"/>`,
    medic: `<circle cx="32" cy="34" r="10" fill="${g}" opacity="0.35"/>
      <path d="M32 26v16M24 34h16" stroke="${g}" stroke-width="2.8" stroke-linecap="round"/>`,
    wind: `<path d="M16 24c10-8 22-4 28 4M14 34c12-6 24-2 30 6M18 44c8-4 18-2 24 4" fill="none" stroke="${g}" stroke-width="2" stroke-linecap="round"/>`,
    hex: `<path d="M32 10l8 5v10l-8 5-8-5V15z" fill="none" stroke="${g}" stroke-width="2"/>
      <circle cx="32" cy="20" r="3" fill="${g}"/>
      <path d="M20 40c6-6 18-6 24 0" fill="none" stroke="${g}" stroke-width="1.6"/>`,
    gate: `<rect x="20" y="12" width="24" height="28" rx="3" fill="none" stroke="${g}" stroke-width="2"/>
      <path d="M26 20h12M26 28h12M26 36h8" stroke="${g}" stroke-width="1.5" opacity="0.7"/>
      <circle cx="38" cy="36" r="2" fill="${g}"/>`,
    blade: `<circle cx="32" cy="32" r="14" fill="none" stroke="${g}" stroke-width="2"/>
      <path d="M32 18v28M18 32h28" stroke="${g}" stroke-width="1.8"/>
      <path d="M22 22l20 20M42 22L22 42" stroke="${c}" stroke-width="1.4" opacity="0.7"/>`,
    magnet: `<path d="M22 20c0-8 20-8 20 0v16c0 4-4 6-6 6h-2V28h-4v14h-2c-2 0-6-2-6-6z" fill="none" stroke="${g}" stroke-width="2.4" stroke-linejoin="round"/>
      <circle cx="26" cy="44" r="3" fill="${c}"/><circle cx="38" cy="44" r="3" fill="${g}"/>`,
    clock: `<circle cx="32" cy="28" r="14" fill="none" stroke="${g}" stroke-width="2.2"/>
      <circle cx="32" cy="28" r="2" fill="${g}"/>
      <path d="M32 28 L32 18 M32 28 L40 32" stroke="${g}" stroke-width="2" stroke-linecap="round"/>
      <path d="M20 44h24" stroke="${c}" stroke-width="2" opacity="0.6"/>`,
    swarm: `<circle cx="24" cy="20" r="4" fill="${g}"/><circle cx="36" cy="16" r="3.5" fill="${g}" opacity="0.85"/>
      <circle cx="42" cy="28" r="4" fill="${c}"/><circle cx="28" cy="30" r="5" fill="${g}" opacity="0.7"/>
      <circle cx="20" cy="36" r="3" fill="${c}" opacity="0.8"/><circle cx="38" cy="40" r="3.5" fill="${g}"/>`,
  };
  return `${body}${props[kind] ?? ""}`;
}

function svgFor([id, name, color, glow, kind]) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 64 64" role="img" aria-label="${name}">
  <defs>
    <radialGradient id="bg-${id}" cx="40%" cy="30%" r="75%">
      <stop offset="0%" stop-color="#243048"/>
      <stop offset="100%" stop-color="#0a1018"/>
    </radialGradient>
    <linearGradient id="rim-${id}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${glow}"/>
      <stop offset="100%" stop-color="${color}"/>
    </linearGradient>
  </defs>
  <rect x="2" y="2" width="60" height="60" rx="14" fill="url(#bg-${id})" stroke="url(#rim-${id})" stroke-width="2.5"/>
  <circle cx="32" cy="34" r="22" fill="${color}" opacity="0.08"/>
  ${silhouette(kind, color, glow)}
</svg>
`;
}

fs.mkdirSync(outDir, { recursive: true });
for (const row of HEROES) {
  fs.writeFileSync(path.join(outDir, `${row[0]}.svg`), svgFor(row), "utf8");
}
console.log(`Wrote ${HEROES.length} hero portraits → ${outDir}`);
