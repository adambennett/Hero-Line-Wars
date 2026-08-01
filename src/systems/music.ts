/**
 * Main-menu music — shuffle bag (no repeats until all tracks played).
 */

import { loadSettings } from "../ui/settings";

export type MenuTrackId = "forsaken" | "foreboding" | "forgiven";

const MENU_TRACKS: { id: MenuTrackId; src: string; title: string }[] = [
  { id: "forsaken", src: "./audio/menu/Forsaken.mp3", title: "Forsaken" },
  { id: "foreboding", src: "./audio/menu/Foreboding.mp3", title: "Foreboding" },
  { id: "forgiven", src: "./audio/menu/Forgiven.mp3", title: "Forgiven" },
];

let el: HTMLAudioElement | null = null;
let bag: MenuTrackId[] = [];
let lastId: MenuTrackId | null = null;
let active = false;
let wantPlaying = false;

function shuffleInPlace<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const tmp = arr[i]!;
    arr[i] = arr[j]!;
    arr[j] = tmp;
  }
}

function refillBag(): void {
  bag = MENU_TRACKS.map((t) => t.id);
  shuffleInPlace(bag);
  // Avoid immediate repeat of the track that just finished the previous cycle
  if (lastId && bag.length > 1 && bag[0] === lastId) {
    const swap = 1 + ((Math.random() * (bag.length - 1)) | 0);
    const tmp = bag[0]!;
    bag[0] = bag[swap]!;
    bag[swap] = tmp;
  }
}

function nextTrackId(): MenuTrackId {
  if (bag.length === 0) refillBag();
  const id = bag.shift()!;
  lastId = id;
  return id;
}

function ensureEl(): HTMLAudioElement {
  if (!el) {
    el = new Audio();
    el.preload = "auto";
    el.addEventListener("ended", () => {
      if (wantPlaying) void playNext();
    });
    el.addEventListener("error", () => {
      // Skip broken file and continue shuffle
      if (wantPlaying) void playNext();
    });
  }
  return el;
}

function musicGain(): number {
  const s = loadSettings();
  const master = Math.max(0, Math.min(1, s.masterVolume));
  const music = Math.max(0, Math.min(1, s.musicVolume ?? 0.7));
  return master * music;
}

async function playNext(): Promise<void> {
  if (!wantPlaying) return;
  const s = loadSettings();
  if (!s.menuMusicEnabled) {
    stopMenuMusic();
    return;
  }
  const id = nextTrackId();
  const track = MENU_TRACKS.find((t) => t.id === id)!;
  const audio = ensureEl();
  audio.src = track.src;
  audio.volume = musicGain();
  active = true;
  try {
    await audio.play();
  } catch {
    // Autoplay blocked until a gesture — put track back and retry later
    bag.unshift(id);
    lastId = null;
    active = false;
  }
}

/** Start (or resume) menu music if enabled. Safe to call often. */
export function startMenuMusic(): void {
  const s = loadSettings();
  if (!s.menuMusicEnabled) {
    stopMenuMusic();
    return;
  }
  wantPlaying = true;
  const audio = ensureEl();
  if (active && !audio.paused) {
    applyMusicVolume();
    return;
  }
  void playNext();
}

export function stopMenuMusic(): void {
  wantPlaying = false;
  active = false;
  if (el) {
    el.pause();
    el.removeAttribute("src");
    el.load();
  }
}

export function applyMusicVolume(): void {
  if (el) el.volume = musicGain();
}

/** Re-read settings — stop if disabled, start if enabled and wanted. */
export function syncMenuMusicFromSettings(menusVisible: boolean): void {
  const s = loadSettings();
  applyMusicVolume();
  if (!s.menuMusicEnabled || !menusVisible) {
    stopMenuMusic();
    return;
  }
  startMenuMusic();
}

export function menuMusicTrackTitle(): string | null {
  if (!lastId || !active) return null;
  return MENU_TRACKS.find((t) => t.id === lastId)?.title ?? null;
}
