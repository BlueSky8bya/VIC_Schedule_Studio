// Staged first paint of the one shared 빅타민 집 (2026-11-13 owner).
//
// The room used to appear piece by piece in whatever order its WebP layers
// finished downloading, and the pet often stood in an empty box before the
// floor existed. The single CompanionHome now reveals fixed layers in order:
// floor (room picture) → wall (window·curtain·shelf·lamp) → furniture
// (sofa·TV·wash pad) → props (toy box·dispenser·bin) → pet. Every layer keeps
// its layout box; only `filter: opacity()` hides paint, so the runtime's
// opacity/visibility geometry checks never see a hidden room. A layer waits
// for its own images to decode, never longer than one bounded timeout, and a
// failed image settles immediately so later layers are never held forever.

export const COMPANION_HOME_REVEAL_LAYERS = ["floor", "wall", "furniture", "props", "pet"] as const;
export type CompanionHomeRevealLayer = typeof COMPANION_HOME_REVEAL_LAYERS[number];
/** Minimum gap between two consecutive layers (the floor itself has none). */
export const COMPANION_HOME_REVEAL_STAGGER_MS = 140;
/** Longest one layer may wait for its pictures after the previous layer. */
export const COMPANION_HOME_REVEAL_LAYER_TIMEOUT_MS = 1500;
/** The runtime may mount before the room carrier; an unclaimed pet hold ends here. */
export const COMPANION_HOME_REVEAL_HOLD_MS = 900;
/** Covers the shared fade token before the reveal attributes are cleared. */
const REVEAL_SETTLE_MS = 400;
const HTML_ATTR = "data-companion-home-reveal", ROOM_ATTR = "data-home-reveal";

/** When layer `index` appears, given when its pictures settled (undefined = not yet/never). */
export function companionHomeRevealAt(index: number, previousAt: number, readyAt: number | undefined, stagger = COMPANION_HOME_REVEAL_STAGGER_MS, timeout = COMPANION_HOME_REVEAL_LAYER_TIMEOUT_MS): number {
  const limit = previousAt + timeout;
  if (readyAt === undefined) return limit;
  return Math.min(limit, Math.max(readyAt, previousAt + (index === 0 ? 0 : stagger)));
}

/** Whole plan for known settle times; the live controller applies the same rule step by step. */
export function planCompanionHomeReveal(start: number, readyAt: readonly (number | undefined)[], stagger = COMPANION_HOME_REVEAL_STAGGER_MS, timeout = COMPANION_HOME_REVEAL_LAYER_TIMEOUT_MS): number[] {
  const times: number[] = [];
  readyAt.forEach((ready, index) => { times.push(companionHomeRevealAt(index, index ? times[index - 1] : start, ready, stagger, timeout)); });
  return times;
}

// One reveal per page. Later remounts, side switches and preview round trips
// reuse the already decoded room instead of replaying the sequence.
let revealed = false, holdTimer: ReturnType<typeof setTimeout> | undefined, holdOwner: object | undefined;

function setTokens(element: Element, name: string, tokens: readonly string[]) { element.setAttribute(name, tokens.join(" ")); }

/** Keeps the pet (and its sofa foreground copy) unpainted until a visible room claims the order. */
export function holdCompanionHomeReveal(document: Document): () => void {
  if (revealed || holdOwner) return () => {};
  const html = document.documentElement, owner = {};
  holdOwner = owner; html.setAttribute(HTML_ATTR, "");
  holdTimer = setTimeout(() => { if (holdOwner === owner) releaseHold(html); }, COMPANION_HOME_REVEAL_HOLD_MS);
  return () => { if (holdOwner === owner) releaseHold(html); };
}

function releaseHold(html: HTMLElement) {
  clearTimeout(holdTimer); holdTimer = undefined; holdOwner = undefined;
  html.removeAttribute(HTML_ATTR);
}

