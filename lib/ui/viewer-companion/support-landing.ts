import type { Platform } from "./brain";

/** A deliberate release collides with the first real ledge below it, rather
 * than the nearest absolute height. Exact vertical rays win; edge attraction
 * is an explicit fallback only when no span covers the release x at all. */
export function firstCompanionSupportBelow(point: Readonly<{ x: number; y: number }>, platforms: readonly Platform[], edgeTolerance = 0): Platform | undefined {
  if (![point.x, point.y].every(Number.isFinite)) return undefined;
  const tolerance = Number.isFinite(edgeTolerance) ? Math.max(0, edgeTolerance) : 0;
  let exact: Platform | undefined, edge: Platform | undefined, edgeDistance = Infinity;
  const before = (a: Platform, b: Platform | undefined) => !b || a.y < b.y || a.y === b.y && (a.kind !== "floor" && b.kind === "floor" || (a.kind === "floor") === (b.kind === "floor") && a.id < b.id);
  for (const platform of platforms) {
    const end = platform.x + platform.width;
    if (!platform.id || ![platform.x, platform.y, platform.width, end].every(Number.isFinite) || platform.width <= 0 || platform.y < point.y - .5) continue;
    const distance = Math.max(platform.x - point.x, point.x - end, 0);
    if (!distance) { if (before(platform, exact)) exact = platform; }
    else if (distance <= tolerance && (!edge || platform.y < edge.y || platform.y === edge.y && (distance < edgeDistance || distance === edgeDistance && before(platform, edge)))) { edge = platform; edgeDistance = distance; }
  }
  return exact ?? edge;
}

/** A deliberate drop can start below the viewport's protected floor, notably
 * beside fixed month controls. After first-contact landing finds nothing,
 * recover only that real floor on the same vertical ray. Never attract to a
 * different column, house floor, or a card/date above the user's release. */
export function companionViewportFloorAbove(point: Readonly<{ x: number; y: number }>, platforms: readonly Platform[]): Platform | undefined {
  if (![point.x, point.y].every(Number.isFinite)) return undefined;
  let nearest: Platform | undefined;
  for (const platform of platforms) {
    const end = platform.x + platform.width;
    if (platform.kind !== "floor" || !/^viewport-floor(?:-\d+)?$/.test(platform.id)
      || ![platform.x, platform.y, platform.width, end].every(Number.isFinite) || platform.width <= 0
      || platform.y > point.y || point.x < platform.x || point.x > end) continue;
    if (!nearest || platform.y > nearest.y || platform.y === nearest.y && platform.id < nearest.id) nearest = platform;
  }
  return nearest;
}

/** After an explicit drop misses every vertical contact, slide out of a
 * protected control's gap onto the closest real viewport-floor fragment.
 * Passive scroll recovery keeps its same-column rule; no floor is invented. */
export function recoverCompanionDropAtViewportFloor(point: Readonly<{ x: number; y: number }>, platforms: readonly Platform[]): { platform: Platform; x: number } | undefined {
  if (![point.x, point.y].every(Number.isFinite)) return undefined;
  let best: { platform: Platform; x: number } | undefined, distance = Infinity;
  for (const platform of platforms) {
    const end = platform.x + platform.width;
    if (platform.kind !== "floor" || !/^viewport-floor(?:-\d+)?$/.test(platform.id)
      || ![platform.x, platform.y, platform.width, end].every(Number.isFinite) || platform.width <= 0) continue;
    const x = Math.max(platform.x, Math.min(end, point.x));
    const next = Math.hypot(x - point.x, platform.y - point.y);
    if (Number.isFinite(next) && (next < distance || next === distance && (!best || platform.id < best.platform.id))) {
      best = { platform, x }; distance = next;
    }
  }
  return best;
}

/** Last resort after passive same-column recovery found no real ledge. Only
 * an existing lower safe viewport-floor fragment may receive a short slide.
 * Keep the original lost x across revalidation: the budget cannot ratchet a
 * body-width farther sideways on each new layout delivery. The caller owns
 * that episode and its finite gravity animation, never an invented floor. */
