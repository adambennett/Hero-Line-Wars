/** Procedural Web Audio SFX — no external clips. */

import { loadSettings } from "../ui/settings";

type SfxKind =
  | "hit"
  | "miss"
  | "cast"
  | "buy"
  | "levelup"
  | "boss_slam"
  | "send"
  | "ui";

let ctx: AudioContext | null = null;
/** When false, combat/lane SFX are suppressed (off-screen lane sim). UI always plays. */
let laneSfxEnabled = true;

/** Gate lane combat audio — call around dual-lane simulation. */
export function setLaneSfxEnabled(on: boolean): void {
  laneSfxEnabled = on;
}

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function masterGain(): number {
  return Math.max(0, Math.min(1, loadSettings().masterVolume)) * 0.35;
}

function tone(
  ac: AudioContext,
  freq: number,
  dur: number,
  type: OscillatorType,
  gain: number,
  slideTo?: number,
): void {
  const t0 = ac.currentTime;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, gain), t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g);
  g.connect(ac.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noiseBurst(ac: AudioContext, dur: number, gain: number, lowpass = 1200): void {
  const t0 = ac.currentTime;
  const len = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const src = ac.createBufferSource();
  src.buffer = buf;
  const filter = ac.createBiquadFilter();
  filter.type = "lowpass";
  filter.frequency.value = lowpass;
  const g = ac.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter);
  filter.connect(g);
  g.connect(ac.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

export function playSfx(kind: SfxKind): void {
  // Menu / chrome clicks always audible; lane combat respects the view gate
  if (kind !== "ui" && !laneSfxEnabled) return;
  const ac = audio();
  if (!ac) return;
  const m = masterGain();
  if (m <= 0.001) return;

  switch (kind) {
    case "hit":
      tone(ac, 420, 0.06, "square", m * 0.45, 180);
      break;
    case "miss":
      tone(ac, 180, 0.05, "triangle", m * 0.2, 90);
      break;
    case "cast":
      tone(ac, 520, 0.1, "sawtooth", m * 0.35, 880);
      tone(ac, 260, 0.12, "sine", m * 0.25, 400);
      break;
    case "buy":
      tone(ac, 660, 0.08, "sine", m * 0.4);
      tone(ac, 990, 0.1, "sine", m * 0.28);
      break;
    case "levelup":
      tone(ac, 440, 0.1, "sine", m * 0.35);
      tone(ac, 660, 0.12, "sine", m * 0.32);
      tone(ac, 880, 0.16, "sine", m * 0.3);
      break;
    case "boss_slam":
      noiseBurst(ac, 0.28, m * 0.7, 280);
      tone(ac, 70, 0.35, "sine", m * 0.85, 40);
      tone(ac, 45, 0.4, "triangle", m * 0.5, 30);
      break;
    case "send":
      tone(ac, 300, 0.08, "square", m * 0.3, 200);
      break;
    case "ui":
      tone(ac, 500, 0.04, "sine", m * 0.22);
      break;
  }
}

/** Call once on first user gesture so AudioContext can start. */
export function unlockAudio(): void {
  audio();
}
