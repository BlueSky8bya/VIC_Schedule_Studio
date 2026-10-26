/** Automatic, bounded, device-local recurrence evidence. No network, DOM text,
 * event/platform IDs, identity, URLs, learned memory or activity analytics. */
import { getTodayKst } from "@/lib/calendar/month";
export const COMPANION_VISIBILITY_KEY = "vic.companion.visibility.v1";
export const COMPANION_VISIBILITY_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const COMPANION_VISIBILITY_MAX_RECORDS = 24;
export const COMPANION_VISIBILITY_MAX_BYTES = 24 * 1024;
const enums = {
  stage: ["observed", "recovery", "recovered", "unavailable", "cancelled"],
  reason: ["visible", "schedule-hide", "home-hidden", "offscreen", "lost-support", "owned", "pending"],
  support: ["home", "floor", "card", "calendar", "control", "none"],
  action: ["idle", "panel", "walk", "jump", "other"],
  side: ["left", "right", "none"],
  context: ["panel-transition", "scroll", "resize", "none"],
} as const;
type EnumFacts = { [K in keyof typeof enums]?: typeof enums[K][number] };
export type CompanionVisibilityFacts = EnumFacts & Partial<Record<"x" | "y" | "width" | "height" | "size", number>> & Partial<Record<"hidden" | "awaiting" | "reduced", boolean>>;
type RecordEntry = CompanionVisibilityFacts & { at: number; revision: string };
type StoragePort = Pick<Storage, "getItem" | "setItem" | "removeItem">;
const numericKeys = ["x", "y", "width", "height", "size"] as const;
const booleanKeys = ["hidden", "awaiting", "reduced"] as const;
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));

/** Reapply the allowlist on storage read AND export. Never spread engine facts. */
export function safeCompanionVisibilityFacts(value: unknown): CompanionVisibilityFacts {
  const safe: Record<string, string | number | boolean> = {};
  if (!object(value)) return safe;
  for (const key of Object.keys(enums) as (keyof typeof enums)[]) {
    const item = value[key];
    if (typeof item === "string" && (enums[key] as readonly string[]).includes(item)) safe[key] = item;
  }
  for (const key of numericKeys) {
    const item = value[key];
    if (typeof item === "number" && Number.isFinite(item) && Math.abs(item) <= 100000) safe[key] = Math.round(item / 4) * 4;
  }
  for (const key of booleanKeys) if (typeof value[key] === "boolean") safe[key] = value[key];
  return safe as CompanionVisibilityFacts;
}

export function createCompanionVisibilityJournal(storage: StoragePort | undefined, revision: string, now = Date.now) {
  const build = /^[a-f\d]{40}$/i.test(revision) ? revision : "dev";
  let records: RecordEntry[] = [], persistent = storage, lastSignature: string | undefined;
  const prune = () => {
    const time = now();
    records = records.filter(entry => Number.isFinite(entry.at) && entry.at <= time && entry.at > time - COMPANION_VISIBILITY_TTL_MS)
      .slice(-COMPANION_VISIBILITY_MAX_RECORDS).map(entry => ({ at: entry.at, revision: /^[a-f\d]{40}$/i.test(entry.revision) ? entry.revision : "dev", ...safeCompanionVisibilityFacts(entry) }));
  };
  const snapshot = () => {
    prune();
    return { schemaVersion: 1, kind: "local-companion-visibility", revision: build, records: records.map(entry => ({ ...entry })) };
  };
  const persist = () => {
    try { if (persistent) { if (records.length) persistent.setItem(COMPANION_VISIBILITY_KEY, JSON.stringify(snapshot())); else persistent.removeItem(COMPANION_VISIBILITY_KEY); } }
    catch { persistent = undefined; } // Storage denial never changes actor state.
  };
  try {
    const raw = persistent?.getItem(COMPANION_VISIBILITY_KEY);
    if (raw && raw.length * 2 <= COMPANION_VISIBILITY_MAX_BYTES) {
      const parsed: unknown = JSON.parse(raw);
      if (object(parsed) && parsed.schemaVersion === 1 && parsed.kind === "local-companion-visibility" && Array.isArray(parsed.records) && parsed.records.length <= COMPANION_VISIBILITY_MAX_RECORDS) {
        records = parsed.records.filter((entry): entry is Record<string, unknown> & { at: number } => object(entry) && typeof entry.at === "number" && Number.isFinite(entry.at))
          .map(entry => ({ at: entry.at, revision: typeof entry.revision === "string" && /^[a-f\d]{40}$/i.test(entry.revision) ? entry.revision : "dev", ...safeCompanionVisibilityFacts(entry) })).filter(entry => entry.stage && entry.reason);
      }
    }
    prune(); persist(); // Remove malformed/expired/oversized bytes from this key only.
  } catch {
    records = [];
    // Bad JSON is not storage denial. Preserve a working port after clearing
    // its malformed key so the next real incident survives a reload.
    try { persistent?.removeItem(COMPANION_VISIBILITY_KEY); } catch { persistent = undefined; }
  }
  return {
    record(input: CompanionVisibilityFacts) {
      try {
        const facts = safeCompanionVisibilityFacts(input);
        if (!facts.stage || !facts.reason) return;
        prune();
        const signature = JSON.stringify(facts);
        // Semantic transitions only; repeated paints never grow the journal.
        // A newly mounted controller can observe a distinct recurrence with
        // identical facts. Do not deduplicate it against a prior stored run.
        if (lastSignature === signature) return;
        lastSignature = signature;
        records.push({ at: now(), revision: build, ...facts }); prune(); persist();
      } catch { /* Optional observation cannot interrupt movement. */ }
    },
    snapshot() { const result = snapshot(); persist(); return result; },
    clear() { records = []; lastSignature = undefined; persist(); },
  };
}

