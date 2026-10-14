"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { PublicScheduleEvent } from "@/lib/domain/schedule-types";
import type { TeaserStateSnapshot } from "@/lib/schedules/teaser-state";
import { hypeCalm, hypeChannels, hypeCssVars, hypeEmerge, hypeFinale, hypeIntensity, hypeMotionCssVars, hypeMotionFrame, STATIC_MOTION_FRAME, quantizeStaticIntensity } from "@/lib/ui/hype-curve";
import { applyDatabaseClock, clockIsSynced, subscribeClock, synchronizeClock, syncedNow } from "@/lib/ui/synced-clock";
import { reconcileTeaserReveal } from "@/lib/schedules/teaser-reconcile";
import { planPremiere, premiereKey, presentationTime, PREMIERE_TIMING, idleFrame, type PremiereCandidate, type PremiereFrame } from "./plan";
import { createFlashBudget } from "./flash-budget";

export type PremiereFixture = { startedAt: number; offsets: number[]; scenario?: string; rehearsal?: boolean };
type Options = {
  slug: string; events: PublicScheduleEvent[]; month: string; enabled: boolean;
  root: RefObject<HTMLDivElement | null>; blocked: RefObject<boolean>;
  fixture?: PremiereFixture;
  onEvents: (events: PublicScheduleEvent[], gone: string[]) => void;
};
export const fixtureId = (index: number) => `00000000-0000-4000-8000-${String(index + 1).padStart(12, "0")}`;

function visible(el: Element | null): boolean {
  if (!(el instanceof HTMLElement) || el.closest("[inert]")) return false;
  const r = el.getBoundingClientRect();
  const style = getComputedStyle(el);
  return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth && style.visibility !== "hidden" && style.opacity !== "0";
}

