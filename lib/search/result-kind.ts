import type { PublicSearchHit, PublicSearchHitKind } from '@/lib/domain/schedule-types';

export type SearchResultKind = 'all' | PublicSearchHitKind;
export const SEARCH_RESULT_KINDS = [
  {key:'all',label:'전체'}, {key:'event',label:'일정'},
  {key:'vod',label:'다시보기'}, {key:'chapter',label:'챕터'}
] as const;
export function countSearchKinds(hits: readonly PublicSearchHit[]) {
  const counts={all:hits.length,event:0,vod:0,chapter:0};
  for(const hit of hits) counts[hit.kind]++;
  return counts;
}
/** Filter the returned hits, before grouping. Chapter parents remain context,
 * reconstructed by groupSearchHits; they are never counted as extra hits. */
export function filterSearchKind(hits: readonly PublicSearchHit[],kind:SearchResultKind):PublicSearchHit[] {
  return hits.filter(hit=>kind==='all'||hit.kind===kind);
}
