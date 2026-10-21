import { createEmptyForm, DRAFT_TTL_MS, draftFingerprint, type EditDraft, type EventForm } from "./editor-model";

export type SaveRecovery = { attempt: number; session: number; targetId: string; dateKey: string; originalScope: EventForm["visibilityScope"]; form: EventForm; at: number };
const copyForm = (form: EventForm): EventForm => ({ ...form, tagIds: [...form.tagIds], primaryTagIds: [...form.primaryTagIds] });

export function canRecoverSaveSnapshot(item: SaveRecovery, access: { canEdit: boolean; unlocked: boolean; owner: boolean; readOnly: boolean }, target?: { visibilityScope: string }): boolean {
  if (!access.canEdit || access.readOnly || (item.form.id && !target)) return false;
  const allowed = (scope: string) => scope === "public" || (access.unlocked
    && (scope === "work" || (access.owner && (scope === "owner_private" || scope === "embargo"))));
  return allowed(item.form.visibilityScope) && allowed(item.originalScope) && (!target || allowed(target.visibilityScope));
}

/** Session memory only. Each submission owns its snapshot; late replies never
 * replace the current editor or another submission's recovery entry. */
export class FailedSaveRecovery {
  private serial = 0;
  private pending = new Map<number, SaveRecovery>();
  private failed = new Map<number, SaveRecovery>();
  private discarded = new Map<number, { through: number; at: number }>();
  markEdit() { return ++this.serial; }
  private wasDiscarded(session: number, revision: number) {
    return revision <= (this.discarded.get(session)?.through ?? -1);
  }

  begin(input: Omit<SaveRecovery, "attempt" | "at">, now: number): number {
    this.prune(now);
    const attempt = ++this.serial;
    this.pending.set(attempt, { ...input, form: copyForm(input.form), attempt, at: now });
    return attempt;
  }
  succeed(attempt: number) { this.pending.delete(attempt); }

  fail(attempt: number, now: number, newer?: { draft: EditDraft; session: number; revision: number }, resolvedEventId?: string) {
    this.prune(now);
    const submitted = this.pending.get(attempt);
    this.pending.delete(attempt);
    if (!submitted) return;
    if (resolvedEventId) submitted.form.id = resolvedEventId;
    const retain = (item: SaveRecovery) => {
      // An unsaved temp edit may also have its own queued submission. Retain
      // one copy of that input, while independent same-date creates stay apart.
      if (![...this.failed.values()].some(other => other.targetId === item.targetId
        && draftFingerprint(other.form) === draftFingerprint(item.form))) this.failed.set(item.attempt, item);
    };
    if (!this.wasDiscarded(submitted.session, submitted.attempt)) retain(submitted);
    // A failed create may also remove a temp card that was edited again while
    // its first request was pending. Preserve that newer input independently.
    if (newer && !this.wasDiscarded(newer.session, newer.revision) && newer.draft.ts >= now - DRAFT_TTL_MS
      && draftFingerprint(newer.draft.form) !== draftFingerprint(submitted.form)) {
      const form = copyForm(newer.draft.form);
      if (submitted.form.id) form.id = submitted.form.id; else delete form.id;
      const id = ++this.serial;
      retain({ ...submitted, attempt: id, session: newer.session, form, at: newer.draft.ts });
    }
  }
  discardSession(session: number, now: number) {
    this.discarded.set(session, { through: this.serial, at: now });
    // Retain only attempt ownership until its reply: a later temp edit from a
    // different session can still need recovery. Discard the old input itself.
    for (const [id, item] of this.pending) if (item.session === session) this.pending.set(id,
      { ...item, form: { ...createEmptyForm(), id: item.form.id } });
    for (const [id, item] of this.failed) if (item.session === session) this.failed.delete(id);
    this.prune(now);
  }
  available(now: number, allowed: (form: EventForm, item: SaveRecovery) => boolean): SaveRecovery[] {
    this.prune(now);
    // FIFO: switching away can append a preserved ordinary draft. It must not
    // jump ahead of older failed inputs and trap recovery between two entries.
    return [...this.failed.values()].filter(item => allowed(item.form, item)).sort((a, b) => a.attempt - b.attempt);
  }
  take(attempt: number, now: number, allowed: (form: EventForm, item: SaveRecovery) => boolean): SaveRecovery | null {
    this.prune(now);
    const item = this.failed.get(attempt);
    if (!item || !allowed(item.form, item)) return null;
    this.failed.delete(attempt);
    return { ...item, form: copyForm(item.form) };
  }
  private prune(now: number) {
    for (const map of [this.pending, this.failed]) for (const [key, value] of map) if (value.at <= now - DRAFT_TTL_MS) map.delete(key);
    for (const [session, value] of this.discarded) if (value.at <= now - DRAFT_TTL_MS) this.discarded.delete(session);
  }
}