/** Query flag is only an opt-in retrieval surface, never a collection toggle.
 * Ordinary visitors see no diagnostic chrome and no automatic downloads. */
export function createCompanionVisibilityDiagnostics(revision: string) {
  let storage: StoragePort | undefined;
  try { storage = window.localStorage; } catch { /* Memory-only when denied. */ }
  const journal = createCompanionVisibilityJournal(storage, revision);
  let panel: HTMLElement | undefined, button: HTMLButtonElement | undefined, status: HTMLElement | undefined;
  const update = () => { if (status) status.textContent = `이 브라우저에 ${journal.snapshot().records.length}건 · 최대 7일 · 서버 전송 없음`; };
  const download = () => {
    try {
      const blob = new Blob([JSON.stringify(journal.snapshot(), null, 2)], { type: "application/json" }), url = URL.createObjectURL(blob), link = document.createElement("a");
      const stamp = getTodayKst();
      link.href = url; link.download = `VIC-companion-diagnostic-${stamp}.json`; link.dataset.activityManual = ""; document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { if (status) status.textContent = "진단 저장을 다시 시도해 주세요."; }
  };
  const click = (event: MouseEvent) => { event.stopPropagation(); download(); };
  try {
    if (new URLSearchParams(location.search).get("companionTrace") === "1") {
      panel = document.createElement("section"); panel.dataset.companionVisibilityTrace = ""; panel.setAttribute("aria-label", "빅타민 로컬 진단");
      Object.assign(panel.style, { position: "fixed", right: "16px", top: "16px", zIndex: "2147483000", width: "320px", maxWidth: "calc(100vw - 32px)", padding: "16px", border: "1px solid #75644b", borderRadius: "14px", background: "#fff9e8", color: "#302b23", font: "14px system-ui", boxShadow: "0 4px 24px #0003" });
      const title = document.createElement("strong"); title.textContent = "빅타민 로컬 진단";
      status = document.createElement("p");
      button = document.createElement("button"); button.type = "button"; button.textContent = "빅타민 진단 저장"; button.setAttribute("aria-label", "빅타민 진단 저장"); button.dataset.activityManual = "";
      Object.assign(button.style, { minHeight: "44px", width: "100%", border: "1px solid #75644b", borderRadius: "10px", color: "#fff", background: "#75644b", font: "700 16px system-ui", cursor: "pointer" });
      button.addEventListener("click", click); panel.append(title, status, button); document.body.append(panel); update();
    }
  } catch { /* Diagnostics must never block the shared controller. */ }
  return {
    record(input: CompanionVisibilityFacts) { journal.record(input); update(); },
    snapshot: journal.snapshot,
    dispose() { button?.removeEventListener("click", click); panel?.remove(); },
  };
}
