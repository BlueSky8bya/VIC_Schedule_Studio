import { companionLayoutMotionMs } from "./element-anchor";

/** The meadow borrows the resident and already-exposed physical items before
 * the calendar is hidden. Departure may start at home or a calendar ledge;
 * covered food/toys never enter just because their cover disappeared. */
export const COMPANION_SHOWCASE_EVENT = "vic:showcase-transition";
export type ShowcasePoint = { x: number; y: number };
export type ShowcaseRect = { left: number; top: number; right: number; bottom: number };
type Kind = "pet" | "food" | "toy";
export type CompanionShowcasePetInteraction = "pet" | "bonk" | "drag" | "throw" | "shake" | "rest" | "rested";
type Participant = { kind: Kind; node: () => HTMLElement | undefined | null; point: () => ShowcasePoint | undefined; eligible?: () => boolean; interact?: (kind: CompanionShowcasePetInteraction) => void };
export type CompanionShowcaseLease = ShowcasePoint & { width: number; height: number; bottomOffset: number; kind: Kind; pose?: number; enteredFromScene?: boolean; displayY?: number; displayScale?: number; rotation?: number; scaleX?: number; scaleY?: number };
type Transition = { active: boolean; phase: "before" | "after" };
const validRect = (r: ShowcaseRect) => [r.left, r.top, r.right, r.bottom].every(Number.isFinite) && r.right > r.left && r.bottom > r.top;
export function companionShowcaseFootprint(point: ShowcasePoint, size: { width: number; height: number }): ShowcaseRect {
  return { left: point.x - size.width / 2, right: point.x + size.width / 2, top: point.y - size.height, bottom: point.y };
}
export function exposedCompanionShowcaseRect(rect: ShowcaseRect, viewport: { width: number; height: number }, covers: readonly ShowcaseRect[]): boolean {
  if (!validRect(rect) || ![viewport.width, viewport.height].every(Number.isFinite) || rect.left < 0 || rect.top < 0 || rect.right > viewport.width || rect.bottom > viewport.height) return false;
  return !covers.some(cover => validRect(cover) && Math.min(rect.right, cover.right) - Math.max(rect.left, cover.left) > .5 && Math.min(rect.bottom, cover.bottom) - Math.max(rect.top, cover.top) > .5);
}

// These are the actual painted layout planes, not the transparent full-height
// rail/shell. Native controls protect their full boxes as well as calendar ink.
const COVER_SELECTOR = ".public-calendar-area,.public-calendar-header,.studio-calendar-panel,.studio-topbar,.studio-titlebar,.weekday-row,.studio-weekdays,.panel-section,.rail-info-card,.soop-live-beacon,.vc-home,.event-editor-panel,[role=dialog],button,a[href],input,select,textarea";
const LAYOUT_SELECTOR = `${COVER_SELECTOR},.poster-page,.studio-shell,.avatar-slot,.avatar-rail,.panel-section-body,.viewer-preview-overlay`;
const OWN_DRAWING_SELECTOR = ".vc-companion,.vc-meadow-walk,.vc-food-layer,.vc-toys,.vc-bed-foreground,.vc-wash-tool,.vc-home-touch-tool,.gs-season,.gs-tide,.pm-ambient-shell";
function layoutNode(node: Node | null): node is HTMLElement {
  return Boolean(node && node.nodeType === 1 && !(node as HTMLElement).closest(OWN_DRAWING_SELECTOR)
    && ((node as HTMLElement).matches(LAYOUT_SELECTOR) || (node as HTMLElement).closest(COVER_SELECTOR)));
}
export function companionShowcaseLayoutMutation(record: Pick<MutationRecord, "type" | "target" | "addedNodes" | "removedNodes">): boolean {
  if (record.target.nodeType === 1 && (record.target as HTMLElement).closest(OWN_DRAWING_SELECTOR)) return false;
  if (record.type === "attributes") return layoutNode(record.target);
  const changed = [...record.addedNodes, ...record.removedNodes];
  if (changed.length && changed.every(node => node.nodeType === 1 && (node as HTMLElement).matches(OWN_DRAWING_SELECTOR))) return false;
  return layoutNode(record.target) || changed.some(node => node.nodeType === 1 && ((node as HTMLElement).matches(LAYOUT_SELECTOR) || Boolean((node as HTMLElement).querySelector(COVER_SELECTOR))));
}
function visible(node: HTMLElement, retainHomePaint = false): boolean {
  if (!node.isConnected || node.closest("[hidden]") || node.closest(".vc-companion,.vc-meadow-walk,.vc-food-layer,.vc-toys,.gs-season,.gs-tide,.showcase-surface")) return false;
  // A modal's home input gate does not remove its painted room. Material
  // occlusion may retain that ink; showcase admission keeps its strict gate.
  let inaccessible = node.closest("[aria-hidden=true]");
  while (inaccessible) {
    if (!retainHomePaint || !inaccessible.matches(".vc-home,.vc-compact-home")) return false;
    inaccessible = inaccessible.parentElement?.closest("[aria-hidden=true]") ?? null;
  }
  for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) {
    const style = getComputedStyle(parent);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity || 1) <= .05) return false;
  }
  return true;
}
export function readCompanionShowcaseCovers({ retainHomePaint = false }: { retainHomePaint?: boolean } = {}): ShowcaseRect[] {
  if (typeof document === "undefined") return [];
  return [...document.querySelectorAll<HTMLElement>(COVER_SELECTOR)].filter(node => visible(node, retainHomePaint)).flatMap(node => {
    const rect = node.getBoundingClientRect();
    return validRect(rect) ? [{ left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom }] : [];
  });
}

