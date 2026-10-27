import type { BroadcastTag } from '@/lib/domain/schedule-types';
import { categoryId, categoryColorKey } from '@/lib/calendar/month';

/** Match the calendar's first two distinct content colors. Other slots stay put. */
export function contentColorTagIds(ids: readonly string[], tags: BroadcastTag[]): string[] {
  const seen = new Set<string>(), slots: number[] = [];
  for (let i = 0; i < ids.length; i++) {
    const top = tags.find(t => t.id === categoryId(ids[i], tags));
    const color = categoryColorKey(ids[i], tags);
    if (!top || top.kind === 'modifier' || !color || seen.has(color)) continue;
    seen.add(color); slots.push(i);
    if (slots.length === 2) break;
  }
  return slots.map(i => ids[i]);
}

export function swapContentColorOrder(ids: readonly string[], tags: BroadcastTag[], retainedPair?: readonly string[]): string[] | null {
  const leading = contentColorTagIds(ids, tags);
  const colors = new Set(leading.map(id => categoryColorKey(id, tags)));
  const validPair = retainedPair?.length === 2 && retainedPair.every(id => ids.includes(id) && colors.has(categoryColorKey(id, tags))) && contentColorTagIds(retainedPair, tags).length === 2;
  const pair = validPair ? retainedPair! : leading;
  if (pair.length !== 2) return null;
  const next = [...ids], [a, b] = pair.map(id => ids.indexOf(id));
  [next[a], next[b]] = [next[b], next[a]];
  return next;
}
