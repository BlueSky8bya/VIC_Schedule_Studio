export const COMPANION_HIDE_ENTER_MS = 700;
export const COMPANION_HIDE_FOUND_MS = 1000;
export const COMPANION_HIDE_EMERGE_MS = 700;
export const COMPANION_HIDE_WAIT_MIN_MS = 12_000;
export const COMPANION_HIDE_WAIT_MAX_MS = 28_000;
export const COMPANION_HIDE_WAIT_DEFAULT_MS = 20_000;

export type CompanionHidePhase = "idle" | "entering" | "hidden" | "found" | "settled" | "emerging" | "done";
export type CompanionHideSample = Readonly<{ token: string | null; phase: CompanionHidePhase; progress: number; active: boolean }>;

const idle = (): CompanionHideSample => ({ token: null, phase: "idle", progress: 0, active: false });
const validTime = (now: number) => Number.isFinite(now) && now >= 0;
const validToken = (token: string) => typeof token === "string" && token.trim().length > 0;

/** A local visual session, not event data or a second planner. The caller
 * validates the public event/sheet and passes an opaque session token. Supply
 * one monotonic active/presentation clock to every method; freeze that clock
 * while the real tab is hidden. No timer, DOM, storage or clock is owned here.
 *
 * The caller chooses one bounded wait per session. Hidden/settled phases need
 * no render loop; wakeIn exposes the deadline for one caller-owned timeout. */
export function createCompanionHideSeek() {
  let session: { token: string; startedAt: number; emergeAt: number; foundAt?: number } | undefined;
  const sample = (now: number): CompanionHideSample => {
    if (!session || !validTime(now) || now < session.startedAt) return idle();
    if (session.foundAt !== undefined) {
      const progress = Math.min(1, Math.max(0, now - session.foundAt) / COMPANION_HIDE_FOUND_MS);
      return { token: session.token, phase: progress < 1 ? "found" : "settled", progress, active: progress < 1 };
    }
    const age = now - session.startedAt;
    if (age < COMPANION_HIDE_ENTER_MS) return { token: session.token, phase: "entering", progress: age / COMPANION_HIDE_ENTER_MS, active: true };
    if (now < session.emergeAt) return { token: session.token, phase: "hidden", progress: 1, active: false };
    const progress = Math.min(1, (now - session.emergeAt) / COMPANION_HIDE_EMERGE_MS);
    return { token: session.token, phase: progress < 1 ? "emerging" : "done", progress, active: progress < 1 };
  };
  return {
    start(token: string, now: number, waitMs = COMPANION_HIDE_WAIT_DEFAULT_MS): boolean {
      if (!validToken(token) || !validTime(now) || !Number.isFinite(waitMs) || session?.token === token) return false;
      const wait = Math.max(COMPANION_HIDE_WAIT_MIN_MS, Math.min(COMPANION_HIDE_WAIT_MAX_MS, waitMs));
      session = { token, startedAt: now, emergeAt: now + COMPANION_HIDE_ENTER_MS + wait };
      return true;
    },
    /** Pure projection. Reading a phase never renews a hold or changes a
     * subsequent find, including repeated samples at one display timestamp. */
    sample,
    /** This is only a duration projection, not a timer. Pausing the supplied
     * active clock also pauses the remaining wait without a reschedule API. */
    wakeIn(now: number): number | null {
      return sample(now).phase === "hidden" ? session!.emergeAt - now : null;
    },
    /** Finding during the finite entry is intentional: an immediate native
     * card activation should not miss its already-owned hiding session. */
    find(token: string, now: number): boolean {
      if (!session || token !== session.token || session.foundAt !== undefined || !validTime(now) || now < session.startedAt || now >= session.emergeAt) return false;
      session = { ...session, foundAt: now };
      return true;
    },
    reset(): void { session = undefined; },
  };
}
