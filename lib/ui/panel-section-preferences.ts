import { POSTER_AGENDA_QUERY } from "./breakpoints";
import { COMPANION_PREFERENCES_KEY, getCompanionPreferences, subscribeCompanionPreferences } from "./viewer-companion/preferences";

/** Device-local disclosure state only. No account or calendar content. */
export const PANEL_SECTION_KEYS = ["tag-filter", "season", "companion-home"] as const;
export type PanelSectionKey = (typeof PANEL_SECTION_KEYS)[number];
export type PanelSectionPreferences = Record<PanelSectionKey, boolean>;
export const PANEL_SECTION_PREFERENCES_KEY = "vic.panelSections";
export const PANEL_SECTION_PREFERENCES_EVENT = "vic:panel-sections";
export const DEFAULT_PANEL_SECTION_PREFERENCES: Readonly<PanelSectionPreferences> = Object.freeze({ "tag-filter": true, season: true, "companion-home": true });
export const COMPANION_PANEL_SECTION_PREFERENCES: Readonly<PanelSectionPreferences> = Object.freeze({ "tag-filter": false, season: false, "companion-home": true });

let owner: Window | undefined;
let current: Partial<PanelSectionPreferences> = {};
let lastRaw: string | null | undefined;
let unwritten: { raw: string | null | undefined } | undefined;
let media: MediaQueryList | undefined;

export function normalizePanelSectionPreferences(value: unknown, defaults: Readonly<PanelSectionPreferences> = DEFAULT_PANEL_SECTION_PREFERENCES): PanelSectionPreferences {
  const next = { ...defaults };
  if (!value || typeof value !== "object" || Array.isArray(value)) return next;
  const source = value as Record<string, unknown>;
  for (const key of PANEL_SECTION_KEYS) if (typeof source[key] === "boolean") next[key] = source[key];
  return next;
}

function parse(raw: string | null): Partial<PanelSectionPreferences> {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    if (!value || typeof value !== "object" || Array.isArray(value) || !("version" in value) || value.version !== 1) return {};
    const source = value as Record<string, unknown>, next: Partial<PanelSectionPreferences> = {};
    for (const key of PANEL_SECTION_KEYS) if (typeof source[key] === "boolean") next[key] = source[key];
    return next;
  } catch { return {}; }
}

function browser(): Window | undefined {
  if (typeof window === "undefined") return undefined;
  if (owner !== window) {
    owner = window; current = {}; lastRaw = undefined; unwritten = undefined; media = undefined;
  }
  return window;
}

function capability(target: Window): MediaQueryList | undefined {
  try { return media ?? (media = target.matchMedia?.(POSTER_AGENDA_QUERY)); } catch { return undefined; }
}

function defaults(target: Window): Readonly<PanelSectionPreferences> {
  // Match the companion's shared capability. Mobile/unknown devices keep the
  // ordinary open filter; an explicit OFF never collapses it on first visit.
  return capability(target)?.matches === false && getCompanionPreferences().enabled
    ? COMPANION_PANEL_SECTION_PREFERENCES : DEFAULT_PANEL_SECTION_PREFERENCES;
}

export function getPanelSectionPreferences(): PanelSectionPreferences {
  const target = browser();
  if (!target) return { ...DEFAULT_PANEL_SECTION_PREFERENCES };
  let raw: string | null;
  try { raw = target.localStorage.getItem(PANEL_SECTION_PREFERENCES_KEY); }
  catch { return normalizePanelSectionPreferences(current, defaults(target)); }
  lastRaw = raw;
  // Readable stale bytes must not undo this tab's choice after a quota failure.
  if (unwritten && (unwritten.raw === undefined || unwritten.raw === raw)) return normalizePanelSectionPreferences(current, defaults(target));
  unwritten = undefined; current = parse(raw);
  return normalizePanelSectionPreferences(current, defaults(target));
}

/** The same marker is set before paint and after hydration. It affects only
 * collapsible sections on the viewer, studio and preview surfaces. */