export function recoverCompanionPassiveFloor(point: Readonly<{ x: number; y: number }>, platforms: readonly Platform[], size: number, originX = point.x): { platform: Platform; x: number } | undefined {
  if (![point.x, point.y, size, originX].every(Number.isFinite) || size <= 0) return undefined;
  const budget = size * .76, leftBudget = originX - budget, rightBudget = originX + budget;
  if (![budget, leftBudget, rightBudget].every(Number.isFinite)) return undefined;
  let best: { platform: Platform; x: number } | undefined, distance = Infinity;
  for (const platform of platforms) {
    const end = platform.x + platform.width;
    if (platform.kind !== "floor" || !/^viewport-floor(?:-\d+)?$/.test(platform.id)
      || ![platform.x, platform.y, platform.width, end].every(Number.isFinite) || platform.width <= 0 || platform.y < point.y - .5) continue;
    const x = Math.max(platform.x, Math.min(end, point.x));
    if (x < leftBudget || x > rightBudget) continue;
    const next = Math.hypot(x - point.x, platform.y - point.y);
    if (Number.isFinite(next) && (next < distance || next === distance && (!best || platform.id < best.platform.id))) {
      best = { platform, x }; distance = next;
    }
  }
  return best;
}

/** Geometry already supplies safe character-centre intervals. Passive landing
 * preserves the current x, including at a safe edge, rather than applying the
 * brain's walking inset or choosing a horizontally distant floor. The caller
 * owns visibility/recovery when no genuine support covers this x. */
export function nearestVerticalCompanionSupport(point: Readonly<{ x: number; y: number }>, platforms: readonly Platform[]): Platform | undefined {
  if (![point.x, point.y].every(Number.isFinite)) return undefined;
  let nearest: Platform | undefined;
  let height = Infinity;
  for (const platform of platforms) {
    const end = platform.x + platform.width;
    if (!platform.id || ![platform.x, platform.y, platform.width, end].every(Number.isFinite)
      || platform.width <= 0 || point.x < platform.x || point.x > end) continue;
    const distance = Math.abs(platform.y - point.y);
    if (!Number.isFinite(distance)) continue;
    if (distance < height || distance === height && nearest?.kind === "floor" && platform.kind !== "floor") {
      nearest = platform; height = distance;
    }
  }
  return nearest;
}

/** Lost calendar ink may leave a genuine card top at the same x. Emergency
 * recovery may use that measured first lower edge, never a different column,
 * an upper card, a control, a house floor, or an invented viewport floor.
 * Ordinary autonomous text ledges retain their established priority. */
export function recoverCompanionVerticalSupport(point: Readonly<{ x: number; y: number }>, platforms: readonly Platform[], landings: readonly Platform[]): Platform | undefined {
  const ordinary = nearestVerticalCompanionSupport(point, platforms);
  if (ordinary) return ordinary;
  const emergency = landings.filter(platform => platform.kind === "card" && platform.manualOnly && /^card-\d+-top(?:-\d+)?$/.test(platform.id)
    || platform.kind === "floor" && /^viewport-floor(?:-\d+)?$/.test(platform.id));
  return firstCompanionSupportBelow(point, emergency) ?? companionViewportFloorAbove(point, emergency);
}

export type CompanionWorldHiddenReason = "drop" | "vertical" | "support" | "home" | "bounds";
/** Interaction windows do not create world support. The renderer separately
 * owns explicit guest/premiere/pickup presentation, so an ordinary modal
 * cannot silently turn an invalid world point into a visible creature. */
export function companionWorldHiddenReason(context: {
  point: Readonly<{ x: number; y: number }>; viewport: Readonly<{ width: number; height: number }>; size: number;
  awaiting: false | "vertical" | "drop"; hasSupport: boolean; pendingMonth: boolean; homeOccluded: boolean; atHome: boolean;
  neutralVerticalRecovery?: boolean;
}): CompanionWorldHiddenReason | null {
  if (context.awaiting) return context.awaiting;
  if (!context.hasSupport && !context.pendingMonth) return "support";
  if (context.homeOccluded && context.atHome) return "home";
  const { point, viewport, size } = context;
  if (![point.x, point.y, viewport.width, viewport.height, size].every(Number.isFinite) || size <= 0
    || point.x < size / 2 + 4 || point.x > viewport.width - size / 2 - 4 || point.y < size * (context.neutralVerticalRecovery ? .82 : 1) + 8 || point.y > viewport.height - 12) return "bounds";
  return null;
}


/** A same-controller restart may retain one already occupied physical ledge.
 * This volatile identity never enters positionMemory, storage or public DTOs. */
type RestartNode = Readonly<{ isConnected: boolean }>;
type RestartFrame = Readonly<{ left: number; top: number; width?: number; height?: number; identity?: string }>;
export type CompanionRestartSupportState = Readonly<{
  enabled: boolean; visible: boolean; blocked: boolean; reduced: boolean;
  held: boolean; airborne: boolean; carrying: boolean; owned: boolean; resting: boolean;
}>;
export type CompanionRestartSupport = Readonly<{
  point: Readonly<{ x: number; y: number }>; monthKey: string;
  root: RestartNode; source: RestartNode; frame: RestartFrame;
  platform: Readonly<Platform>; viewport: Readonly<{ width: number; height: number }>; size: number;
}>;
type RestartSupportContext = Readonly<{
  point: Readonly<{ x: number; y: number }>; monthKey: string; root: RestartNode;
  anchor?: RestartFrame & { element?: RestartNode }; platform?: Readonly<Platform>;
  viewport: Readonly<{ width: number; height: number }>; size: number;
  state: CompanionRestartSupportState;
}>;
const restartSupportAllowed = (state: CompanionRestartSupportState) => state.enabled && state.visible && !state.blocked && !state.reduced
  && !state.held && !state.airborne && !state.carrying && !state.owned && !state.resting;
