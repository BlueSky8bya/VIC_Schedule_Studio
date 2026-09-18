"use server";

import { resolveCurrentActor } from "@/lib/auth/actor";
import { createSupabaseAdminClient } from "@/lib/auth/admin";

// 은어 사전 초안(0090, 2026-09-18) — 개발자 전용 서버 액션.
// 다시보기 채팅에서 새로 배운 말(사전·인물·제목에 없는 말)을 보여 주고, 개발자가 뜻(= 다른 말)을 달면
// search_synonyms(curated, syn 양방향)에 들어가 검색 확장에 바로 쓰인다. '무시'는 search_dictionary_notes.ignored.
// 채팅 원문은 없다 — 단어·방송 수·처음/마지막 날·예시 방송 제목만(0088 저장 원칙).

const SLUG = "vic";

export type DictionaryDraftRow = {
  term: string;
  vods: number;
  total: number;
  firstDay: string | null;
  lastDay: string | null;
  samples: string[];
  note: string | null;
};

export type DictionaryDraftResult = { ok: true; rows: DictionaryDraftRow[] } | { ok: false; error: string };

async function developerOnly(): Promise<{ ok: true; supabase: NonNullable<ReturnType<typeof createSupabaseAdminClient>> } | { ok: false; error: string }> {
  const actor = await resolveCurrentActor(SLUG);
  if (actor.role !== "developer") return { ok: false, error: "개발자만 쓸 수 있는 화면입니다." };
  const supabase = createSupabaseAdminClient();
  if (!supabase) return { ok: false, error: "Supabase 서비스 키가 설정되지 않았습니다." };
  return { ok: true, supabase };
}

export async function getDictionaryDraftAction(limit = 200): Promise<DictionaryDraftResult> {
  const gate = await developerOnly();
  if (!gate.ok) return gate;
  const { data, error } = await gate.supabase.rpc("search_dictionary_draft", { p_limit: limit });
  if (error) return { ok: false, error: error.message };
  const rows = ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    term: String(r.term ?? ""),
    vods: Number(r.vods) || 0,
    total: Number(r.total) || 0,
    firstDay: typeof r.first_day === "string" ? r.first_day : null,
    lastDay: typeof r.last_day === "string" ? r.last_day : null,
    samples: Array.isArray(r.samples) ? (r.samples as unknown[]).filter((x): x is string => typeof x === "string") : [],
    note: typeof r.note === "string" ? r.note : null
  }));
  return { ok: true, rows };
}

const TERM_RE = /^[가-힣a-zA-Z0-9 ]{1,24}$/;

/** 뜻 달기: term ↔ meaning 을 동의어(syn)로 양방향 등록 + 노트 저장. meaning은 검색어로 쓰일 말(예: "배틀그라운드"). */
export async function saveDictionaryNoteAction(term: string, meaning: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await developerOnly();
  if (!gate.ok) return gate;
  const t = term.trim();
  const m = meaning.trim();
  if (!TERM_RE.test(t) || !TERM_RE.test(m) || t === m) return { ok: false, error: "단어를 확인하세요(한글·영문·숫자 1~24자, 서로 달라야 함)." };
  const norm = (x: string) => x.toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, "");
  const rows = [
    { term: norm(t), alt: norm(m), source: "curated", kind: "syn", support: 0 },
    { term: norm(m), alt: norm(t), source: "curated", kind: "syn", support: 0 }
  ];
  const ins = await gate.supabase.from("search_synonyms").upsert(rows, { onConflict: "term,alt", ignoreDuplicates: true });
  if (ins.error) return { ok: false, error: ins.error.message };
  const note = await gate.supabase
    .from("search_dictionary_notes")
    .upsert({ term: norm(t), note: m, ignored: false, updated_at: new Date().toISOString() });
  if (note.error) return { ok: false, error: note.error.message };
  return { ok: true };
}

export async function ignoreDictionaryTermAction(term: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const gate = await developerOnly();
  if (!gate.ok) return gate;
  const t = term.trim();
  if (!TERM_RE.test(t)) return { ok: false, error: "단어를 확인하세요." };
  const { error } = await gate.supabase
    .from("search_dictionary_notes")
    .upsert({ term: t, ignored: true, updated_at: new Date().toISOString() });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
