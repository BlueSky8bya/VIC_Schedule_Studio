/** Device-local disclosure state only. No account or calendar content. */
export const PANEL_SECTION_KEYS = ["tag-filter", "season", "companion-home"] as const;
export type PanelSectionKey = (typeof PANEL_SECTION_KEYS)[number];
export type PanelSectionPreferences = Record<PanelSectionKey, boolean>;
export const PANEL_SECTION_PREFERENCES_KEY = "vic.panelSections";
export const PANEL_SECTION_PREFERENCES_EVENT = "vic:panel-sections";
export const DEFAULT_PANEL_SECTION_PREFERENCES: Readonly<PanelSectionPreferences> = Object.freeze({ "tag-filter": true, season: true, "companion-home": true });

let owner: Window | undefined;
let current: PanelSectionPreferences = { ...DEFAULT_PANEL_SECTION_PREFERENCES };
let lastRaw: string | null | undefined;
let unwritten: { raw: string | null | undefined } | undefined;

export function normalizePanelSectionPreferences(value: unknown): PanelSectionPreferences {
  const next = { ...DEFAULT_PANEL_SECTION_PREFERENCES };
  if (!value || typeof value !== "object" || Array.isArray(value)) return next;
  const source = value as Record<string, unknown>;
  for (const key of PANEL_SECTION_KEYS) if (typeof source[key] === "boolean") next[key] = source[key];
  return next;
}

function parse(raw: string | null): PanelSectionPreferences {
  try {
    const value: unknown = raw ? JSON.parse(raw) : null;
    return value && typeof value === "object" && !Array.isArray(value) && "version" in value && value.version === 1
      ? normalizePanelSectionPreferences(value) : { ...DEFAULT_PANEL_SECTION_PREFERENCES };
  } catch { return { ...DEFAULT_PANEL_SECTION_PREFERENCES }; }
}

function browser(): Window | undefined {
  if (typeof window === "undefined") return undefined;
  if (owner !== window) {
    owner = window; current = { ...DEFAULT_PANEL_SECTION_PREFERENCES }; lastRaw = undefined; unwritten = undefined;
  }
  return window;
}

export function getPanelSectionPreferences(): PanelSectionPreferences {
  const target = browser();
  if (!target) return { ...DEFAULT_PANEL_SECTION_PREFERENCES };
  let raw: string | null;
  try { raw = target.localStorage.getItem(PANEL_SECTION_PREFERENCES_KEY); }
  catch { return { ...current }; }
  lastRaw = raw;
  // Readable stale bytes must not undo this tab's choice after a quota failure.
  if (unwritten && (unwritten.raw === undefined || unwritten.raw === raw)) return { ...current };
  unwritten = undefined; current = parse(raw);
  return { ...current };
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
  current = { ...getPanelSectionPreferences(), [key]: expanded };
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
  return () => {
    target.removeEventListener(PANEL_SECTION_PREFERENCES_EVENT, changed);
    target.removeEventListener("storage", stored);
  };
}

/** Root-layout prepaint bootstrap. Fixed keys + strict booleans mirror parse();
 * the untrusted stored object is never copied into markup or script text. */
export const PANEL_SECTION_BOOTSTRAP = `(function(){try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(PANEL_SECTION_PREFERENCES_KEY)})||"null"),k=${JSON.stringify(PANEL_SECTION_KEYS)},c=[];if(p&&typeof p==="object"&&!Array.isArray(p)&&p.version===1){for(var i=0;i<k.length;i++)if(p[k[i]]===false)c.push(k[i])}if(c.length)document.documentElement.setAttribute("data-panel-sections",c.join(" "));else document.documentElement.removeAttribute("data-panel-sections")}catch(e){}})();`;
