"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from "react";
import { createPortal } from "react-dom";
import type { BroadcastTag, PublicScheduleEvent } from "@/lib/domain/schedule-types";
import type { TagVisualResolver } from "@/lib/tags/tag-visual";
import { tagColor } from "@/lib/tags/dark-palette";
import type { PremiereFrame } from "@/lib/ui/premiere/plan";
import { TeaserStageContent } from "@/components/shared/teaser-stage-content";
import { Sparkles, Check, X, ArrowUpRight, Music2, VolumeX, WandSparkles } from "lucide-react";
import { useRemainSeconds } from "@/lib/ui/use-remain-seconds";
import { usePremiereChoreography } from "./use-premiere-choreography";
import { flipSpring, FLIP_SPRING } from "@/lib/ui/flip-motion";
import { useAmbientPause } from "@/lib/ui/ambient-pause";
import { popInnerOverlay, pushInnerOverlay } from "@/lib/ui/overlay-pop";
import { gfxMode } from "@/lib/ui/gfx";
import { POSTER_AGENDA_QUERY } from "@/lib/ui/breakpoints";
import { playSfx } from "@/lib/ui/sfx";
import { hapticSuccess, hapticTick } from "@/lib/ui/haptics";
import { splitEventTitleOutline } from "@/lib/calendar/month";
import { PREMIERE_EASE } from "@/lib/ui/premiere/focus-motion";
import { usePremiereCardVisible } from "./use-premiere-clock-owner";
import { PremiereScene, PremierePortrait, type PremiereReaction } from "./premiere-scene";
import { usePremiereMusic } from "./use-premiere-music";
import { createFlashBudget } from "@/lib/ui/premiere/flash-budget";
import "./premiere-stage.css";

type Props = { frame: PremiereFrame; bang: number; reduced: boolean; hint: boolean; canResume: boolean; onResume: () => void; month: number; tags: BroadcastTag[]; tagVisual: TagVisualResolver; root: RefObject<HTMLDivElement | null>; onClose: () => void; onHope: (id: string) => void; onRead?: (id: string) => void; hoped: Set<string>; onOtherMonth: () => void; detailEventId?: string };
const phases = ["idle", "prelude", "filters", "chrome", "curtain", "quake", "screen", "build", "eye", "waiting", "reveal", "return"];

