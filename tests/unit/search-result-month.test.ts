import { describe, expect, it } from 'vitest';
import type { PublicSearchHit } from '@/lib/domain/schedule-types';
import { searchResultMonths, filterSearchMonth } from '@/lib/search/result-month';
import { countSearchKinds, filterSearchKind } from '@/lib/search/result-kind';
import { groupSearchHits } from '@/lib/search/group';
const hit = (dateKey: string, kind: PublicSearchHit['kind'], extra: Partial<PublicSearchHit> = {}): PublicSearchHit => ({dateKey,kind,title:'합성',snippet:'',score:1,exact:true,popularity:0,...extra});
describe('loaded public search month', () => {
  const hits = [hit('2025-12-31','event',{eventId:'before'}),hit('2026-01-01','event',{eventId:'after'}),hit('2026-01-01','chapter',{titleNo:1,sec:10,matchedOn:'chat'}),hit('2026-01-02','chapter',{titleNo:2,sec:20,matchedOn:'label'})];
  it('uses complete year-month keys across the KST year boundary without changing the response', () => {
    expect(searchResultMonths(hits)).toEqual(['2026-01','2025-12']);
    expect(filterSearchMonth(hits,'2026-01')).toEqual(hits.slice(1));
    expect(filterSearchMonth(hits,'')).toEqual(hits);
    expect(hits).toHaveLength(4);
  });
  it('keeps kind counts and reconstructed chapter context inside the chosen month', () => {
    const narrowed=filterSearchMonth(hits,'2026-01');
    expect(countSearchKinds(narrowed)).toEqual({all:3,event:1,vod:0,chat:1,timeline:1});
    const groups=groupSearchHits(filterSearchKind(narrowed,'chat'));
    expect(groups).toHaveLength(1);expect(groups[0].dateKey).toBe('2026-01-01');expect(groups[0].vods[0].titleNo).toBe(1);
    expect(filterSearchMonth(hits,'2024-01')).toEqual([]);
  });
});
