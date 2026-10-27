import type { PublicSearchHit, PublicSearchHitKind } from '@/lib/domain/schedule-types';

export type SearchResultKind = 'all' | Exclude<PublicSearchHitKind, 'chapter'> | 'chat' | 'timeline';
export const SEARCH_RESULT_KINDS = [
  {key:'all',label:'전체'}, {key:'event',label:'일정'},
  {key:'vod',label:'다시보기'}, {key:'chat',label:'채팅'}, {key:'timeline',label:'타임라인'}
] as const;
export function searchResultKind(hit: PublicSearchHit): Exclude<SearchResultKind,'all'> {
  return hit.kind === 'chapter' ? hit.matchedOn === 'chat' ? 'chat' : 'timeline' : hit.kind;
}
export function countSearchKinds(hits: readonly PublicSearchHit[]) {
  const counts={all:hits.length,event:0,vod:0,chat:0,timeline:0};
  for(const hit of hits) counts[searchResultKind(hit)]++;
  return counts;
}
/** Filter the returned hits, before grouping. Chapter parents remain context,
 * reconstructed by groupSearchHits; they are never counted as extra hits. */
export function filterSearchKind(hits: readonly PublicSearchHit[],kind:SearchResultKind):PublicSearchHit[] {
  return hits.filter(hit=>kind==='all'||searchResultKind(hit)===kind);
}
