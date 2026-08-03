import { describe, expect, it } from "vitest";
import { parsePatchNotes, patchNotesBodyHtml, PATCH_NOTE_PAGES } from "../src/data/patchNotes";

const SAMPLE = `# Hero Line Wars — Patch Notes

## 2026-08-03 · v0.0.4

### Balance — Cloud
- Faster default move speed (**238 → 272**) and more max HP.
- Second
  line continuation.

### Chests
- Unique reward families.

---

## 2026-08-01 · v0.0.3

### Fixes
- Something fixed.
`;

describe("parsePatchNotes", () => {
  it("splits versions newest-first and strips hr separators", () => {
    const pages = parsePatchNotes(SAMPLE);
    expect(pages).toHaveLength(2);
    expect(pages[0]).toMatchObject({
      date: "2026-08-03",
      version: "v0.0.4",
      heading: "2026-08-03 · v0.0.4",
    });
    expect(pages[1]!.version).toBe("v0.0.3");
    expect(pages[0]!.bodyMd).toContain("Balance — Cloud");
    expect(pages[0]!.bodyMd).not.toContain("---");
  });

  it("loads real PATCHNOTES.md with at least the current app version", () => {
    expect(PATCH_NOTE_PAGES.length).toBeGreaterThanOrEqual(1);
    expect(PATCH_NOTE_PAGES[0]!.version).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(PATCH_NOTE_PAGES[0]!.heading).toContain(PATCH_NOTE_PAGES[0]!.version);
  });
});

describe("patchNotesBodyHtml", () => {
  it("renders headings, bullets, bold, and continuations safely", () => {
    const html = patchNotesBodyHtml(parsePatchNotes(SAMPLE)[0]!.bodyMd);
    expect(html).toContain('<h3 class="patch-section">Balance — Cloud</h3>');
    expect(html).toContain("<strong>238 → 272</strong>");
    expect(html).toContain("Second line continuation");
    expect(html).not.toContain("<script");
    expect(html).toContain('<ul class="patch-list">');
  });
});
