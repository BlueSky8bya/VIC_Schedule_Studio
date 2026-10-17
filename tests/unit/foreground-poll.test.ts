import { afterEach, expect, it, vi } from "vitest";
import { startForegroundPoll } from "@/lib/ui/foreground-poll";

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

function environment(hidden = false) {
  const doc = Object.assign(new EventTarget(), { hidden });
  const win = new EventTarget();
  const nav = { onLine: true };
  vi.stubGlobal("document", doc); vi.stubGlobal("window", win); vi.stubGlobal("navigator", nav);
  return { doc, win, nav };
}

it("does no hidden/offline work and resumes one chain after rapid visibility changes", async () => {
  vi.useFakeTimers();
  const { doc, win, nav } = environment(true);
  const pending: (() => void)[] = [];
  const signals: AbortSignal[] = [];
  let active = 0, maxActive = 0;
  const run = vi.fn(async (signal: AbortSignal) => {
    signals.push(signal); active++; maxActive = Math.max(maxActive, active);
    await new Promise<void>(resolve => pending.push(resolve)); active--;
  });
  const poll = startForegroundPoll({ run, delay: () => 1000 });
  await vi.advanceTimersByTimeAsync(60_000);
  expect(run).not.toHaveBeenCalled();
  doc.hidden = false; doc.dispatchEvent(new Event("visibilitychange"));
  expect(run).toHaveBeenCalledTimes(1);
  doc.hidden = true; doc.dispatchEvent(new Event("visibilitychange"));
  expect(signals[0].aborted).toBe(true);
  doc.hidden = false; doc.dispatchEvent(new Event("visibilitychange"));
  win.dispatchEvent(new Event("pageshow"));
  expect(run).toHaveBeenCalledTimes(1);
  pending.shift()!(); await vi.advanceTimersByTimeAsync(0);
  expect(run).toHaveBeenCalledTimes(2);
  expect(maxActive).toBe(1);
  pending.shift()!(); await vi.advanceTimersByTimeAsync(0);
  nav.onLine = false; win.dispatchEvent(new Event("offline"));
  await vi.advanceTimersByTimeAsync(60_000);
  expect(run).toHaveBeenCalledTimes(2);
  nav.onLine = true; win.dispatchEvent(new Event("online"));
  expect(run).toHaveBeenCalledTimes(3);
  poll.stop(); expect(signals[2].aborted).toBe(true);
  pending.shift()!(); await vi.advanceTimersByTimeAsync(60_000);
  win.dispatchEvent(new Event("pageshow"));
  expect(run).toHaveBeenCalledTimes(3);
  expect(vi.getTimerCount()).toBe(0);
});

it("retains dynamic 15s discovery and 1s near-release cadence, without overlapping slow work", async () => {
  vi.useFakeTimers(); environment();
  let near = false;
  const run = vi.fn(async () => {});
  const poll = startForegroundPoll({ run, delay: () => near ? 1000 : 15_000 });
  await vi.advanceTimersByTimeAsync(14_999);
  expect(run).toHaveBeenCalledTimes(1);
  near = true;
  await vi.advanceTimersByTimeAsync(1);
  expect(run).toHaveBeenCalledTimes(2);
  await vi.advanceTimersByTimeAsync(1000);
  expect(run).toHaveBeenCalledTimes(3);
  poll.stop();
});
