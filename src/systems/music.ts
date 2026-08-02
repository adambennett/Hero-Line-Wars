/**
 * Main-menu music — shuffle bag (no repeats until all tracks played).
 *
 * Browsers block unmuted autoplay until a user gesture. We:
 *  1) try unmuted play immediately (works in Electron with autoplay policy,
 *     and after any prior gesture on the origin),
 *  2) keep a window-level gesture hook armed whenever music is wanted but
 *     not actually audible, so the first click/key anywhere on the title
 *     screen starts playback — not only navigating into a submenu.
 */

import { loadSettings } from "../ui/settings";
import { unlockAudio } from "./audio";

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
let gestureHookArmed = false;
let starting = false;

const GESTURE_EVENTS = ["pointerdown", "pointerup", "click", "keydown", "touchstart"] as const;

function isAudible(): boolean {
  return !!el && active && !el.paused && !el.muted && el.volume > 0;
}

function onUserGesture(): void {
  if (!wantPlaying) return;
  unlockAudio();
  if (isAudible()) {
    disarmGestureHook();
    return;
  }
  if (el && active && !el.paused && el.muted) {
    el.muted = false;
    el.volume = musicGain();
    if (isAudible()) disarmGestureHook();
    return;
  }
  void playNext();
}

function armGestureHook(): void {
  if (gestureHookArmed) return;
  gestureHookArmed = true;
  for (const type of GESTURE_EVENTS) {
    window.addEventListener(type, onUserGesture, { capture: true, passive: true });
  }
}

function disarmGestureHook(): void {
  if (!gestureHookArmed) return;
  gestureHookArmed = false;
  for (const type of GESTURE_EVENTS) {
    window.removeEventListener(type, onUserGesture, true);
  }
}

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
  if (!wantPlaying || starting) return;
  const s = loadSettings();
  if (!s.menuMusicEnabled) {
    stopMenuMusic();
    return;
  }

  const audio = ensureEl();
  // Already playing something audible — just sync volume.
  if (active && !audio.paused && !audio.muted && audio.src) {
    audio.volume = musicGain();
    disarmGestureHook();
    return;
  }

  starting = true;
  const id = nextTrackId();
  const track = MENU_TRACKS.find((t) => t.id === id)!;
  audio.src = track.src;
  audio.volume = musicGain();
  audio.muted = false;

  try {
    await audio.play();
    active = true;
    disarmGestureHook();
  } catch {
    // Unmuted autoplay blocked. Try muted start (usually allowed), then unmute
    // on the next gesture so the first click is instant rather than a load.
    try {
      audio.muted = true;
      await audio.play();
      active = true;
      armGestureHook();
    } catch {
      bag.unshift(id);
      lastId = null;
      active = false;
      armGestureHook();
    }
  } finally {
    starting = false;
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
  unlockAudio();
  const audio = ensureEl();
  if (isAudible()) {
    applyMusicVolume();
    return;
  }
  // Keep a gesture hook armed until we are actually audible — covers the
  // title screen before any click, and retries if the first play() is blocked.
  armGestureHook();
  if (active && !audio.paused) {
    // Playing but muted (or volume 0) — wait for gesture to unmute.
    applyMusicVolume();
    return;
  }
  void playNext();
}

export function stopMenuMusic(): void {
  wantPlaying = false;
  active = false;
  starting = false;
  disarmGestureHook();
  if (el) {
    el.pause();
    el.muted = false;
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
