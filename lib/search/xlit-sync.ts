// 영문 가수·곡 제목 → 한글 읽기 동의어를 자동으로 채운다(0145 · lib/search/xlit.ts). 새 다시보기 챕터가 저장된 뒤
// (lib/broadcast/vod-timeline) 돈다 — 새 가수·래퍼·곡이 처음 나온 날 바로 한글로도 검색된다.
// 사람이 고른 시드(seed-artist·seed-title·seed-xlit)가 이미 짝지은 것은 search_xlit_pending이 빼고 준다.
import type { SupabaseClient } from "@supabase/supabase-js";
import { latinToHangul } from "@/lib/search/xlit";

/** search_norm(0076)과 같은 정규화 — 소문자, 공백·문장부호 제거. */
export function searchNorm(s: string): string {
  return s.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
}

/** 대기 중인 영문 구절의 한글 읽기 행(한글 → 영문 한쪽만). 순수 함수 — 테스트가 직접 부른다. */
export function xlitRows(pending: { latin: string; norm: string }[]) {
  const rows: { term: string; alt: string; source: string; kind: string }[] = [];
  const seen = new Set<string>();
  for (const p of pending) {
    // 3글자 이하 영문(ado·ive·bad)은 다른 낱말 속에 숨어 엉뚱한 제목을 끌어온다(madonna·live) — 사람이 고른 시드만 맡는다.
    if (/^[a-z0-9]+$/.test(p.norm) && p.norm.length < 4) continue;
    for (const h of latinToHangul(p.latin)) {
      const term = searchNorm(h);
      if (term.length < 2 || term === p.norm || !/[가-힣]/.test(term)) continue;
      const key = `${term}\u0000${p.norm}`;
      if (seen.has(key)) continue;
      seen.add(key);
      rows.push({ term, alt: p.norm, source: "auto-xlit", kind: "syn" });
    }
  }
  return rows;
}

/** 한 번에 최대 limit 구절. 실패해도 조용히(검색은 옛 사전으로 계속 돈다). 넣은 행 수를 돌려준다. */
export async function syncXlitSynonyms(supabase: SupabaseClient, limit = 300): Promise<number> {
  const { data, error } = await supabase.rpc("search_xlit_pending", { p_limit: limit });
  if (error || !Array.isArray(data) || data.length === 0) {
    if (error) console.warn("[search] search_xlit_pending failed:", error.message);
    return 0;
  }
  const rows = xlitRows(data as { latin: string; norm: string }[]);
  if (!rows.length) return 0;
  const { error: upErr } = await supabase
    .from("search_synonyms")
    .upsert(rows, { onConflict: "term,alt", ignoreDuplicates: true });
  if (upErr) {
    console.warn("[search] auto-xlit upsert failed:", upErr.message);
    return 0;
  }
  return rows.length;
}