export function createCompanionShowcaseSession() {
  const participants = new Map<string, Participant>(), leases = new Map<string, CompanionShowcaseLease>(), listeners = new Set<() => void>(), clearing = new Set<(ids: ReadonlySet<string>) => void>();
  let active = false, revision = 0, covers: ShowcaseRect[] = [], frame = 0, attached = false, followUntil = 0;
  let ownershipRevision = 0, ownershipKey = "";
  let layoutObserver: MutationObserver | undefined;
  let returnedPet: (ShowcasePoint & { home?: boolean; scale?: number }) | undefined;
  let roomCovers: { node: HTMLElement; rect: ShowcaseRect }[] = [];
  const notify = () => {
    revision++;
    const key = `${active}:${[...leases.keys()].join("|")}`;
    if (ownershipKey !== key) { ownershipKey = key; ownershipRevision++; }
    for (const listener of listeners) listener();
  };
  const viewport = () => ({ width: innerWidth, height: innerHeight });
  const exposed = (lease: CompanionShowcaseLease) => exposedCompanionShowcaseRect(companionShowcaseFootprint({ x: lease.x, y: lease.y + lease.bottomOffset }, lease), viewport(), covers);
  const restoredCovers = () => [...readCompanionShowcaseCovers(), ...roomCovers.filter(cover => !cover.node.isConnected).map(cover => cover.rect)];
  const returnExposedPet = () => { const pet = leases.get("pet"); if (!active && pet && exposed(pet)) { returnedPet = { x: pet.x, y: pet.y }; leases.delete("pet"); } };
  const discardCoveredItems = () => {
    const ids = new Set([...leases].filter(([, lease]) => lease.kind !== "pet" && !exposed(lease)).map(([id]) => id));
    if (!ids.size) return;
    for (const id of ids) leases.delete(id);
    // Physical food/toy owners remove the actual objects. No collection or
    // care reward is produced by automatic homecoming cleanup.
    for (const listener of clearing) listener(ids);
  };
  const transition = (event: Event) => {
    const detail = (event as CustomEvent<Transition>).detail;
    if (!detail || typeof detail.active !== "boolean") return;
    if (detail.phase === "before" && detail.active) {
      covers = readCompanionShowcaseCovers();
      roomCovers = [...document.querySelectorAll<HTMLElement>(".vc-home")].filter(node => visible(node)).map(node => ({ node, rect: node.getBoundingClientRect() }));
      for (const [id, participant] of participants) {
        if (leases.has(id) || participant.eligible?.() === false) continue;
        const node = participant.node(), point = participant.point();
        if (!node || !point || node.hidden || node.closest("[hidden],[inert],[aria-hidden=true]")) continue;
        const rect = node.getBoundingClientRect(), style = getComputedStyle(node);
        if (style.visibility === "hidden" || style.display === "none" || Number(style.opacity || 1) <= .05 || participant.kind !== "pet" && !exposedCompanionShowcaseRect(rect, viewport(), covers)) continue;
        const pose = node.dataset?.pose === undefined ? undefined : Number(node.dataset.pose);
        const enteredFromScene = participant.kind === "pet" && exposedCompanionShowcaseRect(rect, viewport(), covers);
        leases.set(id, { ...point, width: rect.width, height: rect.height, bottomOffset: rect.bottom - point.y, kind: participant.kind, ...(Number.isInteger(pose) ? { pose } : {}), ...(enteredFromScene ? { enteredFromScene: true } : {}) });
      }
      active = true; notify();
    } else if (detail.phase === "after" && !detail.active) {
      // Homecoming returns the same resident immediately, even when its
      // meadow foot lies behind the restored calendar or a panel.
      const pet = leases.get("pet");
      if (pet) { returnedPet = { x: pet.x, y: pet.displayY ?? pet.y, home: true, ...(pet.displayY === undefined ? {} : { scale: pet.displayScale }) }; leases.delete("pet"); }
      active = false; covers = [...covers, ...restoredCovers()]; discardCoveredItems(); notify();
      if (!frame) frame = requestAnimationFrame(() => {
        if (active) { frame = 0; return; }
        covers = [...covers, ...restoredCovers()]; notify();
        frame = requestAnimationFrame(() => { frame = 0; if (active) return; covers = restoredCovers(); discardCoveredItems(); notify(); });
      });
    }
  };
  const schedule = () => {
    if (active || !leases.size || frame) return;
    const measure = () => {
      frame = 0; if (active || !leases.size) return;
      covers = restoredCovers(); returnExposedPet(); notify();
      if (performance.now() < followUntil) frame = requestAnimationFrame(measure);
    };
    frame = requestAnimationFrame(measure);
  };
  const layoutMotion = (event: Event) => {
    const target = event.type === "vic:layout-motion" ? (event as CustomEvent<{ element?: HTMLElement }>).detail?.element : event.target as HTMLElement | null;
    if (!layoutNode(target ?? null) || active || !leases.size) return;
    if (["animationstart", "transitionrun", "vic:layout-motion"].includes(event.type)) {
      const duration = companionLayoutMotionMs(event, [target!], 0);
      // Follow a real finite transition only. Infinite procedural animation,
      // arbitrary styles and actor paint never create an ambient polling loop.
      if (duration > 0) followUntil = Math.max(followUntil, performance.now() + Math.min(1200, duration + 40));
    }
    schedule();
  };
  const clear = () => {
    cancelAnimationFrame(frame); frame = 0; followUntil = 0;
    const ids = new Set(leases.keys()); for (const listener of clearing) listener(ids);
    leases.clear(); returnedPet = undefined; roomCovers = []; covers = []; active = false; notify();
  };
  const restoredPage = (event: PageTransitionEvent) => { if (event.persisted) clear(); };
  return {
    attach() {
      if (attached || typeof window === "undefined") return;
      attached = true;
      window.addEventListener(COMPANION_SHOWCASE_EVENT, transition);
      window.addEventListener("scroll", schedule, { passive: true, capture: true }); window.addEventListener("resize", schedule, { passive: true });
      window.addEventListener("vic:panel-section", schedule); window.addEventListener("vic:side-panel", schedule); window.addEventListener("vic:companion-home", schedule);
      window.addEventListener("vic:companion-overlay", schedule); window.addEventListener("vic:layout-motion", layoutMotion);
      window.addEventListener("pagehide", clear); window.addEventListener("pageshow", restoredPage);
      if (typeof MutationObserver !== "undefined" && document.body) {
        layoutObserver = new MutationObserver(records => { if (!active && leases.size && records.some(companionShowcaseLayoutMutation)) schedule(); });
        layoutObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "hidden", "open", "aria-hidden", "aria-modal"] });
      }
      if (typeof document.addEventListener === "function") for (const name of ["transitionrun", "transitionend", "animationstart", "animationend"]) document.addEventListener(name, layoutMotion, true);
    },
    dispose() {
      if (typeof window !== "undefined") {
        window.removeEventListener(COMPANION_SHOWCASE_EVENT, transition); window.removeEventListener("scroll", schedule, true); window.removeEventListener("resize", schedule);
        window.removeEventListener("vic:panel-section", schedule); window.removeEventListener("vic:side-panel", schedule); window.removeEventListener("vic:companion-home", schedule);
        window.removeEventListener("vic:companion-overlay", schedule); window.removeEventListener("vic:layout-motion", layoutMotion);
        window.removeEventListener("pagehide", clear); window.removeEventListener("pageshow", restoredPage);
        if (typeof document.removeEventListener === "function") for (const name of ["transitionrun", "transitionend", "animationstart", "animationend"]) document.removeEventListener(name, layoutMotion, true);
        cancelAnimationFrame(frame);
      }
      layoutObserver?.disconnect(); layoutObserver = undefined;
      attached = false; active = false; frame = 0; followUntil = 0; returnedPet = undefined; roomCovers = []; participants.clear(); leases.clear(); listeners.clear(); clearing.clear();
    },
    register(id: string, participant: Participant) { participants.set(id, participant); return () => { if (participants.get(id) === participant) participants.delete(id); }; },
    unregister(id: string) { participants.delete(id); },
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    subscribeClear(listener: (ids: ReadonlySet<string>) => void) { clearing.add(listener); return () => { clearing.delete(listener); }; },
    snapshot: () => revision,
    // Per-input transforms still notify their imperative painters. React
    // only needs admission/exit/removal, not a component commit per pixel.
    ownershipSnapshot: () => ownershipRevision,
    active: () => active,
    has: (id: string) => leases.has(id),
    hasKind: (kind: Kind) => [...leases.values()].some(lease => lease.kind === kind),
    point: (id: string) => leases.get(id),
    /** Direct acknowledged input reaches the existing resident's care/learning
     * owner. The meadow never manufactures a second brain or collection. */
    interact(kind: CompanionShowcasePetInteraction) {
      if (active && leases.has("pet") && !document.hidden) participants.get("pet")?.interact?.(kind);
    },
    takeReturnedPet() { const point = returnedPet; returnedPet = undefined; return point; },
    releasePet() {
      const pet = leases.get("pet"); if (!pet || active) return false;
      returnedPet = { x: pet.x, y: pet.y }; leases.delete("pet"); notify(); return true;
    },
    visible: (id: string) => { const lease = leases.get(id); return Boolean(lease && (active || exposed(lease))); },
    move(id: string, point: ShowcasePoint, publish = true) {
      const lease = leases.get(id);
      if (!lease || ![point.x, point.y].every(Number.isFinite)) return;
      lease.x = Math.max(lease.width / 2, Math.min(innerWidth - lease.width / 2, point.x));
      lease.y = Math.max(lease.height - lease.bottomOffset, Math.min(innerHeight - 8 - lease.bottomOffset, point.y));
      if (publish) notify();
    },
    /** Displayed airborne foot is distinct from the ground used by input. */
    presentPet(point: { y: number; scale: number }) {
      const pet = leases.get("pet");
      if (!pet || ![point.y, point.scale].every(Number.isFinite)) return;
      pet.displayY = point.y; pet.displayScale = point.scale;
    },
    present(id: string, pose?: { rotation: number; scaleX: number; scaleY: number }) {
      const lease = leases.get(id); if (!lease) return;
      lease.rotation = pose?.rotation ?? 0; lease.scaleX = pose?.scaleX ?? 1; lease.scaleY = pose?.scaleY ?? 1;
    },
    /** The next deliberate input returns a survivor to its ordinary owner.
     * Remove the screen cover rule before that owner paints the same foot. */
    reclaim(id: string, adopt: (point: ShowcasePoint) => boolean) {
      const lease = leases.get(id);
      if (active || !lease || lease.kind === "pet" || !exposed(lease)) return false;
      leases.delete(id);
      let adopted = false;
      try { adopted = adopt({ x: lease.x, y: lease.y }); }
      finally { if (!adopted) leases.set(id, lease); }
      if (!adopted) return false;
      notify(); return true;
    },
    forget(id: string) { if (leases.delete(id)) notify(); },
    clear,
  };
}
export type CompanionShowcaseSession = ReturnType<typeof createCompanionShowcaseSession>;
