/**
 * Headless test environment.
 *
 * The game modules are browser-first (settings, cheats, and the meta store all
 * read `localStorage` at import time), so provide a tiny in-memory shim before
 * anything else loads. Nothing here changes game behaviour.
 */

class MemoryStorage {
  private data = new Map<string, string>();

  get length(): number {
    return this.data.size;
  }

  key(i: number): string | null {
    return [...this.data.keys()][i] ?? null;
  }

  getItem(k: string): string | null {
    return this.data.get(k) ?? null;
  }

  setItem(k: string, v: string): void {
    this.data.set(k, String(v));
  }

  removeItem(k: string): void {
    this.data.delete(k);
  }

  clear(): void {
    this.data.clear();
  }
}

const g = globalThis as unknown as { localStorage?: Storage };
if (!g.localStorage) g.localStorage = new MemoryStorage() as unknown as Storage;
