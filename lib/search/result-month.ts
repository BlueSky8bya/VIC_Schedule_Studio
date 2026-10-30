import type { PublicSearchHit } from '@/lib/domain/schedule-types';

/** KST date keys already belong to the public response; no timezone conversion
 * or additional retrieval. Options always describe the loaded hit set. */
export function searchResultMonths(hits: readonly PublicSearchHit[]): string[] {
  return [...new Set(hits.map(hit => hit.dateKey.slice(0, 7)).filter(key => /^\d{4}-(0[1-9]|1[0-2])$/.test(key)))].sort().reverse();
}

export function filterSearchMonth(hits: readonly PublicSearchHit[], month: string): PublicSearchHit[] {
  return hits.filter(hit => !month || hit.dateKey.startsWith(`${month}-`));
}
