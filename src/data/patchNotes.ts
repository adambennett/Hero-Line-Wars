/**
 * In-game patch notes — parsed from the project-root PATCHNOTES.md so the
 * markdown file stays the single source of truth.
 */
import raw from "../../PATCHNOTES.md?raw";

export type PatchNotePage = {
  /** e.g. `2026-08-03` */
  date: string;
  /** e.g. `v0.0.4` */
  version: string;
  /** Full heading: `2026-08-03 · v0.0.4` */
  heading: string;
  /** Markdown body under the version heading (no leading `##` line). */
  bodyMd: string;
};

const HEADING_RE = /^(\d{4}-\d{2}-\d{2})\s*·\s*(v[\d.]+)\s*$/;

/** Split PATCHNOTES.md into version pages (newest first as authored). */
export function parsePatchNotes(md: string): PatchNotePage[] {
  const pages: PatchNotePage[] = [];
  const parts = md.split(/^## /m);
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed || trimmed.startsWith("# ")) continue;
    const nl = trimmed.indexOf("\n");
    const headingLine = (nl < 0 ? trimmed : trimmed.slice(0, nl)).trim();
    const bodyRaw = nl < 0 ? "" : trimmed.slice(nl + 1);
    const m = HEADING_RE.exec(headingLine);
    if (!m) continue;
    const bodyMd = bodyRaw
      .replace(/^\s*---\s*$/gm, "")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
    pages.push({
      date: m[1]!,
      version: m[2]!,
      heading: headingLine,
      bodyMd,
    });
  }
  return pages;
}

export const PATCH_NOTE_PAGES: PatchNotePage[] = parsePatchNotes(raw);

function escapeHtml(s: string): string {
  return s
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatInline(s: string): string {
  return escapeHtml(s).replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
}

/**
 * Minimal markdown → HTML for patch note bodies (### headings + bullet lists).
 * Safe for injection into menu HTML (escaped text + allowed tags only).
 */
export function patchNotesBodyHtml(bodyMd: string): string {
  const lines = bodyMd.split(/\r?\n/);
  const out: string[] = [];
  let inList = false;

  const closeList = () => {
    if (inList) {
      out.push("</ul>");
      inList = false;
    }
  };

  const isStructural = (line: string) =>
    /^###\s+/.test(line) || /^##\s+/.test(line) || /^-\s+/.test(line);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!;
    const heading = /^###\s+(.+)$/.exec(line);
    if (heading) {
      closeList();
      out.push(`<h3 class="patch-section">${formatInline(heading[1]!.trim())}</h3>`);
      i += 1;
      continue;
    }

    const bullet = /^-\s+(.*)$/.exec(line);
    if (bullet) {
      if (!inList) {
        out.push('<ul class="patch-list">');
        inList = true;
      }
      let text = bullet[1]!;
      i += 1;
      while (i < lines.length) {
        const cont = lines[i]!;
        if (!cont.trim() || isStructural(cont)) break;
        text += ` ${cont.trim()}`;
        i += 1;
      }
      out.push(`<li>${formatInline(text.trim())}</li>`);
      continue;
    }

    if (!line.trim()) {
      closeList();
      i += 1;
      continue;
    }

    closeList();
    out.push(`<p class="patch-p">${formatInline(line.trim())}</p>`);
    i += 1;
  }
  closeList();
  return out.join("\n");
}