export function PremiereStage({ frame, bang, reduced, hint, canResume, onResume, month, tags, tagVisual, root, onClose, onHope, onRead, hoped, onOtherMonth, detailEventId }: Props) {
  const [ready, setReady] = useState(false);
  const [burst, setBurst] = useState(false);
  const [hopePulse, setHopePulse] = useState(0);
  const [reaction, setReaction] = useState<PremiereReaction | null>(null);
  const [cheerPulse, setCheerPulse] = useState(0);
  const lastCheer = useRef(-Infinity);
  const reactionSerial = useRef(0);
  const [gfx, setGfx] = useState("full");
  const [announcement, setAnnouncement] = useState<{ key: string; text: string } | null>(null);
  const [agenda, setAgenda] = useState(false);
  const instanceId = useId();
  const screen = useRef<HTMLDivElement>(null);
  const transfer = useRef<HTMLDivElement>(null);
  const portal = useRef<HTMLDivElement>(null);
  const exit = useRef<HTMLButtonElement>(null);
  const resumeFocus = useRef(false);
  const lastBang = useRef(0);
  const lastBurstRelease = useRef("");
  const visualFlashBudget = useRef(createFlashBudget());
  const sounded = useRef(new Set<string>());
  const previousFocus = useRef<HTMLElement | null>(null);
  const screenLayout = useRef<{ left: number; top: number; width: number; height: number } | null>(null);
  const focused = frame.focused || frame.phase === "return";
  const active = frame.phase !== "idle";
  const complete = frame.items.length > 0 && frame.items.every(item => item.state === "released");
  const music = usePremiereMusic(focused && !reduced && frame.phase !== "return" && frame.items.some(item => item.state === "masked"), frame.target);
  const cardVisible = usePremiereCardVisible(root, frame.items.map(item => item.id).join("|"), active && !focused);
  const detailOwnsClock = Boolean(detailEventId && frame.items.some(item => item.id === detailEventId));
  const dockOwnsClock = !focused && !detailOwnsClock && !cardVisible;
  const phaseIndex = phases.indexOf(frame.phase);
  usePremiereChoreography(frame, reduced, root, exit, portal, previousFocus);
  useEffect(() => { if (!active) setHopePulse(0); }, [active]);
  useEffect(() => {
    if (!reaction) return;
    const timer = setTimeout(() => setReaction(null), reaction.kind === "delighted" ? 2100 : 1500);
    return () => clearTimeout(timer);
  }, [reaction]);
  useEffect(() => {
    if (!focused || complete) { setReaction(null); setCheerPulse(0); lastCheer.current = -Infinity; }
  }, [focused, complete]);
  useEffect(() => { setReady(true); const read = () => setGfx(gfxMode()); read(); const observer = new MutationObserver(read); observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-gfx"] }); return () => observer.disconnect(); }, []);
  useEffect(() => { const media = matchMedia(POSTER_AGENDA_QUERY); const read = () => setAgenda(media.matches); read(); media.addEventListener("change", read); return () => media.removeEventListener("change", read); }, []);
  useAmbientPause(active && phaseIndex >= phases.indexOf("curtain"), `premiere-stage-${instanceId}`);

  useLayoutEffect(() => {
    if (!active) { if (previousFocus.current?.isConnected) previousFocus.current.focus({ preventScroll: true }); previousFocus.current = null; return; }
    if (focused) return;
    const key = (event: KeyboardEvent) => { if (event.key === "Escape") { event.preventDefault(); onClose(); } };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [active, focused, onClose]);

  // A visible dialog must already own Escape/focus, including its first paint.
  useLayoutEffect(() => {
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
    portal.current?.focus({ preventScroll: true });
    let popped = false;
    const back = () => { popped = true; onClose(); };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopImmediatePropagation(); onClose(); }
      if (event.key === "Tab") {
        const buttons = [...(portal.current?.querySelectorAll<HTMLElement>("button:not(:disabled),a[href],[tabindex='0']") ?? [])]
          .filter(el => !el.closest("[inert],[aria-hidden='true']") && el.getClientRects().length > 0);
        const first = buttons[0], last = buttons[buttons.length - 1];
        if (document.activeElement === portal.current) { event.preventDefault(); (event.shiftKey ? last : first)?.focus(); }
        else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
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
    const face = transfer.current;
    const target = el.getBoundingClientRect();
    const item = frame.items[0];
    const source = root.current?.querySelector<HTMLElement>(`[data-eventid="${item?.id}"]`);
    const from = source?.getBoundingClientRect();
    const inView = from && from.bottom > 0 && from.top < innerHeight && from.right > 0 && from.left < innerWidth;
    if (from && target.width && from.width && (inView || frame.phase === "return")) {
      if (frame.phase === "return") {
        el.style.transition = `transform 520ms ${PREMIERE_EASE}, opacity 520ms ease`;
        el.style.transform = "translateY(14px) scale(.985)"; el.style.opacity = "0";
      } else {
        // A small sprung carrier lands at the clock. The painted plane unfolds
        // separately; every glyph appears at its final, un-stretched size.
        el.dataset.pmMorph = "card";
        const landing = el.querySelector<HTMLElement>(".dt-count-ringbox")?.getBoundingClientRect() ?? target;
        if (face) {
          const left = landing.left + (landing.width - from.width) / 2, top = landing.top + (landing.height - from.height) / 2;
          Object.assign(face.style, { left: `${left}px`, top: `${top}px`, width: `${from.width}px`, height: `${from.height}px` });
          face.dataset.active = "true";
          flipSpring(face, `translate(${from.left - left}px,${from.top - top}px)`, { ms: 1350, easing: FLIP_SPRING });
        }
        flipSpring(el, "translateY(18px) scale(.985)", { ms: 1350, easing: PREMIERE_EASE });
      }
    }
    return () => {
      el.style.transform = ""; el.style.transition = ""; el.style.transformOrigin = ""; el.style.opacity = "";
      delete el.dataset.pmMorph;
      if (face) { delete face.dataset.active; face.removeAttribute("style"); }
    };
    // Only the entry/return changes position, never the per-second frame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, focused, frame.phase === "return", reduced]);

  const contentRevision = frame.items.map(item => `${item.id}:${item.state}:${JSON.stringify(item.event)}`).join("|");
  useLayoutEffect(() => {
    const el = screen.current;
    if (!focused || reduced || frame.phase === "return" || !el) { screenLayout.current = null; return; }
    const next = { left: el.offsetLeft, top: el.offsetTop, width: el.offsetWidth, height: el.offsetHeight };
    const before = screenLayout.current;
    screenLayout.current = next;
    if (!before || !next.width || !next.height || Math.abs(before.height - next.height) < 2 && Math.abs(before.width - next.width) < 2) return;
    // The same FLIP used for source↔screen also carries publication/re-gating
    // layout changes, instead of replacing the clock with a jumping box.
    const dx = Math.max(-24, Math.min(24, before.left - next.left));
    const dy = Math.max(-24, Math.min(24, before.top - next.top));
    // Carry the plane, never non-uniformly stretch new reading typography.
    flipSpring(el, `translate(${dx}px,${dy}px) scale(.985)`, { ms: 640, easing: PREMIERE_EASE });
    // Semantic content changes only; never animate layout on a clock tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, frame.phase === "return", contentRevision, reduced]);

  const releasedKey = frame.items.filter(item => item.state === "released").map(item => `${item.id}:${item.revealAt}`).join("|");
  useEffect(() => {
    setBurst(false);
    if (!focused || reduced) { setBurst(false); return; }
    if (!bang || bang === lastBang.current) return;
    if (!releasedKey || releasedKey === lastBurstRelease.current) return; // Zero is a deadline, not a publication verdict.
    // Network confirmation can compress originally separated deadline cues.
    // Reuse the same 1.5s budget at the actual visible effect, dropping excess.
    if (!visualFlashBudget.current.request(performance.now())) return;
    lastBang.current = bang;
    lastBurstRelease.current = releasedKey;
    if (!focused || reduced || document.hidden) return;
    setBurst(true);
    const timer = setTimeout(() => setBurst(false), 900);
    return () => clearTimeout(timer);
  }, [bang, focused, reduced, releasedKey]);

  useEffect(() => {
    if (!focused || document.hidden || !releasedKey) { setAnnouncement(null); return; }
    const fresh = releasedKey.split("|").filter(key => !sounded.current.has(key));
    if (!fresh.length) { setAnnouncement(null); return; }
    for (const key of fresh) sounded.current.add(key);
    setAnnouncement({ key: releasedKey, text: `공개되었습니다. ${frame.items.filter(item => fresh.includes(`${item.id}:${item.revealAt}`)).map(item => splitEventTitleOutline(item.event.publicTitle).main).join(". ")}` });
    playSfx("fanfare"); hapticSuccess();
    // Only newly confirmed titles are announced, once per release.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focused, releasedKey]);

  if (!ready) return null;
  // A plain control, outside the full-viewport stage: the calendar stays usable
  // and the card/detail keeps the single countdown while a show is dismissed.
  if (!active && canResume) return createPortal(<div className="pm-banner pm-resume"><button type="button" ref={el => { if (el && resumeFocus.current) { el.focus({ preventScroll: true }); resumeFocus.current = false; } }} onClick={() => { resumeFocus.current = true; onResume(); }}>최초공개 다시 보기 <ArrowUpRight aria-hidden="true" size={16} /></button></div>, document.body);
  if (!active && !hint) return null;
  const season = month >= 3 && month <= 5 ? "spring" : month >= 6 && month <= 8 ? "summer" : month >= 9 && month <= 11 ? "autumn" : "winter";
  const released = frame.items.filter(item => item.state === "released");
  const waiting = frame.items.filter(item => item.state === "masked");
  const hasHope = waiting.some(item => hoped.has(item.id));
  return createPortal(<div ref={portal} tabIndex={focused ? -1 : undefined} data-clock-owner={focused ? "stage" : detailOwnsClock ? "detail" : dockOwnsClock ? "dock" : "card"} data-teaser-at={focused && waiting.length ? new Date(frame.target).toISOString() : undefined} role={focused ? "dialog" : undefined} aria-modal={focused || undefined} aria-label={focused ? "최초공개 무대" : undefined} className={`pm-stage pm-phase-${frame.phase}${focused ? " pm-focused" : ""}${complete ? " pm-complete" : ""}${burst ? " pm-bang" : ""}${reduced ? " pm-static" : ""}${hasHope ? " pm-hoped" : ""}`} data-season={season} data-gfx={gfx}>
    <p className="sr-only" role="status" aria-live="polite">{focused && announcement?.key === releasedKey ? announcement.text : ""}</p>
    {focused ? <>
      <div className="pm-dark" aria-hidden="true" />
      <div className="pm-flash" key={bang} aria-hidden="true" />
      <div className="pm-shock" key={`shock-${bang}`} aria-hidden="true" />
      <div className="pm-viewport">
        <div className={`pm-screen${released.length ? " is-released" : ""}`} ref={screen} style={released[0] ? premierePaper(released[0].event, tagVisual) : undefined}>
          <PremiereScene pulse={hopePulse} reaction={reaction} cheer={cheerPulse} />
          <header className="pm-heading" data-pm-retreat><span className="pm-kicker">최초공개</span><span>{frame.items.length > 1 ? `${frame.items.length}개의 일정` : shortDate(frame.items[0]?.dateKey)}</span><span className="pm-heading-rule" aria-hidden="true" />{complete ? <div className="pm-keepsake" aria-hidden="true"><span>✦</span><PremierePortrait /><i>✧</i></div> : null}</header>
          <div className="pm-composition">
            {waiting.length ? <div className="pm-count" data-pm-watching={waiting.map(item => item.id).join(" ")}><TeaserStageContent revealAt={new Date(frame.target).toISOString()} presentation="premiere" /></div> : null}
            <div className={`pm-films pm-n${frame.items.length}${frame.items.length > (agenda ? 2 : 4) ? " pm-list" : ""}`}>
              {frame.items.map((item, index) => <article className={`pm-film ${item.state}`} key={item.id} data-pm-event={item.id} data-pm-retreat style={item.state === "released" ? premierePaper(item.event, tagVisual) : undefined}>
                {item.state === "released" ? <>
                  <div className="pm-date"><span>{Number(item.dateKey.slice(5, 7))}월</span><strong>{Number(item.dateKey.slice(8, 10))}</strong><span>{new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", weekday: "long" }).format(new Date(`${item.dateKey}T12:00:00+09:00`))}</span></div>
                  <PremiereStory event={item.event} tags={tags} tagVisual={tagVisual} onRead={onRead} />
                </> : <div className="pm-masked" data-pm-retreat>
                  {frame.items.length > 1 ? <span className="pm-slot-label">{String(index + 1).padStart(2, "0")} <span>{shortDate(item.dateKey)}</span></span> : null}
                  <button type="button" aria-pressed={hoped.has(item.id)} className={`pm-hope${hoped.has(item.id) ? " on" : ""}`} onClick={() => { const adding = !hoped.has(item.id); setReaction({ serial: ++reactionSerial.current, kind: adding ? "delighted" : "unimpressed" }); if (adding) { setHopePulse(value => value + 1); setCheerPulse(value => value + 1); } onHope(item.id); }}>
                    {hoped.has(item.id) ? <Check aria-hidden="true" size={20} /> : <Sparkles aria-hidden="true" size={20} />}<span>{hoped.has(item.id) ? "함께 기다리는 중" : "기대돼요"}</span><span className="pm-hope-ripple" aria-hidden="true" key={hopePulse} />
                  </button>
                </div>}
              </article>)}
            </div>
          </div>
          {waiting.length ? <div className="pm-music" data-pm-retreat><button type="button" aria-label="응원봉 흔들기" onClick={() => { if (performance.now() - lastCheer.current < 800) return; lastCheer.current = performance.now(); setCheerPulse(value => value + 1); hapticTick(); playSfx("sparkle"); }}><WandSparkles size={15} aria-hidden="true" /><span>응원봉 흔들기</span></button><button type="button" data-sfx="off" aria-pressed={music.playing} disabled={!music.available} aria-label={music.playing ? "음악 끄기" : "음악 켜기"} onClick={music.toggle}>{music.playing ? <VolumeX size={15} aria-hidden="true" /> : <Music2 size={15} aria-hidden="true" />}<span>{music.playing ? "음악 끄기" : "음악 켜기"}</span></button></div> : null}
        </div>
        <div ref={transfer} className="pm-card-transfer" aria-hidden="true"><span>🔮</span><strong>???</strong><span>✦</span></div>
      </div>
    </> : null}
    <div className={`pm-banner${focused ? " pm-banner-focused" : ""}${focused && complete ? " pm-banner-reading" : ""}`}>
      {hint && !active ? <><span>다른 달에서 최초공개</span><button onClick={onOtherMonth} type="button">보러 가기 <ArrowUpRight aria-hidden="true" size={16} /></button></> : <>
        {!focused ? <><div className="pm-badge-portrait" aria-hidden="true"><PremierePortrait /></div>{dockOwnsClock ? <><svg className="pm-mini-ring" viewBox="0 0 36 36" aria-hidden="true"><circle cx="18" cy="18" r="15" /><circle cx="18" cy="18" r="15" pathLength="1" /></svg><span>최초공개</span><PremiereReadout target={frame.target} /></> : <span>최초공개 준비 중</span>}</> : null}
        <button ref={exit} onClick={onClose} type="button" aria-label="일정표 보기">{focused ? <><span>일정표 보기</span><ArrowUpRight aria-hidden="true" size={16} /></> : <X aria-hidden="true" size={18} />}</button>
      </>}
    </div>
  </div>, document.body);
}

function shortDate(value?: string) { return value ? `${Number(value.slice(5, 7))}월 ${Number(value.slice(8, 10))}일` : ""; }

function PremiereStory({ event, tags, tagVisual, onRead }: { event: PublicScheduleEvent; tags: BroadcastTag[]; tagVisual: TagVisualResolver; onRead?: (id: string) => void }) {
  return <div className="pm-story">
    {/* Before long content: a six-second automatic beat must never bury the
        escape into unhurried reading below several screens of subtopics. */}
    {onRead ? <button type="button" className="pm-read" onClick={() => onRead(event.id)}>계속 읽기 <ArrowUpRight size={16} aria-hidden="true" /></button> : null}
    <PremiereTitle title={event.publicTitle} />
    <div className="pm-details">
      <time dateTime={event.startsAt}>{event.isAllDay ? "하루 종일" : new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "numeric", minute: "2-digit" }).format(new Date(event.startsAt))}</time>
      {event.publicDescription ? <p>{event.publicDescription}</p> : null}
      {event.tagIds.length ? <div className="pm-tags">{event.tagIds.flatMap(id => { const tag = tags.find(tag => tag.id === id), visual = tagVisual.visualOf(id); return tag ? <span key={id} style={{ "--pm-tag": visual.cssAccent ?? "var(--teaser)", background: visual.cssBg ? `color-mix(in srgb, ${visual.cssBg} 24%, rgb(var(--glass-panel)))` : undefined, borderColor: visual.cssBorder ? `color-mix(in srgb, ${visual.cssBorder} 36%, transparent)` : undefined } as CSSProperties}>{tag.displayName}</span> : []; })}</div> : null}
    </div>
  </div>;
}

function premierePaper(event: PublicScheduleEvent, visual: TagVisualResolver): CSSProperties {
  const colors = visual.eventFills(event);
  const [first, second = first] = colors;
  return { "--pm-accent": first ? tagColor(first.bgColor, "borderColor", first.darkColors, first.borderColor) : "var(--teaser)", "--pm-accent-two": second ? tagColor(second.bgColor, "borderColor", second.darkColors, second.borderColor) : "var(--teaser)" } as CSSProperties;
}

function PremiereTitle({ title }: { title: string }) {
  const { main, subs } = splitEventTitleOutline(title);
  return <><h2 data-density={[...main].length > 42 ? "long" : undefined}>{main}</h2>{subs.length ? <ul className="pm-subtopics" aria-label="세부 내용">{subs.map((item, index) => <li key={index} data-depth={item.depth} style={{ "--pm-indent": item.depth } as CSSProperties}>{item.text}</li>)}</ul> : null}</>;
}

function PremiereReadout({ target }: { target: number }) {
  const remain = useRemainSeconds(target);
  return <span className="pm-readout" role="timer" aria-live="off"><strong key={remain}>{remain === null ? "…" : `${Math.floor(remain / 60)}:${String(remain % 60).padStart(2, "0")}`}</strong></span>;
}
