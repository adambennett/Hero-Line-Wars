import { describe, expect, it } from "vitest";
import { createState } from "../src/game/state";
import {
  hasDraftPending,
  openOrQueueDraft,
  pendingDraftCount,
  syncDraftFlags,
} from "../src/systems/drafts";

describe("draft queue", () => {
  it("opens a draft immediately when the slot is free", () => {
    const s = createState("ranger");
    openOrQueueDraft(s, { kind: "relic", choices: ["lucky_coin"] });
    expect(s.relicDraft).toEqual(["lucky_coin"]);
    expect(s.draftKind).toBe("relic");
    expect(s.pausedForDraft).toBe(true);
    expect(pendingDraftCount(s)).toBe(0);
  });

  it("queues a second draft of the same kind instead of replacing it", () => {
    const s = createState("ranger");
    openOrQueueDraft(s, { kind: "relic", choices: ["lucky_coin"] });
    openOrQueueDraft(s, { kind: "relic", choices: ["stone_skin"] });
    expect(s.relicDraft).toEqual(["lucky_coin"]);
    expect(s.draftQueue).toHaveLength(1);
    expect(pendingDraftCount(s)).toBe(1);

    // Resolving the visible one promotes the queued reward.
    s.relicDraft = null;
    syncDraftFlags(s);
    expect(s.relicDraft).toEqual(["stone_skin"]);
    expect(s.draftQueue).toHaveLength(0);
  });

  it("keeps different draft kinds open side by side, highest precedence first", () => {
    const s = createState("ranger");
    openOrQueueDraft(s, { kind: "relic", choices: ["lucky_coin"] });
    openOrQueueDraft(s, {
      kind: "chest",
      options: [{ kind: "gold", amount: 50, label: "Gold", blurb: "50 gold" }],
    });
    expect(s.draftKind).toBe("chest");
    expect(s.relicDraft).not.toBeNull();
    expect(pendingDraftCount(s)).toBe(1);
  });

  it("clears pausedForDraft only when every reward is resolved", () => {
    const s = createState("ranger");
    openOrQueueDraft(s, { kind: "level", choices: ["might"] });
    openOrQueueDraft(s, { kind: "level", choices: ["vitality"] });
    s.levelDraft = null;
    syncDraftFlags(s);
    expect(s.pausedForDraft).toBe(true);
    s.levelDraft = null;
    syncDraftFlags(s);
    expect(s.pausedForDraft).toBe(false);
    expect(s.draftKind).toBeNull();
  });

  it("reports open-or-queued drafts so nothing is offered twice", () => {
    const s = createState("ranger");
    expect(hasDraftPending(s, "level")).toBe(false);
    openOrQueueDraft(s, { kind: "level", choices: ["might"] });
    expect(hasDraftPending(s, "level")).toBe(true);
  });
});
