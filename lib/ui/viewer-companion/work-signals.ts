/** Public ordinary-work lifecycle only. Never include schedule content,
 * identifiers, dates, roles, identities or analytics in this local signal. */
export const COMPANION_WORK_SIGNAL = "vic:companion-public-work";
const KINDS = ["opened", "closed", "saved", "undo", "redo"] as const;
export type CompanionWorkSignalKind = typeof KINDS[number];
export type CompanionWorkSignal = Readonly<{ kind: CompanionWorkSignalKind }>;

export function validCompanionWorkSignal(value: unknown): value is CompanionWorkSignal {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Reflect.ownKeys(value), descriptor = Object.getOwnPropertyDescriptor(value, "kind");
  return keys.length === 1 && keys[0] === "kind" && Boolean(descriptor && "value" in descriptor && (KINDS as readonly unknown[]).includes(descriptor.value));
}

/** Completion callers must already have a real server success. This function
 * dispatches one content-free local event; it never records a human activity. */
export function emitCompanionWorkSignal(kind: CompanionWorkSignalKind): boolean {
  if (typeof window === "undefined" || !(KINDS as readonly unknown[]).includes(kind)) return false;
  window.dispatchEvent(new CustomEvent<CompanionWorkSignal>(COMPANION_WORK_SIGNAL, { detail: Object.freeze({ kind }) }));
  return true;
}

/** A logical history command may contain several server writes. Each real
 * success acknowledges once; absent/failed writes do not acknowledge. The
 * caller supplies zero for mixed/private groups, so they remain silent. */
export function createCompanionWorkCompletion(kind: "undo" | "redo", expected: number): (() => void) | undefined {
  if (!Number.isSafeInteger(expected) || expected <= 0) return;
  let remaining = expected;
  return () => {
    if (remaining <= 0) return;
    remaining--;
    if (remaining === 0) emitCompanionWorkSignal(kind);
  };
}
