"use client";

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import type { CompanionPreferences } from "@/lib/ui/viewer-companion/preferences";
import { loadCompanionCollection, subscribeCompanionCollection } from "@/lib/ui/viewer-companion/collection";
import { createCompanionMeadowWalk } from "@/lib/ui/viewer-companion/meadow-walk";
import { createCompanionMotion, nextCompanionPaint } from "@/lib/ui/viewer-companion/motion";
import { companionMotionClips, companionSpriteMetadata, peekDecodedCompanionSprite, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { companionPreviewDrawing, createCompanionPreviewPreparation } from "@/lib/ui/viewer-companion/wardrobe-preview";
import "./companion-meadow-walk.css";
import type { CompanionShowcaseSession } from "@/lib/ui/viewer-companion/showcase-session";
import { bindCompanionShowcaseInput } from "@/lib/ui/viewer-companion/showcase-input";
import { companionPettingResponse, createCompanionPettingContact, createCompanionPettingGesture } from "@/lib/ui/viewer-companion/petting";
import { companionTapReaction, sampleCompanionPlay } from "@/lib/ui/viewer-companion/play";
import { companionPlayDuration, COMPANION_THROW_ROW } from "@/lib/ui/viewer-companion/timing";
import type { CompanionPlay } from "@/lib/ui/viewer-companion/brain";
import { boundCompanionHeldPose, createCompanionHeldInertia } from "@/lib/ui/viewer-companion/held-inertia";
import { createCompanionHeldShake } from "@/lib/ui/viewer-companion/held-shake";
import { playCompanionSound } from "@/lib/ui/viewer-companion/companion-sound";

/** One temporary presentation of the actual admitted resident. Shared contact,
 * pose and throw samplers supply input feedback; care stays with its real brain. */
export function CompanionMeadowWalk({ preferences, available, reduced, night, session }: { preferences: CompanionPreferences; available: boolean; reduced: boolean; night: boolean; session: CompanionShowcaseSession }) {
  useSyncExternalStore(session.subscribe, session.ownershipSnapshot, () => 0);
  if (!session.has("pet") || !available || !preferences.enabled) return null;
  return <MeadowDrawing preferences={preferences} reduced={reduced} night={night} session={session} />;
}

function MeadowDrawing({ preferences, reduced, night, session }: { preferences: CompanionPreferences; reduced: boolean; night: boolean; session: CompanionShowcaseSession }) {
  const host = useRef<HTMLDivElement>(null), body = useRef<HTMLButtonElement>(null), facing = useRef<HTMLSpanElement>(null), pose = useRef<HTMLSpanElement>(null), sprite = useRef<HTMLSpanElement>(null), canvas = useRef<HTMLCanvasElement>(null), shadow = useRef<HTMLSpanElement>(null);
  const back = useRef<HTMLSpanElement>(null), front = useRef<HTMLSpanElement>(null), gift = useRef<HTMLSpanElement>(null);
  const preferencesRef = useRef(preferences); preferencesRef.current = preferences;
  const reducedRef = useRef(reduced); reducedRef.current = reduced;
  const refreshRef = useRef<() => void>(() => {});
  useLayoutEffect(() => {
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
    let previousAt = 0, previousPaint = 0, activeTime = 0, cell = "", registered = "", requestedRow = -1;
    const initial = session.point("pet");
    let fallback = initial?.pose === undefined ? undefined : selectCompanionSprite(initial.pose);
    let fallbackImage = fallback ? peekDecodedCompanionSprite(fallback.src) : undefined;
    let fallbackRow = fallback ? companionSpriteMetadata.rows.findIndex(row => row.includes(fallback!.physicalIndex)) : 0;
    if (initial) walker.enter(initial, { width: innerWidth, height: innerHeight });
    let current = walker.sample(0, { width: innerWidth, height: innerHeight }, preferencesRef.current, !reducedRef.current && !document.documentElement.hasAttribute("data-reduce-motion") && !["off", "soft"].includes(document.documentElement.dataset.gfx ?? ""));
    const petting = createCompanionPettingGesture(), touch = createCompanionPettingContact(), inertia = createCompanionHeldInertia(), shake = createCompanionHeldShake();
    let reaction: { play?: CompanionPlay; row?: number; began: number; duration: number; name: string } | undefined;
    let held = false, flying = false, flightPhase = 0, hoverUntil = 0, feedbackUntil = 0, shaken = false, responseSerial = 0;
    const ensureWardrobe = () => {
      if (!accessory || painter) return;
      void import("@/lib/ui/viewer-companion/accessory").then(module => { if (!disposed && !painter) { painter = module.createCompanionAccessoryPainter(hosts); refresh(); } }).catch(() => { /* An optional attachment chunk cannot disable the walk. */ });
    };
    const restricted = () => reducedRef.current || document.documentElement.hasAttribute("data-reduce-motion") || ["off", "soft"].includes(document.documentElement.dataset.gfx ?? "");
    const active = () => !disposed && !document.hidden && session.has("pet") && session.visible("pet");
    const interactive = () => active() && session.active() && (document.hasFocus() || preferencesRef.current.activeWhileVisible);
    const animated = () => interactive() && !held && !flying && !reaction && activeTime >= hoverUntil && !restricted();
    const cancel = () => { generation++; cancelAnimationFrame(raf); clearTimeout(retryTimer); retryTimer = 0; raf = 0; previousAt = 0; };
    const paint = (now: number) => {
      if (!current) return false;
      if (reaction && activeTime - reaction.began >= reaction.duration) {
        if (reaction.name === "sleep") { session.interact("rested"); reaction = { name: "wake", row: 12, began: activeTime, duration: 650 }; }
        else reaction = undefined;
      }
      const age = reaction ? Math.max(0, activeTime - reaction.began) : 0;
      const authored = reaction?.play ? sampleCompanionPlay(reaction.play, age / reaction.duration, restricted()) : undefined;
      const row = held ? 8 : flying ? COMPANION_THROW_ROW : authored?.row ?? reaction?.row ?? (activeTime < hoverUntil ? 9 : current.row);
      const phase = held ? 0 : flying ? flightPhase : authored?.phase ?? (reaction ? age / reaction.duration : current.phase);
      const status = held ? "held" : flying ? "jump" : authored ? "play" : reaction?.name ?? (activeTime < hoverUntil ? "petted" : current.status);
      const sample = motion.sample({ row, phase, status, x: current.x, y: current.y, now: activeTime, reduced: restricted(), travelDirection: status === "walk" || status === "jump" && !flying ? current.direction : undefined });
      const requested = selectCompanionSprite(companionSpriteMetadata.rows[sample.row][sample.column], sample.row, sample.column);
      const decoded = peekDecodedCompanionSprite(requested.src);
      const selection = decoded ? requested : fallback, image = decoded ?? fallbackImage;
      element.dataset.requestedRow = String(sample.row);
      // Borrow the resident's already-painted pixels while the next packet
      // warms. Network/decode latency must never hide or stop its entry arc.
      if (!decoded) void prepare(sample.row, generation);
      if (!image || !selection) return false;
      if (decoded) { fallback = selection; fallbackImage = decoded; fallbackRow = sample.row; }
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
      const contact = touch.sample(now, restricted());
      const hanging = restricted() ? { tilt: 0, stretch: 0, active: false } : boundCompanionHeldPose(inertia.sample(now), { x: current.x - 46, y: current.y - 92 }, { x: 46, y: 46 }, 92, { width: innerWidth, height: innerHeight });
      posePlane.style.transform = `translate(${contact.x.toFixed(3)}px,${(sample.bob + contact.y + (authored?.lift ?? 0)).toFixed(3)}px) rotate(${(sample.tilt + contact.tilt + hanging.tilt + (authored?.lean ?? 0)).toFixed(3)}deg) scale(${(sample.scaleX + contact.squash - hanging.stretch).toFixed(4)},${(sample.scaleY - contact.squash + hanging.stretch).toFixed(4)})`;
      painter?.paint(selection, accessory, false);
      element.dataset.row = String(decoded ? sample.row : fallbackRow); element.dataset.pose = String(selection.physicalIndex);
      element.dataset.state = status; element.dataset.purpose = reaction?.name ?? (held ? "held" : current.purpose); element.dataset.leg = String(current.leg);
      element.dataset.reaction = reaction?.play ?? reaction?.name ?? "none";
      element.dataset.x = current.x.toFixed(3); element.dataset.y = current.y.toFixed(3); element.dataset.groundY = current.groundY.toFixed(3);
      element.dataset.accessory = accessory ?? "none"; element.dataset.paintedAt = now.toFixed(1);
      session.move("pet", { x: current.x, y: current.groundY }, false);
      session.presentPet({ y: current.y, scale: current.scale });
      element.hidden = false;
      return true;
    };
    const schedule = (token: number) => {
      const finiteFeedback = () => Boolean(reaction || held || activeTime < hoverUntil || activeTime < feedbackUntil);
      if (raf || !interactive() || !animated() && !finiteFeedback() || animated() && !preferencesRef.current.roam && !walker.settling() && !finiteFeedback() || token !== generation) return;
      raf = requestAnimationFrame(now => {
        raf = 0;
        const due = nextCompanionPaint(now, previousPaint, 30);
        if (due === null) { schedule(token); return; }
        previousPaint = due;
        const delta = previousAt ? Math.min(80, Math.max(0, now - previousAt)) : 0; previousAt = now; activeTime += delta;
        current = walker.sample(delta, { width: innerWidth, height: innerHeight }, preferencesRef.current, animated() || walker.settling() && !restricted() && !held && !flying && !reaction);
        if (!current) { element.hidden = true; return; }
        if (!paint(now)) { void prepare(Number(element.dataset.requestedRow ?? current.row), token); return; }
        schedule(token);
      });
    };
    const prepare = async (row: number, token: number) => {
      if (requestedRow >= 0 || retryTimer || token !== generation) return;
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
      if (!raf) previousAt = 0;
      paint(performance.now()); schedule(token);
    };
    const refresh = () => {
      cancel(); requestedRow = -1;
      if (!active()) { element.hidden = true; return; }
      const stored = session.point("pet");
      if (stored && current && (Math.abs(stored.x - current.x) > .1 || Math.abs(stored.y - current.groundY) > .1)) walker.place(stored, { width: innerWidth, height: innerHeight });
      // Visibility/resize/quiet changes retain the same walk destination and
      // foot. Their elapsed hidden time never becomes an offscreen leap.
      current = walker.sample(0, { width: innerWidth, height: innerHeight }, preferencesRef.current, animated() || walker.settling() && !restricted() && !held && !flying && !reaction);
      if (current) { if (!paint(performance.now())) void prepare(Number(element.dataset.requestedRow ?? current.row), generation); else schedule(generation); }
      else element.hidden = true;
    };
    refreshRef.current = refresh;
    let visibilityKey = `${session.active()}:${session.visible("pet")}:${session.has("pet")}`;
    const offSession = session.subscribe(() => {
      const next = `${session.active()}:${session.visible("pet")}:${session.has("pet")}`, point = session.point("pet");
      // Another real food/toy can be flying without repeatedly resetting the
      // resident's active clock or its current finite response.
      if (next !== visibilityKey || point && current && (Math.abs(point.x - current.x) > .1 || Math.abs(point.y - current.groundY) > .1)) refresh();
      visibilityKey = next;
    });
    const respond = (name: string, play?: CompanionPlay, row = 9, duration = 900) => {
      const stored = session.point("pet"); if (stored) walker.place(stored, { width: innerWidth, height: innerHeight });
      reaction = { name, play, row, began: activeTime, duration: play ? companionPlayDuration(play, restricted()) : duration }; refresh();
    };
    const affection = () => {
      if (!preferencesRef.current.petting) return;
      session.interact("pet"); const responses = companionPettingResponse(preferencesRef.current.personality, preferencesRef.current);
      const selected = responses[responseSerial++ % responses.length];
      if (selected === "sniff" || selected === "stretch" || selected === "look") respond("petted", undefined, selected === "stretch" ? 16 : 1, 1000);
      else respond("petted", selected);
    };
    const offInput = bindCompanionShowcaseInput(element, session, node => node.hasAttribute("data-showcase-pet") ? "pet" : undefined, interactive, () => {}, {
      pet: true, canDrag: () => preferencesRef.current.drag, quiet: restricted,
      onActivate: affection,
      onTap: elapsed => {
        if (!preferencesRef.current.petting) return;
        const bonk = companionTapReaction({ elapsed, moved: 0, cancelled: false, recentMishap: false });
        if (bonk) { session.interact("bonk"); respond("bonked", bonk); } else affection();
      },
      onHold: value => { held = value; if (value) { reaction = undefined; shaken = false; const point = session.point("pet")!; shake.begin(point.x, point.y, performance.now()); playCompanionSound("lift", preferencesRef.current); } refresh(); },
      onMove: (from, to) => { const now = performance.now(); if (held && !restricted()) { inertia.push(to.x - from.x, to.y - from.y, now); shake.push(to.x, to.y, now); if (!shaken && shake.sample(now).active) { shaken = true; session.interact("shake"); } } feedbackUntil = activeTime + 600; },
      onFlight: (value, point) => {
        if (point) flightPhase = (point.elapsedMs ?? 0) < 70 ? 0 : (point.vy ?? 0) < -70 ? .3 : (point.vy ?? 0) < 70 ? .55 : .85;
        if (flying === value) return; flying = value; if (!value) feedbackUntil = activeTime + 300; refresh();
      },
      onRelease: thrown => { session.interact(thrown ? "throw" : "drag"); if (!thrown && shaken) respond("dizzy", "dizzy"); },
      onRest: () => { if (preferencesRef.current.sleep) { session.interact("rest"); respond("sleep", undefined, 11, 12000); } },
      onHover: event => {
        if (!preferencesRef.current.petting || event.pointerType !== "mouse" || event.buttons !== 0 || held || flying) return;
        const rect = bodyPlane.getBoundingClientRect(), nx = (event.clientX - rect.left) / rect.width, ny = (event.clientY - rect.top) / rect.height;
        const now = performance.now(), contact = touch.move(nx, now), stroke = petting.sample(nx, now, ny);
        if (stroke.reward) affection();
        if (stroke.stroking) { hoverUntil = activeTime + 650; element.dataset.petting = "hover"; }
        else if (contact) element.dataset.petting = "touch";
        feedbackUntil = activeTime + 550; refresh();
      },
      onHoverEnd: () => { petting.reset(); element.removeAttribute("data-petting"); },
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
    <button className="vc-meadow-walk-body" ref={body} data-showcase-pet="" data-activity-manual="" type="button" aria-label="빅타민 · 쓰다듬고 옮기기" aria-describedby="vc-meadow-help"><span className="vc-meadow-walk-facing" ref={facing}><span className="vc-pose" ref={pose}>
      <span className="vc-wearable vc-wearable-back" ref={back} /><span className="vc-sprite" ref={sprite}><canvas width="192" height="192" ref={canvas} /></span><span className="vc-wearable vc-wearable-front" ref={front} /><span className="vc-wearable vc-gift-prop" ref={gift} />
    </span></span></button><span className="sr-only" id="vc-meadow-help">마우스로 오가며 쓰다듬기. Enter로 쓰다듬기. Space로 집고 방향키로 옮긴 뒤 Space로 놓기. P로 놓을 곳 선택. N으로 낮잠. Escape는 집기를 놓고, 다시 누르면 감상을 나가기.</span>
  </div>;
}
