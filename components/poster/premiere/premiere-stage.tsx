"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { BroadcastTag } from "@/lib/domain/schedule-types";
import type { PremiereFrame } from "@/lib/ui/premiere/plan";
import { TeaserStageContent, ScrambleText } from "@/components/shared/teaser-stage-content";
import { flipSpring } from "@/lib/ui/flip-motion";
import { useAmbientPause } from "@/lib/ui/ambient-pause";
import { popInnerOverlay, pushInnerOverlay } from "@/lib/ui/overlay-pop";
import { gfxMode } from "@/lib/ui/gfx";
import { POSTER_AGENDA_QUERY } from "@/lib/ui/breakpoints";
import { playSfx } from "@/lib/ui/sfx";
import { hapticSuccess } from "@/lib/ui/haptics";
import "./premiere-stage.css";

type Props = { frame: PremiereFrame; bang: number; reduced: boolean; hint: boolean; month: number; tags: BroadcastTag[]; root: RefObject<HTMLDivElement | null>; onClose: () => void; onHope: (id: string) => void; hoped: Set<string>; onOtherMonth: () => void };
const phases = ["idle", "prelude", "filters", "chrome", "curtain", "quake", "screen", "build", "eye", "waiting", "reveal", "return"];

export function PremiereStage({ frame, bang, reduced, hint, month, tags, root, onClose, onHope, hoped, onOtherMonth }: Props) {
  const [ready, setReady] = useState(false);
  const [burst, setBurst] = useState(false);
  const [light, setLight] = useState(false);
  const [gfx, setGfx] = useState("full");
  const [announcement, setAnnouncement] = useState("");
  const [agenda, setAgenda] = useState(false);
  const [starOrigin, setStarOrigin] = useState<{ x: number; y: number } | null>(null);
  const instanceId = useId();
  const screen = useRef<HTMLDivElement>(null);
  const portal = useRef<HTMLDivElement>(null);
  const exit = useRef<HTMLButtonElement>(null);
  const lastBang = useRef(0);
  const sounded = useRef(new Set<string>());
  const previousFocus = useRef<HTMLElement | null>(null);
  const focused = frame.focused || frame.phase === "return";
  const active = frame.phase !== "idle";
  const phaseIndex = phases.indexOf(frame.phase);
  useLayoutEffect(() => {
    if (frame.phase === "idle") { setStarOrigin(null); return; }
    if (frame.phase !== "prelude" || reduced) return;
    const box = root.current?.querySelector("[data-pm-exit='1']")?.getBoundingClientRect();
    if (box && box.width && box.right > 0 && box.left < innerWidth) setStarOrigin({ x: box.left + box.width / 2, y: box.top + box.height / 2 });
  }, [frame.phase, reduced, root]);
  useEffect(() => { setReady(true); const read = () => setGfx(gfxMode()); read(); const observer = new MutationObserver(read); observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-gfx"] }); return () => observer.disconnect(); }, []);
  useEffect(() => { const media = matchMedia(POSTER_AGENDA_QUERY); const read = () => setAgenda(media.matches); read(); media.addEventListener("change", read); return () => media.removeEventListener("change", read); }, []);
  useAmbientPause(active && phaseIndex >= phases.indexOf("curtain"), `premiere-stage-${instanceId}`);

  // Scoped to this poster, never html: preview and anonymous use exactly this path.
  useEffect(() => {
    const page = root.current;
    if (!page || !active || reduced) return;
    page.dataset.premiere = frame.phase;
    const targets = [...page.querySelectorAll<HTMLElement>("[data-eventid]")].filter(el => frame.items.some(item => item.id === el.dataset.eventid));
    for (const el of targets) el.dataset.pmTarget = "1";
    const days = [...page.querySelectorAll<HTMLElement>(".public-day,.agenda-day")];
    const sourceBox = targets[0]?.getBoundingClientRect();
    if (sourceBox) for (const day of days) {
      const box = day.getBoundingClientRect();
      const distance = Math.hypot(box.left - sourceBox.left, box.top - sourceBox.top);
      day.style.setProperty("--pm-order", String(Math.min(8, Math.floor(distance / 180))));
    }
    const regions = [...page.querySelectorAll<HTMLElement>("[data-pm-exit]")];
    const saved = regions.map(el => ({ el, inert: el.inert, hidden: el.getAttribute("aria-hidden") }));
    for (const { el } of saved) {
      const threshold = Number(el.dataset.pmExit);
      if (phaseIndex >= threshold) {
        if (el.contains(document.activeElement)) { previousFocus.current = document.activeElement as HTMLElement; exit.current?.focus({ preventScroll: true }); }
        el.inert = true; el.setAttribute("aria-hidden", "true");
      }
    }
    return () => {
      delete page.dataset.premiere;
      for (const el of targets) delete el.dataset.pmTarget;
      for (const day of days) day.style.removeProperty("--pm-order");
      for (const { el, inert, hidden } of saved) { el.inert = inert; if (hidden === null) el.removeAttribute("aria-hidden"); else el.setAttribute("aria-hidden", hidden); }
    };
    // Only semantic phase/cohort changes alter region authority.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, frame.phase, phaseIndex, reduced, root, frame.items.map(item => item.id).join(",")]);

  useEffect(() => {
    if (!active) { if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true }); previousFocus.current = null; return; }
    if (focused) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [active, focused, onClose]);

  useEffect(() => {
    if (!focused || reduced) return;
    const before = document.activeElement as HTMLElement | null;
    const page = root.current;
    const oldInert = page?.inert;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    if (page) page.inert = true;
    const token = `premiere-${performance.now()}`;
    history.pushState({ ...history.state, vicPremiere: token }, "");
    pushInnerOverlay();
    exit.current?.focus({ preventScroll: true });
    let popped = false;
    const back = () => { popped = true; onClose(); };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
      if (event.key === "Tab") {
        const buttons = [...(portal.current?.querySelectorAll<HTMLElement>("button:not(:disabled),a[href],[tabindex='0']") ?? [])];
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    window.addEventListener("popstate", back);
    document.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("popstate", back); document.removeEventListener("keydown", key, true);
      if (page) page.inert = oldInert ?? false;
      document.body.style.overflow = oldOverflow;
      popInnerOverlay();
      if (!popped && history.state?.vicPremiere === token) history.back();
      if (before?.isConnected) before.focus({ preventScroll: true });
    };
  }, [focused, onClose, reduced, root]);

  useLayoutEffect(() => {
    if (!focused || reduced || !screen.current) return;
    const el = screen.current;
    const target = el.getBoundingClientRect();
    const item = frame.items[0];
    const source = root.current?.querySelector<HTMLElement>(`[data-eventid="${item?.id}"]`);
    const from = source?.getBoundingClientRect();
    if (from && target.width && from.width) {
      const transform = `translate(${from.left - target.left}px,${from.top - target.top}px) scale(${from.width / target.width},${from.height / target.height})`;
      if (frame.phase === "return") {
        el.style.transition = "transform 520ms cubic-bezier(0.3,1.25,0.5,1), opacity 520ms ease";
        el.style.transformOrigin = "top left"; el.style.transform = transform; el.style.opacity = "0";
      } else flipSpring(el, transform, { origin: "top left" });
    }
    return () => { el.style.transform = ""; el.style.transition = ""; el.style.transformOrigin = ""; el.style.opacity = ""; };
    // Only the entry/return changes position, never the per-second frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, frame.phase === "return", reduced]);

  useEffect(() => {
    if (!focused || reduced) { setBurst(false); return; }
    if (!bang || bang === lastBang.current) return;
    lastBang.current = bang;
    if (!focused || reduced || document.hidden) return;
    setBurst(true);
    const timer = setTimeout(() => setBurst(false), 900);
    return () => clearTimeout(timer);
  }, [bang, focused, reduced]);

  const releasedKey = frame.items.filter(item => item.state === "released").map(item => `${item.id}:${item.revealAt}`).join("|");
  useEffect(() => {
    if (!focused || document.hidden || !releasedKey) { setAnnouncement(""); return; }
    const fresh = releasedKey.split("|").filter(key => !sounded.current.has(key));
    if (!fresh.length) { setAnnouncement(""); return; }
    for (const key of fresh) sounded.current.add(key);
    setAnnouncement(`공개되었습니다. ${frame.items.filter(item => fresh.includes(`${item.id}:${item.revealAt}`)).map(item => item.event.publicTitle).join(". ")}`);
    playSfx("fanfare"); hapticSuccess();
    // Only newly confirmed titles are announced, once per release.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, releasedKey]);

  if (!ready || (!active && !hint)) return null;
  const season = month >= 3 && month <= 5 ? "spring" : month >= 6 && month <= 8 ? "summer" : month >= 9 && month <= 11 ? "autumn" : "winter";
  const count = reduced || gfx === "soft" || gfx === "off" ? 0 : gfx === "lite" ? 24 : 80;
  const released = frame.items.filter(item => item.state === "released");
  const waiting = frame.items.filter(item => item.state === "masked");
  return createPortal(<div ref={portal} data-teaser-at={focused ? new Date(frame.target).toISOString() : undefined} role={focused ? "dialog" : undefined} aria-modal={focused || undefined} aria-label={focused ? "최초공개 무대" : undefined} className={`pm-stage pm-${frame.phase}${focused ? " pm-focused" : ""}${burst ? " pm-bang" : ""}${reduced ? " pm-static" : ""}`} data-season={season}>
    <p className="sr-only" role="status" aria-live="polite">{announcement}</p>
    {starOrigin && !reduced ? <span className="pm-travel-star" aria-hidden="true" style={{ "--pm-star-x": `${starOrigin.x}px`, "--pm-star-y": `${starOrigin.y}px` } as CSSProperties}>✦</span> : null}
    {focused ? <>
      <div className="pm-dark" aria-hidden="true" />
      <div className="pm-flash" key={bang} aria-hidden="true" />
      <div className="pm-storm" aria-hidden="true"><div className="pm-orbit">{Array.from({ length: count }, (_, i) => <span className="pm-particle" key={i} style={{ "--x": `${Math.cos(i * 2.4) * (210 + (i % 9) * 25)}px`, "--y": `${Math.sin(i * 2.4) * (150 + (i % 7) * 20)}px`, "--delay": `${-i * .19}s`, "--turn": `${i * 47}deg` } as CSSProperties}><svg viewBox="0 0 24 24"><path d={season === "winter" ? "M12 1v22M2 6l20 12M2 18L22 6" : season === "summer" ? "M12 2Q2 14 6 19Q12 25 18 19Q22 14 12 2Z" : season === "autumn" ? "M3 21Q0 4 21 3Q21 20 3 21ZM3 21L17 7" : "M12 12C-4 7 7-6 12 10C17-6 28 7 14 12C28 17 17 30 12 14C7 30-4 17 12 12Z"} /></svg></span>)}</div></div>
      <div className="pm-shock" key={`shock-${bang}`} aria-hidden="true" />
      <div className="pm-viewport">
        <div className="pm-screen" ref={screen}>
          <header className="pm-heading"><span className="pm-kicker">VIC PREMIERE</span><span>{frame.items.length > 1 ? `${frame.items.length}개의 새로운 이야기` : "새로운 이야기가 열려요"}</span><span className="pm-corner-star" aria-hidden="true">✦</span></header>
          <div className="pm-projector" aria-hidden="true" />
          {waiting.length ? <div className="pm-count"><TeaserStageContent revealAt={new Date(frame.target).toISOString()} /></div> : null}
          <div className={`pm-films pm-n${frame.items.length}${frame.items.length > (agenda ? 2 : 4) ? " pm-list" : ""}`}>{frame.items.map(item => <article className={`pm-film ${item.state}`} key={item.id} data-pm-event={item.id}>
            <p className="pm-date">{item.dateKey.replaceAll("-", ".")}</p>
            <h2>{item.state === "released" ? <ScrambleText text={item.event.publicTitle} /> : "???"}</h2>
            {item.state === "released" ? <div className="pm-details"><p>{item.event.isAllDay ? "하루 종일" : new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" }).format(new Date(item.event.startsAt))}</p>{item.event.publicDescription ? <p>{item.event.publicDescription}</p> : null}<div className="pm-tags">{item.event.tagIds.map(id => <span key={id}>{tags.find(tag => tag.id === id)?.displayName ?? ""}</span>)}</div></div> : <div className="pm-masked"><span>공개 전까지 비밀이에요</span>{Date.parse(item.revealAt ?? "") <= frame.target && frame.remainMs <= 0 ? <p role="status">공개 내용을 불러오는 중…</p> : <button type="button" onClick={() => { setLight(value => !value); onHope(item.id); }} className={hoped.has(item.id) ? "on" : ""}>✦ {hoped.has(item.id) ? "기대 중" : "기대돼요"}</button>}</div>}
          </article>)}</div>
          {released.length > 1 ? <div className="pm-filmstrip">{released.map(item => <span key={item.id}>✦ {item.event.publicTitle}</span>)}</div> : null}
          {light || waiting.some(item => hoped.has(item.id)) ? <div className="pm-lightstick" aria-hidden="true"><i />✦</div> : null}
        </div>
      </div>
    </> : null}
    <div className="pm-banner" role="status" aria-live="polite"><span aria-hidden="true">✦</span><span>{hint && !active ? "다른 달에서 최초공개" : frame.phase === "reveal" ? "새로운 이야기가 공개됐어요" : frame.phase === "eye" ? "곧 만나요" : "최초공개 무대 준비 중"}</span>{hint && !active ? <button onClick={onOtherMonth} type="button">보러 가기</button> : <button ref={exit} onClick={onClose} type="button">일정표 보기 <span aria-hidden="true">↗</span></button>}</div>
  </div>, document.body);
}
