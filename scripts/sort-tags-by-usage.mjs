// 태그 정렬 — 사용 빈도(event_tags 연결 수) 내림차순으로 broadcast_tags.sort_order 설정.
// 자주 쓰는 태그가 범례·피커 위쪽에 와 빠르게 체크/선택할 수 있게 한다.
// 휴뱅(dayoff)은 시스템 기본 태그(에디터에서 항상 최상단 고정)라 sort_order 0으로 핀.
// 콘텐츠/방식은 범례에서 묶음이 갈리므로 전역 빈도순이면 각 묶음 안에서도 빈도순이 된다.
// dry-run: `node scripts/sort-tags-by-usage.mjs --dry`
import { readFileSync } from "node:fs";
import { Client } from "pg";

const DRY = process.argv.includes("--dry");
const t = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const e = {}; for (const l of t.split(/\r?\n/)) { const m = l.match(/^([A-Z0-9_]+)=(.*)$/); if (m) e[m[1]] = m[2]; }
const ref = e.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z0-9]+)\.supabase\.co/)[1];
const c = new Client({ host: "aws-1-ap-northeast-2.pooler.supabase.com", port: 5432, user: "postgres." + ref, password: e.SUPABASE_DB_PASSWORD, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();
const cal = (await c.query("select id from calendars where slug='vic'")).rows[0].id;

const tags = (await c.query(
  `select bt.id, bt.tag_key, bt.display_name, bt.kind, bt.color_key, count(et.event_id)::int uses
   from broadcast_tags bt left join event_tags et on et.tag_id = bt.id
   where bt.calendar_id=$1 and bt.is_active=true and bt.parent_id is null group by bt.id`,
  [cal]
)).rows;

// 정렬 키: 휴뱅 먼저(0) → 그 외는 사용량 내림차순(동률은 이름 안정).
const rank = (x) => (x.tag_key === "dayoff" ? [0, 0, ""] : [1, -x.uses, x.display_name]);
tags.sort((a, b) => {
  const [pa, ua, na] = rank(a), [pb, ub, nb] = rank(b);
  return pa - pb || ua - ub || na.localeCompare(nb);
});

console.log(DRY ? "── DRY RUN ──" : "── 적용 ──");
for (let i = 0; i < tags.length; i++) {
  const tg = tags[i];
  console.log(`${String(i).padStart(2)}  ${tg.display_name.padEnd(8)} ${String(tg.uses).padStart(3)}회  (${tg.kind === "modifier" ? "방식" : "콘텐츠"})`);
  if (!DRY) {
    await c.query("update broadcast_tags set sort_order=$1 where id=$2", [i, tg.id]);
    // 색 팔레트도 같은 순서로 — 편집창 스와치(=팔레트 sort_order 순)가 태그 순서와 같아져
    // 선택칸이 왼쪽부터 한 칸씩 대각선으로 계단식 정렬된다(초록·보라·분홍… 순).
    if (tg.color_key) {
      await c.query("update color_palette set sort_order=$1 where calendar_id=$2 and key=$3", [i, cal, tg.color_key]);
    }
  }
}
await c.end();
console.log(DRY ? "DRY 끝" : "완료 ✅ — 범례·피커가 사용 빈도순으로 정렬됨");