const URL_PATTERN = /url\(\s*(['"]?)(.*?)\1\s*\)/g;
function cssUrls(style: CSSStyleDeclaration, into: Set<string>) {
  for (const value of [style.backgroundImage, style.borderImageSource, style.maskImage]) {
    if (!value || value === "none") continue;
    for (const match of value.matchAll(URL_PATTERN)) if (match[2]) into.add(match[2]);
  }
}

function settleImage(image: HTMLImageElement): Promise<void> {
  const decode = () => image.decode().catch(() => undefined);
  if (image.complete) return image.naturalWidth ? decode() : Promise.resolve();
  return new Promise<void>(resolve => {
    const done = () => { image.removeEventListener("load", done); image.removeEventListener("error", done); resolve(); };
    image.addEventListener("load", done); image.addEventListener("error", done);
  }).then(() => image.naturalWidth ? decode() : undefined);
}

function settleUrl(url: string): Promise<void> {
  const image = new Image(); image.decoding = "async"; image.src = url;
  return image.decode().catch(() => undefined);
}

function layerAssets(win: Window, roots: readonly Element[]): Promise<void> {
  const urls = new Set<string>(), images: HTMLImageElement[] = [];
  for (const root of roots) for (const node of [root, ...root.querySelectorAll("*")]) {
    if (node instanceof HTMLImageElement) { images.push(node); continue; }
    cssUrls(win.getComputedStyle(node), urls);
  }
  return Promise.all([...images.map(settleImage), ...[...urls].map(url => settleUrl(url))]).then(() => undefined);
}

function roomShown(room: HTMLElement) { return room.isConnected && room.getClientRects().length > 0; }

/** Runs the ordered reveal on one mounted room. Returns its cleanup. */
export function revealCompanionHome(room: HTMLElement): () => void {
  const document = room.ownerDocument, win = document.defaultView, html = document.documentElement;
  if (revealed || !win) { if (holdOwner && !revealed) releaseHold(html); return () => {}; }
  let timer: ReturnType<typeof setTimeout> | undefined, observer: ResizeObserver | undefined, disposed = false, claimed = false;
  const shown: CompanionHomeRevealLayer[] = [];
  const clear = () => {
    clearTimeout(timer); observer?.disconnect(); observer = undefined;
    room.removeAttribute(ROOM_ATTR);
    if (claimed) html.removeAttribute(HTML_ATTR);
  };
  const start = () => {
    observer?.disconnect(); observer = undefined;
    // The pet is staged only when this room claimed it on its first paint.
    // A room first opened later must not hide an already living pet.
    claimed = holdOwner !== undefined;
    if (claimed) { clearTimeout(holdTimer); holdTimer = undefined; holdOwner = undefined; setTokens(html, HTML_ATTR, shown); }
    setTokens(room, ROOM_ATTR, shown);
    const layerElements = (layer: CompanionHomeRevealLayer) => [...room.querySelectorAll(`[data-home-layer="${layer}"]`)];
    const assets: Record<CompanionHomeRevealLayer, () => Promise<void>> = {
      // The floor is the room box and its daylight copy only, not descendants.
      floor: () => {
        const urls = new Set<string>();
        cssUrls(win.getComputedStyle(room), urls); cssUrls(win.getComputedStyle(room, "::before"), urls);
        return Promise.all([...urls].map(url => settleUrl(url))).then(() => undefined);
      },
      wall: () => layerAssets(win, layerElements("wall")),
      furniture: () => layerAssets(win, layerElements("furniture")),
      props: () => layerAssets(win, layerElements("props")),
      pet: () => layerAssets(win, [...document.querySelectorAll(".vc-companion .vc-sprite")]),
    };
    const order = claimed ? COMPANION_HOME_REVEAL_LAYERS : COMPANION_HOME_REVEAL_LAYERS.filter(layer => layer !== "pet");
    // Room layers begin decoding now; only the paint order is serialized. The
    // pet's atlas is chosen by the runtime later, so it is read at its turn.
    const settle = (layer: CompanionHomeRevealLayer) => { const at: { value?: number } = {}; const promise = assets[layer]().then(() => { at.value = performance.now(); }); return { at, promise }; };
    const settled = order.map(layer => layer === "pet" ? undefined : settle(layer));
    let previous = performance.now();
    const step = (index: number) => {
      if (disposed) return;
      if (index >= order.length) { revealed = true; timer = setTimeout(clear, REVEAL_SETTLE_MS); return; }
      const { at, promise } = settled[index] ??= settle(order[index]);
      let done = false;
      const show = () => {
        if (done || disposed) return; done = true; clearTimeout(timer);
        const now = performance.now(), when = companionHomeRevealAt(index, previous, at.value ?? now);
        timer = setTimeout(() => {
          if (disposed) return;
          previous = performance.now(); shown.push(order[index]);
          setTokens(room, ROOM_ATTR, shown); if (claimed) setTokens(html, HTML_ATTR, shown);
          step(index + 1);
        }, Math.max(0, when - now));
      };
      void promise.then(show);
      // A slow or stalled picture never holds the following layers forever.
      timer = setTimeout(show, Math.max(0, previous + COMPANION_HOME_REVEAL_LAYER_TIMEOUT_MS - performance.now()));
    };
    step(0);
  };
  if (roomShown(room)) start();
  else {
    // A carrier still being placed, a collapsed panel or a closed compact
    // house: stay unpainted until it is laid out. The pet hold keeps only its
    // own short fallback, so a house that stays closed never hides the pet.
    setTokens(room, ROOM_ATTR, shown);
    if (typeof win.ResizeObserver === "function") {
      observer = new win.ResizeObserver(() => { if (!disposed && !revealed && roomShown(room)) start(); });
      observer.observe(room);
    } else start();
  }
  return () => { disposed = true; clear(); };
}