const validRestartFrame = (frame: RestartFrame | undefined): frame is RestartFrame & { width: number; height: number } => Boolean(frame
  && [frame.left, frame.top, frame.width, frame.height].every(value => typeof value === "number" && Number.isFinite(value)) && frame.width! > 0 && frame.height! > 0);

export type CompanionViewportFloorCheckpoint = Readonly<{
  point: Readonly<{ x: number; y: number }>; platform: Readonly<Platform>; root: RestartNode;
  viewport: Readonly<{ width: number; height: number }>; size: number; monthKey: string; pathname: string;
}>;
type ViewportFloorContext = Omit<RestartSupportContext, "anchor"> & { pathname: string };
/** A viewport floor is the same screen plane across months, without a DOM
 * source. This volatile checkpoint lends presentation only until the first
 * real measurement. It is never a calendar ledge or an autonomous world scan. */
export function captureCompanionViewportFloor(context: ViewportFloorContext): CompanionViewportFloorCheckpoint | undefined {
  const { state, platform, point, viewport, size } = context;
  if (!state.enabled || !state.visible || state.blocked || state.reduced || state.held || state.airborne || state.carrying || state.owned
    || !context.root.isConnected || !context.monthKey || !context.pathname
    || !platform || !/^viewport-floor(?:-\d+)?$/.test(platform.id) || platform.kind !== "floor" || platform.bodyOnly || platform.manualOnly
    || ![point.x, point.y, platform.x, platform.y, platform.width, platform.x + platform.width, viewport.width, viewport.height, size].every(Number.isFinite)
    || size <= 0 || platform.width <= 0 || viewport.width <= size || viewport.height <= size
    || point.x < size / 2 + 4 || point.x > viewport.width - size / 2 - 4 || point.y < size + 8 || point.y > viewport.height - 12
    || point.x < platform.x || point.x > platform.x + platform.width || Math.abs(point.y - platform.y) >= 1) return;
  return { point: { ...point }, platform: { id: platform.id, x: platform.x, y: platform.y, width: platform.width, kind: "floor" },
    root: context.root, viewport: { ...viewport }, size, monthKey: context.monthKey, pathname: context.pathname };
}
export function restoreCompanionViewportFloor(snapshot: CompanionViewportFloorCheckpoint | undefined, context: Omit<ViewportFloorContext, "platform">): CompanionViewportFloorCheckpoint | undefined {
  if (!snapshot || snapshot.root !== context.root || snapshot.pathname !== context.pathname || snapshot.monthKey === context.monthKey
    || snapshot.size !== context.size || snapshot.viewport.width !== context.viewport.width || snapshot.viewport.height !== context.viewport.height
    || snapshot.point.x !== context.point.x || snapshot.point.y !== context.point.y) return;
  return captureCompanionViewportFloor({ ...context, platform: snapshot.platform });
}

/** Capture only an actual grounded non-home support. Actor opacity/hidden is
 * deliberately absent: closing the old controller hides it during a modal. */
export function captureCompanionRestartSupport(context: RestartSupportContext): CompanionRestartSupport | undefined {
  const { platform, point, anchor, state, viewport, size } = context;
  const source = anchor?.element;
  if (!restartSupportAllowed(state) || !context.monthKey || !context.root.isConnected || !source?.isConnected || !validRestartFrame(anchor)
    || !platform?.id || /^companion-(?:home|panel-floor)/.test(platform.id) || platform.bodyOnly || platform.kind === "hide" || platform.kind === "control"
    || ![point.x, point.y, platform.x, platform.y, platform.width, platform.x + platform.width, viewport.width, viewport.height, size].every(Number.isFinite)
    || size <= 0 || viewport.width <= size || viewport.height <= size || platform.width <= 0
    || point.y < size + 8 || point.y > viewport.height - 12 || point.x < platform.x || point.x > platform.x + platform.width || Math.abs(point.y - platform.y) > 2) return;
  return { point: { ...point }, monthKey: context.monthKey, root: context.root, source,
    frame: { left: anchor.left, top: anchor.top, width: anchor.width, height: anchor.height, identity: anchor.identity },
    platform: { id: platform.id, x: platform.x, y: platform.y, width: platform.width, kind: platform.kind,
      ...(platform.manualOnly ? { manualOnly: true } : {}), ...(platform.bodyOnly ? { bodyOnly: true } : {}) }, viewport: { ...viewport }, size };
}

