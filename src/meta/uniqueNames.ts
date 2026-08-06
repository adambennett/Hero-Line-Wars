/**
 * Shared unique-name checks for game types, heroes, and maps.
 * Save path: refuse collisions. Import path: auto-rename with (Custom) suffixes.
 */

/** Case-sensitive name collision against a list of taken names. */
export function isNameTaken(name: string, taken: Iterable<string>): boolean {
  const n = name.trim();
  if (!n) return true;
  for (const t of taken) {
    if (t === n) return true;
  }
  return false;
}

/**
 * Import rename: if `base` collides, try `base (Custom)`, then
 * `base (Custom) (1)`, `base (Custom) (2)`, …
 */
export function uniqueImportName(base: string, taken: Iterable<string>): string {
  const seed = (base.trim() || "Custom").slice(0, 40);
  const used = new Set(Array.from(taken));
  if (!used.has(seed)) return seed;
  const first = `${seed} (Custom)`.slice(0, 48);
  if (!used.has(first)) return first;
  let i = 1;
  for (;;) {
    const candidate = `${seed} (Custom) (${i})`.slice(0, 48);
    if (!used.has(candidate)) return candidate;
    i += 1;
    if (i > 10_000) return `${seed}_${Date.now().toString(36)}`.slice(0, 48);
  }
}

export function uniqueNameError(kind: "game type" | "hero" | "map", name: string): string {
  return `A ${kind} named “${name.trim()}” already exists. Choose a unique name.`;
}
