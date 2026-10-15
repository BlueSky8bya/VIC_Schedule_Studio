/** Companion-only heart souvenirs. Never click or mutate the human heart. */
export const COMPANION_HEARTS_KEY = "vic.viewerCompanion.hearts";
export const MAX_COMPANION_HEARTS = 128;
const HEART_SELECTOR = ".public-event[data-eventid] .event-heart,.agenda-event[data-eventid] .event-heart,.agenda-item[data-eventid] .event-heart";
const CARD_SELECTOR = ".public-event[data-eventid],.agenda-event[data-eventid],.agenda-item[data-eventid]";
const validPublicId = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/.test(value);
export type CompanionHeartResult = "added" | "removed" | "blocked" | "missing";
export type CompanionHearts = { attemptAt: (point: { x: number; y: number }) => CompanionHeartResult; dispose: () => void };

/** Bounded explicit public ids only; no titles, dates, tags, counts or identity. */
export function readCompanionHeartIds(raw: string | null): string[] {
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== "object" || !("version" in parsed) || parsed.version !== 1 || !("ids" in parsed) || !Array.isArray(parsed.ids)) return [];
    const unique = new Set<string>();
    for (const id of parsed.ids.slice(-MAX_COMPANION_HEARTS * 4)) {
      if (!validPublicId(id)) continue;
      unique.delete(id); unique.add(id);
    }
    return [...unique].slice(-MAX_COMPANION_HEARTS);
  } catch { return []; }
}

export function createCompanionHearts(root: HTMLElement): CompanionHearts {
  const win = root.ownerDocument.defaultView;
  if (!win) return { attemptAt: () => "missing", dispose: () => {} };
  let disposed = false;
  const marked = new Set<HTMLElement>();
  const blocked = new Set<HTMLElement>();
  let remembered = new Set<string>();
  let storedIds = new Set<string>();
  // Keep only failed local edits over the latest stored snapshot. A union of
  // old/current ids cannot represent removal and resurrects deleted souvenirs.
  const pending = new Map<string, boolean>();
  const refreshSaved = (explicitClear = false) => {
    try {
      const raw = win.localStorage.getItem(COMPANION_HEARTS_KEY);
      if (explicitClear && raw === null) pending.clear();
      const saved = new Set(readCompanionHeartIds(raw));
      storedIds = new Set(saved);
      for (const [id, present] of pending) {
        if (saved.has(id) === present) pending.delete(id);
        else if (present) saved.add(id);
        else saved.delete(id);
      }
      remembered = new Set([...saved].slice(-MAX_COMPANION_HEARTS));
      for (const [id, present] of pending) if (present && !remembered.has(id)) pending.delete(id);
    } catch { /* Blocked reads never erase this tab's last local interaction. */ }
  };
  refreshSaved();
  const idFor = (heart: HTMLElement) => {
    const card = heart.closest<HTMLElement>(CARD_SELECTOR);
    const id = card?.dataset.eventid;
    return card && root.contains(card) && !card.classList.contains("teaser") && validPublicId(id) ? id : undefined;
  };
  const hearts = () => [...root.querySelectorAll<HTMLElement>(HEART_SELECTOR)];
  function sync() {
    if (disposed) return;
    const nodes = hearts();
    // A spanning event can have several cards; one human-selected copy wins.
    const human = new Set(nodes.filter(node => node.getAttribute("aria-pressed") === "true").map(idFor).filter(Boolean));
    const next = new Set<HTMLElement>();
    const nextBlocked = new Set<HTMLElement>();
    for (const node of nodes) {
      const id = idFor(node);
      if (id && human.has(id)) {
        if (!node.hasAttribute("data-companion-heart-blocked")) node.setAttribute("data-companion-heart-blocked", "");
        nextBlocked.add(node);
      } else if (node.hasAttribute("data-companion-heart-blocked")) node.removeAttribute("data-companion-heart-blocked");
      if (id && remembered.has(id) && !human.has(id)) {
        if (!node.hasAttribute("data-companion-hearted")) node.setAttribute("data-companion-hearted", "");
        next.add(node);
      } else if (node.hasAttribute("data-companion-hearted")) node.removeAttribute("data-companion-hearted");
    }
    for (const node of marked) if (!next.has(node)) node.removeAttribute("data-companion-hearted");
    for (const node of blocked) if (!nextBlocked.has(node)) node.removeAttribute("data-companion-heart-blocked");
    marked.clear(); for (const node of next) marked.add(node);
    blocked.clear(); for (const node of nextBlocked) blocked.add(node);
  }
  function visible(node: HTMLElement) {
    if (!node.isConnected || !root.isConnected || node.hasAttribute("disabled") || node.getAttribute("aria-disabled") === "true") return false;
    for (let parent: HTMLElement | null = node; parent; parent = parent.parentElement) {
      const style = win!.getComputedStyle(parent);
      if (parent.hidden || parent.inert || parent.getAttribute("aria-hidden") === "true" || style.display === "none" || style.visibility === "hidden" || style.visibility === "collapse" || Number(style.opacity || 1) <= .05) return false;
    }
    return true;
  }
  function attemptAt(point: { x: number; y: number }): CompanionHeartResult {
    if (disposed || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return "missing";
    const nodes = hearts();
    let target: HTMLElement | undefined;
    let nearest = 24;
    for (const node of nodes) {
      if (!idFor(node) || !visible(node)) continue;
      const rect = node.getBoundingClientRect();
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      if (rect.width <= 0 || rect.height <= 0 || x < 0 || x > win!.innerWidth || y < 0 || y > win!.innerHeight) continue;
      const distance = Math.hypot(x - point.x, y - point.y);
      if (distance < nearest) { target = node; nearest = distance; }
    }
    if (!target) return "missing";
    const id = idFor(target)!;
    // A human's red selection always wins, including a different spanning copy.
    refreshSaved();
    if (nodes.some(node => idFor(node) === id && node.getAttribute("aria-pressed") === "true")) { sync(); return "blocked"; }
    const removing = remembered.has(id);
    if (removing) remembered.delete(id);
    else remembered.add(id);
    if (storedIds.has(id) === !removing) pending.delete(id);
    else pending.set(id, !removing);
    remembered = new Set([...remembered].slice(-MAX_COMPANION_HEARTS));
    for (const [key, present] of pending) if (present && !remembered.has(key)) pending.delete(key);
    try {
      win!.localStorage.setItem(COMPANION_HEARTS_KEY, JSON.stringify({ version: 1, ids: [...remembered] }));
      storedIds = new Set(remembered);
      pending.clear();
    }
    catch { /* The current companion still remembers its own local gesture. */ }
    sync();
    return removing ? "removed" : "added";
  }
  const observer = new MutationObserver(sync);
  observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-pressed", "data-eventid", "class", "data-companion-hearted"] });
  const stored = (event: StorageEvent) => {
    if (event.key === COMPANION_HEARTS_KEY || event.key === null) {
      // Read current storage, not a possibly delayed event.newValue. Explicit
      // device-memory clearing wins once the current stored value is absent.
      refreshSaved(event.key === null || event.newValue === null);
      sync();
    }
  };
  win.addEventListener("storage", stored);
  win.addEventListener("resize", sync);
  sync();
  return { attemptAt, dispose: () => {
    if (disposed) return;
    disposed = true;
    observer.disconnect();
    win.removeEventListener("storage", stored);
    win.removeEventListener("resize", sync);
    for (const node of marked) node.removeAttribute("data-companion-hearted");
    for (const node of blocked) node.removeAttribute("data-companion-heart-blocked");
    marked.clear();
    blocked.clear();
  } };
}