/** Reuse the exact point only after the new measured normal/landing snapshot
 * proves the same live DOM, month, frame and safe span. Any reflow/deletion,
 * different surface or newly owned action falls back to existing recovery. */
export function resolveCompanionRestartSupport(snapshot: CompanionRestartSupport | undefined, context: RestartSupportContext): Readonly<Platform> | undefined {
  const current = captureCompanionRestartSupport(context);
  if (!snapshot || !current || snapshot.root !== current.root || snapshot.source !== current.source || !snapshot.source.isConnected
    || snapshot.monthKey !== current.monthKey || snapshot.size !== current.size || snapshot.viewport.width !== current.viewport.width || snapshot.viewport.height !== current.viewport.height
    || snapshot.point.x !== current.point.x || snapshot.point.y !== current.point.y
    || ["left", "top", "width", "height", "identity"].some(key => snapshot.frame[key as keyof RestartFrame] !== current.frame[key as keyof RestartFrame])
    || ["id", "x", "y", "width", "kind", "manualOnly", "bodyOnly"].some(key => snapshot.platform[key as keyof Platform] !== current.platform[key as keyof Platform])) return;
  return context.platform;
}

/** An ordinary modal can temporarily remove or clip this already occupied
 * card's safe span. Keep only its original checkpoint, hidden and unadopted,
 * while the same root/source and inactive state still own that point. Missing
 * geometry proves no support: only a fresh strict resolve after close may
 * adopt it. Any supplied geometry must match the same frame and safe subset. */
export function deferCompanionRestartSupport(snapshot: CompanionRestartSupport | undefined, context: RestartSupportContext, ordinaryModal: boolean): CompanionRestartSupport | undefined {
  const { platform, anchor, point, state, viewport, size } = context, prior = snapshot?.platform;
  if (!ordinaryModal || !snapshot || !prior || !restartSupportAllowed(state)
    || !context.root.isConnected || !snapshot.source.isConnected || context.root !== snapshot.root
    || !context.monthKey || context.monthKey !== snapshot.monthKey || !validRestartFrame(snapshot.frame)
    || size !== snapshot.size || viewport.width !== snapshot.viewport.width || viewport.height !== snapshot.viewport.height
    || point.x !== snapshot.point.x || point.y !== snapshot.point.y
    || !prior.id || /^companion-(?:home|panel-floor)/.test(prior.id) || prior.bodyOnly || prior.kind === "hide" || prior.kind === "control"
    || ![point.x, point.y, prior.x, prior.y, prior.width, prior.x + prior.width, viewport.width, viewport.height, size].every(Number.isFinite)
    || size <= 0 || viewport.width <= size || viewport.height <= size || prior.width <= 0
    || point.y < size + 8 || point.y > viewport.height - 12 || point.x < prior.x || point.x > prior.x + prior.width || Math.abs(point.y - prior.y) > 2) return;
  // No current physical claim is made here. Both proofs must be absent;
  // an incomplete pair or a positively contradictory measurement is revoked.
  if (!platform && !anchor) return snapshot;
  if (!platform || !anchor || anchor.element !== snapshot.source || !validRestartFrame(anchor)
    || ["left", "top", "width", "height", "identity"].some(key => snapshot.frame[key as keyof RestartFrame] !== anchor[key as keyof RestartFrame])
    || !platform.id || /^companion-(?:home|panel-floor)/.test(platform.id) || platform.bodyOnly || platform.kind === "hide" || platform.kind === "control"
    || ["id", "y", "kind", "manualOnly", "bodyOnly"].some(key => prior[key as keyof Platform] !== platform[key as keyof Platform])
    || ![platform.x, platform.y, platform.width, platform.x + platform.width].every(Number.isFinite) || platform.width <= 0
    || platform.x < prior.x || platform.x + platform.width > prior.x + prior.width) return;
  return snapshot;
}

/** An unadopted restart checkpoint owns no visible grounded pose. Keep only
 * that pending paint hidden until the existing fresh strict resolve consumes
 * it. Physical/manual owners retain their normal paint; this grants no support
 * and never changes the checkpoint, world point, geometry or recovery policy. */
export function companionRestartPaintPending(snapshot: CompanionRestartSupport | undefined, support: string, owned: boolean): boolean {
  return Boolean(snapshot && !support && !owned);
}
