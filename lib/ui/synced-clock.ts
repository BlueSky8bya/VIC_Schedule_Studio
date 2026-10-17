"use client";

import { foregroundOnline } from "./foreground-poll";

const listeners = new Set<() => void>();
let epoch = 0;
let mono = 0;
let timer: ReturnType<typeof setTimeout> | undefined;
let observer: MutationObserver | undefined;
let syncing: Promise<void> | null = null;
let calibrated = false;
let calibratedAt = -Infinity;
let failedAt = -Infinity;
// Cache the valid calibration locally, never an HTTP clock response. Monotonic
// age survives OS clock changes; resume discovery need not wait for three RTTs.
const CALIBRATION_TTL_MS = 60_000;
let dbOffset = 0;
let slew = 0;
let slewBegan = 0;

function correctClock(next: number): void {
  const current = syncedNow();
  const difference = next - current;
  epoch = current; mono = performance.now(); slew = 0;
  if (Math.abs(difference) <= 250) { slew = difference; slewBegan = mono; }
  else { epoch = next; if (Math.abs(difference) > 1000) window.dispatchEvent(new Event("vic:clock-correction")); }
}

export function applyDatabaseClock(offset: number | undefined, uncertainty: number | undefined): void {
  if (offset === undefined || uncertainty === undefined || !Number.isFinite(offset) || !Number.isFinite(uncertainty) || uncertainty < 0 || Math.abs(offset) > 600_000 || uncertainty > 500) return;
  const difference = offset - dbOffset;
  if (Math.abs(difference) < 5) return;
  const current = syncedNow();
  const residual = epoch + performance.now() - mono + slew - current;
  dbOffset = offset;
  correctClock(current + difference + residual);
}

// Monotonic progression; this clock never authorizes release.
export function syncedNow(): number {
  if (!epoch) { epoch = Date.now(); mono = performance.now(); }
  const now = performance.now();
  const t = Math.min(1, Math.max(0, (now - slewBegan) / 1000));
  const smooth = t * t * t * (t * (t * 6 - 15) + 10);
  return epoch + now - mono + slew * smooth;
}
export function clockIsSynced(): boolean { return calibrated; }
function emit() { for (const listener of listeners) listener(); }
function tick() {
  clearTimeout(timer);
  if (document.hidden || !listeners.size) return;
  emit();
  timer = setTimeout(tick, document.documentElement.hasAttribute("data-reduce-motion") ? 1000 : 100);
}
export function subscribeClock(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    document.addEventListener("visibilitychange", tick);
    observer = new MutationObserver(tick);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-motion"] });
    tick();
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) {
      clearTimeout(timer);
      observer?.disconnect();
      document.removeEventListener("visibilitychange", tick);
    }
  };
}
export function synchronizeClock(): Promise<void> {
  if (!foregroundOnline() || (calibrated && performance.now() - calibratedAt < CALIBRATION_TTL_MS)) return Promise.resolve();
  if (performance.now() - failedAt < 5000) return Promise.resolve();
  if (syncing) return syncing;
  const controller = new AbortController();
  const pause = () => { if (!foregroundOnline()) controller.abort(); };
  if (typeof document !== "undefined") document.addEventListener("visibilitychange", pause);
  if (typeof window !== "undefined") window.addEventListener?.("offline", pause);
  syncing = (async () => {
    const samples: { rtt: number; server: number; middle: number }[] = [];
    for (let i = 0; i < 3; i++) {
      if (!foregroundOnline() || controller.signal.aborted) return;
      const start = performance.now();
      const response = await fetch("/api/public/clock", { cache: "no-store", credentials: "omit", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(4000)]) });
      if (!response.ok) throw new Error("Clock unavailable");
      const body = await response.json() as { serverMs?: number };
      const end = performance.now();
      if (!Number.isFinite(body.serverMs)) throw new Error("Invalid clock");
      samples.push({ rtt: end - start, server: body.serverMs!, middle: (start + end) / 2 });
    }
    if (!foregroundOnline() || controller.signal.aborted) return;
    const best = samples.sort((a, b) => a.rtt - b.rtt)[0];
    const next = best.server + dbOffset + performance.now() - best.middle;
    correctClock(next);
    calibrated = true;
    calibratedAt = performance.now();
    emit();
  })().catch(() => {
    if (!controller.signal.aborted && foregroundOnline()) failedAt = performance.now();
    /* Keep the last sample; never grant release from a clock. */
  }).finally(() => {
    syncing = null;
    if (typeof document !== "undefined") document.removeEventListener("visibilitychange", pause);
    if (typeof window !== "undefined") window.removeEventListener?.("offline", pause);
  });
  return syncing;
}
