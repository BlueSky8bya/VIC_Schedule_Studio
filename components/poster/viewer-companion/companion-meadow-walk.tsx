"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { loadCompanionCollection, subscribeCompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { createCompanionMeadowWalk } from "@/lib/ui/viewer-companion/meadow-walk";
import { createCompanionMotion, nextCompanionPaint } from "@/lib/ui/viewer-companion/motion";
import { companionMotionClips, companionSpriteMetadata, peekDecodedCompanionSprite, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { companionPreviewDrawing, createCompanionPreviewPreparation } from "@/lib/ui/viewer-companion/wardrobe-preview";
import "./companion-meadow-walk.css";
import type { CompanionShowcaseSession } from "@/lib/ui/viewer-companion/showcase-session";
import { bindCompanionShowcaseInput } from "@/lib/ui/viewer-companion/showcase-input";
import { logActivity } from "@/lib/activity/client";

/** The normal resident is already suspended by showcase. This temporary
 * drawing borrows the same registered pixels and equipped accessory without
 * relocating its actual calendar support or borrowing any carried object. */
export function CompanionMeadowWalk({ preferences, available, reduced, night, session }: { preferences: CompanionPreferences; available: boolean; reduced: boolean; night: boolean; session: CompanionShowcaseSession }) {
  useSyncExternalStore(session.subscribe, session.snapshot, () => 0);
  if (!session.has("pet") || !available || !preferences.enabled) return null;
  return <MeadowDrawing preferences={preferences} reduced={reduced} night={night} session={session} />;
}

function MeadowDrawing({ preferences, reduced, night, session }: { preferences: CompanionPreferences; reduced: boolean; night: boolean; session: CompanionShowcaseSession }) {
  const host = useRef<HTMLDivElement>(null), body = useRef<HTMLButtonElement>(null), facing = useRef<HTMLSpanElement>(null), pose = useRef<HTMLSpanElement>(null), sprite = useRef<HTMLSpanElement>(null), canvas = useRef<HTMLCanvasElement>(null), shadow = useRef<HTMLSpanElement>(null);
  const back = useRef<HTMLSpanElement>(null), front = useRef<HTMLSpanElement>(null), gift = useRef<HTMLSpanElement>(null);
  const preferencesRef = useRef(preferences); preferencesRef.current = preferences;
  const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const refreshRef = useRef<() => void>(() => {});
  useEffect(() => {
    const element = host.current, bodyPlane = body.current, facingPlane = facing.current, posePlane = pose.current, spritePlane = sprite.current, drawing = canvas.current, shadowPlane = shadow.current;
    if (!element || !bodyPlane || !facingPlane || !posePlane || !spritePlane || !drawing || !shadowPlane || !back.current || !front.current || !gift.current) return;
    const context = drawing.getContext("2d");
    if (!context) return;
    const hosts = { back: back.current, front: front.current, gift: gift.current };
    const walker = createCompanionMeadowWalk(), preparation = createCompanionPreviewPreparation();
    const motion = createCompanionMotion({ clips: companionMotionClips, rowCount: companionSpriteMetadata.rows.length, loopRows: [0, 2, 20], maxFrameRate: 14 });
    let painter: ReturnType<typeof import("@/lib/ui/viewer-companion/accessory").createCompanionAccessoryPainter> | undefined;
    let accessory = loadCompanionCollection().gifts.equipped;
    let disposed = false, generation = 0, raf = 0, retryTimer = 0, retryCount = 0, retryRow = -1;
    let previousAt = 0, previousPaint = 0, activeTime = 0, cell = "", registered = "", requestedRow = -1, preparedRow = -1;
    const initial = session.point("pet");
    if (initial) walker.place(initial, { width: innerWidth, height: innerHeight });
    let current = walker.sample(0, { width: innerWidth, height: innerHeight }, preferencesRef.current, false);
    const ensureWardrobe = () => {
      if (!accessory || painter) return;
      void import("@/lib/ui/viewer-companion/accessory").then(module => { if (!disposed && !painter) { painter = module.createCompanionAccessoryPainter(hosts); refresh(); } }).catch(() => { /* An optional attachment chunk cannot disable the walk. */ });
    };
    const restricted = () => reducedRef.current || document.documentElement.hasAttribute("data-reduce-motion") || ["off", "soft"].includes(document.documentElement.dataset.gfx ?? "");
    const active = () => !disposed && !document.hidden && session.has("pet") && session.visible("pet");
    const animated = () => active() && session.active() && !bodyPlane.hasAttribute("data-showcase-held") && !restricted() && (document.hasFocus() || preferencesRef.current.activeWhileVisible);
    const cancel = () => { generation++; cancelAnimationFrame(raf); clearTimeout(retryTimer); retryTimer = 0; raf = 0; previousAt = 0; };
    const paint = (now: number) => {
      if (!current) return false;
      const sample = motion.sample({ row: current.row, phase: current.phase, status: current.status, x: current.x, y: current.y, now: activeTime, reduced: !animated(), travelDirection: current.status === "walk" || current.status === "jump" ? current.direction : undefined });
      const selection = selectCompanionSprite(companionSpriteMetadata.rows[sample.row][sample.column], sample.row, sample.column);
      const image = peekDecodedCompanionSprite(selection.src);
      if (!image) return false;
      const key = `${selection.src}:${selection.index}`;
      if (key !== cell) {
        const frame = companionPreviewDrawing(selection, image.naturalWidth, image.naturalHeight);
        context.clearRect(0, 0, drawing.width, drawing.height);
        context.drawImage(image, frame.sourceX, frame.sourceY, frame.sourceWidth, frame.sourceHeight, 0, 0, drawing.width, drawing.height);
        const registration = `${frame.x}:${frame.y}:${frame.clip.join(":")}`;
        if (registration !== registered) { spritePlane.style.transform = `translate(${frame.x}%,${frame.y}%)`; spritePlane.style.clipPath = `inset(${frame.clip.map(value => `${value}%`).join(" ")})`; registered = registration; }
        cell = key;
      }
      bodyPlane.style.transform = `translate3d(${current.x - 46}px,${current.y - 92}px,0) scale(${current.scale})`;
      shadowPlane.style.transform = `translate3d(${current.x - 26}px,${current.groundY - 3}px,0) scale(${current.scale * (1 - Math.min(34, current.groundY - current.y) / 90)})`;
      facingPlane.style.transform = `scaleX(${sample.facing})`;
      posePlane.style.transform = `translateY(${sample.bob.toFixed(3)}px) rotate(${sample.tilt.toFixed(3)}deg) scale(${sample.scaleX.toFixed(4)},${sample.scaleY.toFixed(4)})`;
      painter?.paint(selection, accessory, false);
      element.dataset.row = String(sample.row); element.dataset.pose = String(selection.physicalIndex);
      element.dataset.state = current.status; element.dataset.purpose = current.purpose; element.dataset.leg = String(current.leg);
      element.dataset.x = current.x.toFixed(3); element.dataset.y = current.y.toFixed(3); element.dataset.groundY = current.groundY.toFixed(3);
      element.dataset.accessory = accessory ?? "none"; element.dataset.paintedAt = now.toFixed(1);
      session.move("pet", { x: current.x, y: current.groundY }, false);
      element.hidden = false;
      return true;
    };
    const schedule = (token: number) => {
      if (!animated() || !preferencesRef.current.roam && !walker.settling() || token !== generation) return;
      raf = requestAnimationFrame(now => {
        const due = nextCompanionPaint(now, previousPaint, 30);
        if (due === null) { schedule(token); return; }
        previousPaint = due;
        const delta = previousAt ? Math.min(80, Math.max(0, now - previousAt)) : 0; previousAt = now; activeTime += delta;
        current = walker.sample(delta, { width: innerWidth, height: innerHeight }, preferencesRef.current, animated());
        if (!current) { element.hidden = true; return; }
        if (current.row !== preparedRow) { void prepare(current.row, token); return; }
        if (!paint(now)) { void prepare(current.row, token); return; }
        schedule(token);
      });
    };
    const prepare = async (row: number, token: number) => {
      if (requestedRow === row || token !== generation) return;
      requestedRow = row;
      const ready = await preparation(row, () => active() && token === generation);
      if (token !== generation) return;
      requestedRow = -1;
      if (!active()) return;
      if (!ready) {
        // The shared decoder may yield while its slots are busy. A false
        // result must not permanently stop the only paint chain. Retry this
        // packet with a bounded backoff; hidden/unmounted generations cancel.
        if(retryRow!==row){retryRow=row;retryCount=0;}
        if(retryCount<16){retryCount++;retryTimer=window.setTimeout(()=>{retryTimer=0;if(token===generation&&active())void prepare(row,token);},Math.min(600,80+retryCount*40));}
        element.dataset.loadState = retryCount>=16?'unavailable':'waiting';
        return;
      }
      retryCount=0;retryRow=-1;element.dataset.loadState='ready';
      preparedRow = row; previousAt = 0;
      paint(performance.now()); schedule(token);
    };
    const refresh = () => {
      cancel(); requestedRow = -1;
      if (!active()) { element.hidden = true; return; }
      const stored = session.point("pet");
      if (stored && current && (Math.abs(stored.x - current.x) > .1 || Math.abs(stored.y - current.groundY) > .1)) walker.place(stored, { width: innerWidth, height: innerHeight });
      // Visibility/resize/quiet changes retain the same walk destination and
      // foot. Their elapsed hidden time never becomes an offscreen leap.
      current = walker.sample(0, { width: innerWidth, height: innerHeight }, preferencesRef.current, animated());
      if (current) void prepare(current.row, generation);
      else element.hidden = true;
    };
    refreshRef.current = refresh;
    const offSession = session.subscribe(refresh);
    const offInput = bindCompanionShowcaseInput(element, session, node => node.hasAttribute("data-showcase-pet") ? "pet" : undefined, () => preferencesRef.current.drag, () => {
      logActivity("ui.click", { target: "companion-drag" });
      if (!session.active() && session.visible("pet")) session.releasePet();
    });
    const off = subscribeCompanionCollection(value => { accessory = value.gifts.equipped; ensureWardrobe(); if (active()) paint(performance.now()); });
    const observer = new MutationObserver(refresh);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-gfx", "data-reduce-motion"] });
    window.addEventListener("resize", refresh); window.visualViewport?.addEventListener("resize", refresh);
    document.addEventListener("visibilitychange", refresh); window.addEventListener("focus", refresh); window.addEventListener("blur", refresh);
    ensureWardrobe(); refresh();
    return () => { disposed = true; cancel(); if (refreshRef.current === refresh) refreshRef.current = () => {}; off(); offSession(); offInput(); observer.disconnect(); painter?.clear(); window.removeEventListener("resize", refresh); window.visualViewport?.removeEventListener("resize", refresh); document.removeEventListener("visibilitychange", refresh); window.removeEventListener("focus", refresh); window.removeEventListener("blur", refresh); };
  }, [session]);
  // React setting changes need the same wakeup as focus/resize. Keep the
  // mounted controller, active clock and destination; cancel only its pending
  // paint/decode generation. In particular, OFF -> ON must wake a stopped RAF.
  useEffect(() => { refreshRef.current(); }, [preferences.enabled, preferences.roam, preferences.jump, preferences.personality, preferences.animalMode, preferences.speed, preferences.activeWhileVisible, reduced]);
  return <div aria-label="초원을 산책하는 빅타민" className="vc-meadow-walk" data-night={night ? "1" : undefined} hidden ref={host} role="group">
    <span className="vc-meadow-walk-shadow" ref={shadow} aria-hidden="true" />
    <button className="vc-meadow-walk-body" ref={body} data-showcase-pet="" data-activity-manual="" type="button" aria-label="빅타민 · 잡아서 옮기기"><span className="vc-meadow-walk-facing" ref={facing}><span className="vc-pose" ref={pose}>
      <span className="vc-wearable vc-wearable-back" ref={back} /><span className="vc-sprite" ref={sprite}><canvas width="192" height="192" ref={canvas} /></span><span className="vc-wearable vc-wearable-front" ref={front} /><span className="vc-wearable vc-gift-prop" ref={gift} />
    </span></span></button>
  </div>;
}
