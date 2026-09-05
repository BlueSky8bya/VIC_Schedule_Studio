// 팬 타임라인 전체 재수집(0071) — vod_archive 전체의 댓글을 다시 읽어 vod_timeline에 저장한다.
// 초기 백필용으로 만들었고, **파싱 규칙을 고친 뒤 과거 VOD를 따라잡을 때도** 같은 스크립트를 쓴다
// (2026-09-06: 대괄호 시각 "[ 02:10:55 ] 라벨" 표기를 못 읽어 통째로 버려진 타임라인 복구).
//
// 파서는 scripts/lib/timeline-parse.mjs 하나만 쓴다(lib/broadcast/vod-timeline.ts의 거울 —
// 두 구현의 동치는 tests/unit/vod-timeline.test.ts가 지킨다).
//
// 사용: node scripts/backfill-vod-timelines.mjs [--dry]
//   --dry = 쓰지 않고 "무엇이 달라지는지"만 보고한다(먼저 이걸로 확인하고 실행할 것).
import { readFileSync } from "node:fs";
import { pickTimelineComment } from "./lib/timeline-parse.mjs";

function parseEnvLocal() {
  const text = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const out = {};
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2];
  }
  return out;
}
const env = parseEnvLocal();
const U = env.NEXT_PUBLIC_SUPABASE_URL;
const K = env.SUPABASE_SERVICE_ROLE_KEY;
const BJ = env.SOOP_BJ_ID || "toryvac";
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DRY = process.argv.includes("--dry");

// PostgREST 기본 1000행 상한 — 500씩 끊어 전부 읽는다.
async function fetchAll(path) {
  const rows = [];
  for (let off = 0; ; off += 500) {
    const page = await fetch(`${U}/rest/v1/${path}&limit=500&offset=${off}`, { headers: H }).then((x) =>
      x.json()
    );
    rows.push(...page);
    if (page.length < 500) break;
  }
  return rows;
}

const vods = (await fetchAll("vod_archive?select=title_no,host_id,title,reg_date&order=reg_date.desc")).map(
  // 합방 게스트 출연분(0075)은 댓글이 호스트 채널에 있다.
  (v) => ({ titleNo: Number(v.title_no), host: v.host_id || BJ, title: v.title ?? "", reg: v.reg_date ?? "" })
);
const prevRows = await fetchAll("vod_timeline?select=title_no,entry_count,author_nick");
const prev = new Map(prevRows.map((r) => [Number(r.title_no), Number(r.entry_count) || 0]));
console.log(`대상 VOD: ${vods.length} (기존 타임라인 ${prevRows.filter((r) => r.entry_count > 0).length}개)${DRY ? " — DRY RUN" : ""}`);

/** 댓글 2페이지. ok=false면 숲 API가 죽은 것 — 이 경우 절대 덮어쓰지 않는다(멀쩡한 행 보호). */
async function fetchComments(titleNo, host) {
  const items = [];
  let ok = false;
  for (let page = 1; page <= 2; page += 1) {
    try {
      const res = await fetch(
        `https://chapi.sooplive.co.kr/api/${host}/title/${titleNo}/comment?page=${page}&per_page=30`,
        { headers: { "User-Agent": "Mozilla/5.0" } }
      );
      if (!res.ok) break;
      const j = await res.json();
      ok = true;
      items.push(...(j.data ?? []));
      if (page >= (j.meta?.last_page ?? 1)) break;
    } catch {
      break;
    }
  }
  return { items, ok };
}

let done = 0;
let withTl = 0;
const gained = []; // 없던 타임라인이 생김(= 파싱 규칙 수정으로 복구된 것)
const grew = []; // 항목 수가 늘어남
const lost = []; // 있던 게 사라짐(댓글 삭제 등) — 보고만 하고 그대로 반영
let skipped = 0;
for (const { titleNo, host, title, reg } of vods) {
  const { items, ok } = await fetchComments(titleNo, host);
  if (!ok) {
    skipped += 1;
    await sleep(200);
    continue;
  }
  const best = pickTimelineComment(items);
  const before = prev.get(titleNo) ?? 0;
  const after = best?.entries.length ?? 0;
  if (after > 0) withTl += 1;
  const line = `${titleNo} ${reg.slice(0, 10)} ${before}→${after} ${title.slice(0, 40)}`;
  if (before === 0 && after > 0) gained.push(line);
  else if (after > before) grew.push(line);
  else if (before > 0 && after === 0) lost.push(line);
  if (!DRY) {
    const res = await fetch(`${U}/rest/v1/vod_timeline?on_conflict=title_no`, {
      method: "POST",
      headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify([
        {
          title_no: titleNo,
          author_nick: best?.nick ?? "",
          comment_no: best?.commentNo ?? null,
          entry_count: after,
          entries: best?.entries ?? [],
          synced_at: new Date().toISOString()
        }
      ])
    });
    if (!res.ok) throw new Error(`upsert 실패: ${res.status} ${await res.text()}`);
  }
  done += 1;
  if (done % 40 === 0) console.log(`  진행 ${done}/${vods.length} (타임라인 ${withTl})`);
  await sleep(200);
}
const show = (name, arr) => {
  if (arr.length === 0) return;
  console.log(`\n[${name}] ${arr.length}개`);
  for (const l of arr) console.log("  " + l);
};
show("복구(0 → N)", gained);
show("증가", grew);
show("사라짐", lost);
console.log(
  `\n완료: ${done}개 확인${DRY ? "(쓰지 않음)" : ""}, 타임라인 존재 ${withTl}개, 댓글 조회 실패 ${skipped}개.`
);