export function applyPanelSectionPreferences(): void {
  const target = browser();
  if (!target?.document?.documentElement) return;
  const preferences = getPanelSectionPreferences();
  const collapsed = PANEL_SECTION_KEYS.filter(key => !preferences[key]).join(" ");
  if (collapsed) target.document.documentElement.setAttribute("data-panel-sections", collapsed);
  else target.document.documentElement.removeAttribute("data-panel-sections");
}

export function setPanelSectionExpanded(key: PanelSectionKey, expanded: boolean): void {
  if (!PANEL_SECTION_KEYS.includes(key) || typeof expanded !== "boolean") return;
  const target = browser();
  if (!target) return;
  getPanelSectionPreferences();
  // Persist actual choices only. Copying defaults into storage would turn an
  // untouched section into a false override after changing the master switch.
  // Existing full v1 records remain valid and are preserved as user choices.
  current = { ...current, [key]: expanded };
  try {
    const raw = JSON.stringify({ version: 1, ...current });
    target.localStorage.setItem(PANEL_SECTION_PREFERENCES_KEY, raw);
    lastRaw = raw; unwritten = undefined;
  } catch { unwritten = { raw: lastRaw }; }
  applyPanelSectionPreferences();
  target.dispatchEvent(new Event(PANEL_SECTION_PREFERENCES_EVENT));
}

/** Same-tab consumers and another browser tab share one allowlisted state. */
export function subscribePanelSectionPreferences(listener: () => void): () => void {
  const target = browser();
  if (!target) return () => {};
  const changed = () => { applyPanelSectionPreferences(); listener(); };
  const stored = (event: StorageEvent) => {
    if (event.key !== PANEL_SECTION_PREFERENCES_KEY && event.key !== null) return;
    unwritten = undefined;
    if (event.key === null || event.newValue === null || typeof event.newValue === "string") {
      lastRaw = event.key === null ? null : event.newValue;
      current = parse(lastRaw);
    }
    changed();
  };
  target.addEventListener(PANEL_SECTION_PREFERENCES_EVENT, changed);
  target.addEventListener("storage", stored);
  let enabled = getCompanionPreferences().enabled;
  // The companion store consumes storage/reset and failed-write fallbacks
  // before notifying us. Raw-event listener order must not revive stale ON.
  const stopCompanion = subscribeCompanionPreferences(next => {
    if (next.enabled === enabled) return;
    enabled = next.enabled; changed();
  });
  const query = capability(target);
  query?.addEventListener?.("change", changed);
  return () => {
    target.removeEventListener(PANEL_SECTION_PREFERENCES_EVENT, changed);
    target.removeEventListener("storage", stored);
    stopCompanion();
    query?.removeEventListener?.("change", changed);
  };
}

/** Root-layout prepaint bootstrap. Fixed keys + strict booleans mirror parse();
 * the untrusted stored object is never copied into markup or script text. */
export const PANEL_SECTION_BOOTSTRAP = `(function(){var d=${JSON.stringify(DEFAULT_PANEL_SECTION_PREFERENCES)},k=${JSON.stringify(PANEL_SECTION_KEYS)},c=[],r,p,m,on=false;try{if(typeof matchMedia==="function"&&!matchMedia(${JSON.stringify(POSTER_AGENDA_QUERY)}).matches){try{r=localStorage.getItem(${JSON.stringify(COMPANION_PREFERENCES_KEY)})}catch(e){r=null}if(r===null)on=true;else{m=JSON.parse(r);on=!!(m&&typeof m==="object"&&!Array.isArray(m)&&m.version===1&&(!("enabled" in m)||m.enabled===true))}}}catch(e){}if(on)d=${JSON.stringify(COMPANION_PANEL_SECTION_PREFERENCES)};try{p=JSON.parse(localStorage.getItem(${JSON.stringify(PANEL_SECTION_PREFERENCES_KEY)})||"null");if(p&&typeof p==="object"&&!Array.isArray(p)&&p.version===1){for(var i=0;i<k.length;i++)if(typeof p[k[i]]==="boolean")d[k[i]]=p[k[i]]}}catch(e){}for(var j=0;j<k.length;j++)if(d[k[j]]===false)c.push(k[j]);if(c.length)document.documentElement.setAttribute("data-panel-sections",c.join(" "));else document.documentElement.removeAttribute("data-panel-sections")}());`;
