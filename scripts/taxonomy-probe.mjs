// 태그 분류 실증 조회 (읽기 전용). 트리 구조 검증용.
// 사용: node scripts/taxonomy-probe.mjs
import { readFileSync } from "node:fs";
import { Client } from "pg";

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
const password = env.SUPABASE_DB_PASSWORD;
const ref = (env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1];
const candidates = [
  { host: `aws-0-ap-northeast-2.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
  { host: `aws-1-ap-northeast-2.pooler.supabase.com`, port: 5432, user: `postgres.${ref}` },
  { host: `db.${ref}.supabase.co`, port: 5432, user: "postgres" }
];
async function tryConnect(cfg) {
  const c = new Client({ host: cfg.host, port: cfg.port, user: cfg.user, password, database: "postgres", ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 8000, statement_timeout: 60000 });
  await c.connect(); await c.query("select 1"); return c;
}
let client = null;
for (const cfg of candidates) {
  try { client = await tryConnect(cfg); break; } catch { /* next */ }
}
if (!client) { console.error("접속 실패"); process.exit(2); }

const calRes = await client.query("select id from public.calendars where slug='vic'");
const cal = calRes.rows[0]?.id;

// 1) 태그별 사용량 + 기간
const usage = await client.query(`
  select t.display_name, t.tag_key, t.color_key, t.sort_order, t.parent_id,
         count(et.event_id)::int as uses,
         min(e.date_key) as first_use, max(e.date_key) as last_use
  from public.broadcast_tags t
  left join public.event_tags et on et.tag_id = t.id
  left join public.events e on e.id = et.event_id and e.calendar_id = $1
  where t.calendar_id = $1
  group by t.id
  order by uses desc, t.sort_order
`, [cal]);

console.log("\n===== 1) 태그별 사용량 (8개월) =====");
console.log("name           key            uses  first       last        parent?");
for (const r of usage.rows) {
  console.log(
    `${(r.display_name||"").padEnd(13)} ${(r.tag_key||"").padEnd(13)} ${String(r.uses).padStart(4)}  ${r.first_use?String(r.first_use).slice(0,10):"—".padEnd(10)}  ${r.last_use?String(r.last_use).slice(0,10):"—".padEnd(10)}  ${r.parent_id?"child":""}`
  );
}

// 2) 각 태그가 붙은 이벤트 제목 샘플 (세부 인스턴스 발굴)
console.log("\n===== 2) 태그별 이벤트 제목 (세부 후보 발굴) =====");
const titles = await client.query(`
  select t.display_name as tag, e.date_key, e.public_title
  from public.event_tags et
  join public.broadcast_tags t on t.id = et.tag_id
  join public.events e on e.id = et.event_id
  where t.calendar_id = $1 and e.calendar_id = $1
  order by t.sort_order, e.date_key
`, [cal]);
const byTag = new Map();
for (const r of titles.rows) {
  if (!byTag.has(r.tag)) byTag.set(r.tag, []);
  byTag.get(r.tag).push(`${String(r.date_key).slice(0,10)}  ${r.public_title}`);
}
for (const [tag, list] of byTag) {
  console.log(`\n■ ${tag} (${list.length})`);
  for (const line of list) console.log(`   ${line}`);
}

// 3) 동시출현 (콘텐츠+수식어 모델 검증)
console.log("\n===== 3) 한 이벤트에 같이 붙은 태그쌍 (동시출현 top) =====");
const pairs = await client.query(`
  select a.display_name as t1, b.display_name as t2, count(*)::int as n
  from public.event_tags ea
  join public.event_tags eb on ea.event_id = eb.event_id and ea.tag_id < eb.tag_id
  join public.broadcast_tags a on a.id = ea.tag_id
  join public.broadcast_tags b on b.id = eb.tag_id
  where a.calendar_id = $1 and b.calendar_id = $1
  group by a.display_name, b.display_name
  order by n desc
  limit 40
`, [cal]);
for (const r of pairs.rows) console.log(`   ${String(r.n).padStart(3)}  ${r.t1}  +  ${r.t2}`);

// 4) 이벤트당 태그 개수 분포
const dist = await client.query(`
  select cnt, count(*)::int as events from (
    select event_id, count(*)::int as cnt
    from public.event_tags et
    join public.events e on e.id = et.event_id
    where e.calendar_id = $1
    group by event_id
  ) s group by cnt order by cnt
`, [cal]);
console.log("\n===== 4) 이벤트당 태그 개수 분포 =====");
for (const r of dist.rows) console.log(`   태그 ${r.cnt}개: 이벤트 ${r.events}개`);

await client.end();