export function useTeaserPremiere(options: Options) {
  const latest = useRef(options); latest.current = options;
  const records = useRef(new Map<string, PremiereCandidate>());
  const skipped = useRef(new Set<string>());
  const watched = useRef(new Set<string>());
  const validated = useRef(new Set<string>());
  const fired = useRef(new Set<string>());
  const lastNow = useRef<number | null>(null);
  const started = useRef(0);
  const cooldown = useRef(0);
  const returnUntil = useRef(0);
  const stamp = useRef(0);
  const budget = useRef(createFlashBudget());
  const [frame, setFrame] = useState<PremiereFrame>(idleFrame);
  const frameRef = useRef(frame); frameRef.current = frame;
  const [bang, setBang] = useState(0);
  const [justRevealed, setJustRevealed] = useState<Set<string>>(new Set());
  const [reduced, setReduced] = useState(false);
  const [hint, setHint] = useState(false);
  const wake = useRef<() => void>(() => {});
  const close = useCallback(() => {
    for (const item of frameRef.current.items) skipped.current.add(premiereKey(item));
    cooldown.current = syncedNow() + PREMIERE_TIMING.rest;
    started.current = 0;
    returnUntil.current = syncedNow() + (document.documentElement.hasAttribute("data-reduce-motion") ? 0 : 800);
    setFrame(previous => previous.phase === "idle" ? previous : previous.focused ? { ...previous, phase: "return", focused: false } : idleFrame());
  }, []);
  const sourceKey = options.events.filter(event => event.teaser).map(event => `${event.id}:${event.teaserRevealAt}`).join("|");
  useEffect(() => {
    for (const event of latest.current.events) {
      if (!event.teaser || !event.teaserRevealAt || records.current.has(event.id)) continue;
      records.current.set(event.id, { id: event.id, dateKey: event.startsAt.slice(0, 10), revealAt: event.teaserRevealAt, state: "masked", event });
    }
    wake.current();
  }, [sourceKey]);

  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    let busy = false;
    let failures = 0;
    const abort = new AbortController();
    const fixture = latest.current.fixture;
    records.current.clear(); watched.current.clear(); validated.current.clear(); fired.current.clear(); skipped.current.clear(); stamp.current = 0;
    if (fixture?.rehearsal) {
      started.current = 0; cooldown.current = 0; returnUntil.current = 0;
      setFrame(idleFrame());
    }
    if (!fixture?.rehearsal) {
      for (const event of latest.current.events) if (event.teaser && event.teaserRevealAt) {
        const entry: PremiereCandidate = { id: event.id, dateKey: event.startsAt.slice(0, 10), revealAt: event.teaserRevealAt, state: "masked", event };
        records.current.set(event.id, entry);
      }
    }
    const read = async (id?: string): Promise<TeaserStateSnapshot> => {
      if (fixture?.rehearsal) {
        const now = syncedNow();
        return { ok: true, schemaVersion: 1, sampledAtDbMs: now, entries: fixture.offsets.map((offset, i) => {
          const at = fixture.startedAt + offset * 1000;
          const masked = at > now;
          const event: PublicScheduleEvent = { id: fixtureId(i), startsAt: `${latest.current.month}-18T00:00:00+09:00`, isAllDay: true, isTentative: false, status: "scheduled", visibilityScope: "public", category: "stream", sortOrder: i, tagIds: [], primaryTagIds: [], publicTitle: masked ? "" : `리허설 공개 일정 ${i + 1}`, teaser: masked || undefined, teaserRevealAt: masked ? new Date(at).toISOString() : undefined };
          return { id: event.id, dateKey: event.startsAt.slice(0, 10), revealAt: new Date(at).toISOString(), state: masked ? "masked" : "released", event };
        }) };
      }
      const url = fixture ? `/api/visual-fixture/premiere?startedAt=${fixture.startedAt}&offsets=${fixture.offsets.join(",")}&scenario=${fixture.scenario ?? "normal"}${id ? `&eventId=${id}` : ""}` :
        `/api/public/${encodeURIComponent(latest.current.slug)}/teaser-state${id ? `/${encodeURIComponent(id)}` : ""}`;
      const response = await fetch(url, { credentials: "omit", signal: AbortSignal.any([abort.signal, AbortSignal.timeout(8000)]) });
      if (!response.ok) throw new Error("State unavailable");
      return response.json();
    };
    const apply = (snapshot: TeaserStateSnapshot, asked?: string) => {
      if (!alive || !snapshot.ok || snapshot.schemaVersion !== 1 || !Number.isFinite(snapshot.sampledAtDbMs) || !Array.isArray(snapshot.entries) || snapshot.sampledAtDbMs < stamp.current) return;
      stamp.current = snapshot.sampledAtDbMs;
      applyDatabaseClock(snapshot.clockSkewMs, snapshot.clockUncertaintyMs);
      const updates: PublicScheduleEvent[] = [];
      const newReveals: string[] = [];
      for (const entry of snapshot.entries) {
        const prior = records.current.get(entry.id);
        if (entry.state === "released" && !prior) continue; // Already-public arrivals never celebrate.
        const key = premiereKey(prior ?? entry);
        const observing = !document.hidden && !latest.current.blocked.current && entry.dateKey.startsWith(latest.current.month) &&
          (visible(latest.current.root.current?.querySelector(`[data-eventid="${entry.id}"]`) ?? null) || visible(document.querySelector(`[data-pm-event="${entry.id}"]`)));
        const confirmedAt = entry.state === "released" ? (prior?.state === "released" ? prior.confirmedAt : watched.current.has(key) && observing ? syncedNow() : undefined) : undefined;
        const next: PremiereCandidate = { id: entry.id, dateKey: entry.dateKey, revealAt: entry.revealAt ?? prior?.revealAt ?? null, state: entry.state, event: entry.event, confirmedAt };
        records.current.set(entry.id, next);
        if (entry.state === "masked") {
          const nextKey = premiereKey(next);
          const rescheduled = prior && (prior.state === "released" || prior.revealAt !== next.revealAt);
          if (rescheduled) {
            // Only an authoritative transition starts a new observation cycle;
            // A→B→A must not inherit A's old effect/skip state.
            validated.current.delete(nextKey); watched.current.delete(nextKey);
            fired.current.delete(nextKey); skipped.current.delete(nextKey);
          }
          // Decide late arrival only after calibration, never from the PC clock
          // used by the initial render (which can be minutes ahead).
          if (!rescheduled && !validated.current.has(nextKey) && clockIsSynced() && Date.parse(next.revealAt ?? "") - syncedNow() < 3000) skipped.current.add(nextKey);
          validated.current.add(nextKey);
        }
        updates.push(entry.event);
        if (entry.state === "released" && prior?.state === "masked" && watched.current.has(key) && observing) {
          newReveals.push(entry.id);
          if (!fired.current.has(key)) {
            fired.current.add(key);
            if (latest.current.enabled && !skipped.current.has(key) && !document.documentElement.hasAttribute("data-reduce-motion") && budget.current.request(syncedNow())) setBang(value => value + 1);
          }
        }
      }
      const gone = reconcileTeaserReveal(asked ? [asked] : [], { ok: snapshot.ok, events: snapshot.entries.map(entry => entry.event) }).goneIds;
      for (const id of gone) records.current.delete(id);
      if (!fixture?.rehearsal) latest.current.onEvents(updates, gone);
      if (newReveals.length) setJustRevealed(previous => new Set([...previous, ...newReveals]));
    };
    const poll = async () => {
      clearTimeout(timer);
      if (busy || !alive || document.hidden || !navigator.onLine) return;
      busy = true;
      try {
        const snapshot = await read();
        if (!snapshot.ok) throw new Error("State unavailable");
        // An instant release leaves discovery; a released card can also be deleted
        // during the reading beat. Confirm both through the canonical shared key.
        const missing = [...records.current.values()].filter(entry => !snapshot.entries.some(item => item.id === entry.id)).map(entry => entry.id);
        apply(snapshot);
        for (const id of missing.slice(0, 32)) apply(await read(id), id);
        failures = 0;
      } catch { failures++; } finally {
        busy = false;
        if (alive) {
          const near = [...records.current.values()].some(entry => entry.state === "masked" && Date.parse(entry.revealAt ?? "") - syncedNow() < 300_000);
          timer = setTimeout(poll, failures ? Math.min(15_000, 1000 * 2 ** Math.min(failures, 4)) : near || fixture ? 1000 : 15_000);
        }
      }
    };
    const resume = () => {
      watched.current.clear(); lastNow.current = null;
      if (document.hidden || !navigator.onLine) { clearTimeout(timer); return; }
      void synchronizeClock().then(poll);
    };
    wake.current = () => { if (!busy) void poll(); };
    document.addEventListener("visibilitychange", resume);
    window.addEventListener("online", resume);
    window.addEventListener("offline", resume);
    window.addEventListener("pageshow", resume);
    window.addEventListener("vic:clock-correction", () => { watched.current.clear(); lastNow.current = null; }, { signal: abort.signal });
    void synchronizeClock().then(poll);
    return () => { alive = false; abort.abort(); clearTimeout(timer); document.removeEventListener("visibilitychange", resume); window.removeEventListener("online", resume); window.removeEventListener("offline", resume); window.removeEventListener("pageshow", resume); wake.current = () => {}; };
  }, [options.slug, options.fixture]);

  useEffect(() => subscribeClock(() => {
    if (document.hidden) return;
    const now = syncedNow();
    const opts = latest.current;
    const root = opts.root.current;
    const staticOnly = document.documentElement.hasAttribute("data-reduce-motion");
    setReduced(value => value === staticOnly ? value : staticOnly);
    const all = [...records.current.values()];
    setJustRevealed(previous => {
      const current = new Set([...previous].filter(id => { const at = records.current.get(id)?.confirmedAt; return at !== undefined && now - at < 2400; }));
      return current.size === previous.size ? previous : current;
    });
    for (const item of all) {
      const key = premiereKey(item);
      const target = presentationTime(item);
      const card = root?.querySelector(`[data-eventid="${item.id}"]`);
      const screen = document.querySelector(`[data-pm-event="${item.id}"]`);
      const observing = !opts.blocked.current && item.dateKey.startsWith(opts.month) && (visible(card ?? null) || visible(screen));
      if (target > now && target - now <= 180_000 && validated.current.has(key) && observing) watched.current.add(key);
      if (lastNow.current !== null && lastNow.current < target && now >= target && observing && watched.current.has(key) && !fired.current.has(key)) {
        fired.current.add(key);
        if (opts.enabled && !staticOnly && !skipped.current.has(key) && budget.current.request(now)) setBang(value => value + 1);
      }
    }
    lastNow.current = now;
    if (frameRef.current.phase === "return") {
      if (now >= returnUntil.current || staticOnly) setFrame(idleFrame());
      return;
    }
    const targets = [...(root?.querySelectorAll<HTMLElement>("[data-teaser-at]") ?? []), ...document.querySelectorAll<HTMLElement>(".pm-stage[data-teaser-at]")];
    for (const host of targets) {
      const remain = Date.parse(host.dataset.teaserAt ?? "") - now;
      if (!Number.isFinite(remain)) continue;
      if (remain > 66_000 && !host.classList.contains("hype-live")) continue;
      const raw = hypeIntensity(remain), calm = hypeCalm(remain);
      const vars = { ...hypeCssVars(hypeChannels(staticOnly ? quantizeStaticIntensity(raw) : raw, calm)), ...hypeMotionCssVars(staticOnly ? STATIC_MOTION_FRAME : hypeMotionFrame(remain, raw)), "--hy-emerge": String(hypeEmerge(remain)), "--hy-final": String(hypeFinale(remain)) };
      for (const [key, value] of Object.entries(vars)) host.style.setProperty(key, value);
      host.classList.toggle("hype-live", raw > 0 && !staticOnly);
    }
    const next = planPremiere(all.filter(entry => validated.current.has(premiereKey(entry)) || entry.confirmedAt !== undefined), now, opts.month, skipped.current);
    setHint(opts.enabled && all.some(entry => entry.state === "masked" && !entry.dateKey.startsWith(opts.month) && Date.parse(entry.revealAt ?? "") - now <= 180_000 && Date.parse(entry.revealAt ?? "") > now));
    if (!opts.enabled || !clockIsSynced() || opts.blocked.current || staticOnly || cooldown.current > now) {
      if (frameRef.current.phase !== "idle") close();
      return;
    }
    if (next.focused && !started.current) started.current = now;
    if (started.current && now - started.current >= PREMIERE_TIMING.limit) { close(); return; }
    if (next.phase === "idle" && frameRef.current.phase !== "idle") { close(); return; }
    // Countdown subscribers update their own text; the calendar parent changes
    // only for semantic phases, targets and confirmed data, never at visual 10Hz.
    const signature = `${next.phase}:${next.target}:${next.items.map(item => `${premiereKey(item)}:${item.state}:${item.event.publicTitle}`).join("|")}`;
    const previous = frameRef.current;
    const oldSignature = `${previous.phase}:${previous.target}:${previous.items.map(item => `${premiereKey(item)}:${item.state}:${item.event.publicTitle}`).join("|")}`;
    if (signature !== oldSignature) setFrame(next);
  }), [close]);

  return { frame, bang, justRevealed, reduced, hint, close, refresh: () => wake.current() };
}
