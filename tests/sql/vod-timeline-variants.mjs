// Isolated Postgres/WASM migration regression; never reads .env or production DB.
// npm install --prefix .scratch-pw/timeline-db --no-save --no-package-lock @electric-sql/pglite
// node tests/sql/vod-timeline-variants.mjs .scratch-pw/timeline-db/node_modules/@electric-sql/pglite/dist/index.js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table public.vod_archive(title_no bigint primary key, auth_no integer);
    grant select on public.vod_archive to anon,authenticated,service_role;
    insert into public.vod_archive values(42,101),(43,102);`);
  await db.exec(readFileSync("db/migrations/0071_vod_timeline.sql", "utf8"));
  const search = readFileSync("db/migrations/0076_public_search.sql", "utf8");
  await db.exec(search.slice(0, search.indexOf("-- 백필:")).replace("create extension if not exists pg_trgm;", ""));
  const migration = readFileSync("db/migrations/0124_vod_timeline_variants.sql", "utf8");
  await db.exec(migration);
  await db.exec(migration); // idempotent
  const candidate = (key, label, score, eligible = true) => ({ key, rootCommentNo: 1, sourceCommentNos: [key], authorNick: label,
    entries: [{ sec: 0, label, section: null }], eligible, reason: eligible ? "overview" : "feedback", score });
  const a = candidate("root:1", "A", 800), b = candidate("root:2", "B", 700), hidden = candidate("root:3", "Feedback", 900, false);
  const ingest = (rows, time, no = 42) => db.query("select public.vod_timeline_ingest($1,$2::jsonb,$3::timestamptz) as ok", [no, JSON.stringify(rows), time]);
  const moderate = (key, action) => db.query("select public.vod_timeline_moderate(42,$1,$2)", [key, action]);
  const snapshot = async () => (await db.query("select * from public.vod_timeline where title_no=42")).rows[0];
  await ingest([a,b,hidden], "2026-09-21T00:00:00Z");
  assert.equal((await snapshot()).author_nick, "A");
  assert.equal((await snapshot()).variants.length, 2);
  assert.equal((await db.query("select label from public.vod_chapter_index where title_no=42")).rows[0].label, "A");
  await moderate("root:2", "pin");
  await moderate("root:1", "hide");
  await ingest([{ ...a, score: 1000 }, { ...b, entries: [{ sec: 10, label: "B edited" }] }, hidden], "2026-09-21T01:00:00Z");
  assert.equal((await snapshot()).author_nick, "B");
  assert.equal((await snapshot()).entries[0].label, "B edited");
  assert.deepEqual((await snapshot()).variants.map((v) => v.id), ["root:2"]);
  assert.equal((await ingest([a], "2026-09-21T00:30:00Z")).rows[0].ok, false);
  assert.equal((await snapshot()).author_nick, "B");
  await ingest([a,hidden], "2026-09-21T02:00:00Z"); // source deletion keeps choice but publishes no missing content
  assert.equal((await snapshot()).entry_count, 0);
  await ingest([a,b,hidden], "2026-09-21T03:00:00Z");
  assert.equal((await snapshot()).author_nick, "B");
  await moderate("root:1", "auto");
  await moderate(null, "automatic");
  assert.equal((await snapshot()).author_nick, "A");
  await moderate("root:3", "show");
  assert.equal((await snapshot()).author_nick, "A"); // visible specialist stays an alternative to an overview
  assert.equal((await snapshot()).variants.length, 3);
  await moderate("root:3", "pin");
  assert.equal((await snapshot()).author_nick, "Feedback"); // explicit representative override still works
  await ingest([a], "2026-09-21T00:00:00Z", 43);
  await db.exec("set role anon");
  assert.deepEqual((await db.query("select title_no from public.vod_timeline order by title_no")).rows.map((r) => Number(r.title_no)), [42]);
  assert.equal((await db.query("select count(*)::int as n from public.vod_chapter_index where title_no=43")).rows[0].n, 0);
  await assert.rejects(() => db.query("select * from public.vod_timeline_candidate"), /permission denied/);
  await assert.rejects(() => db.query("select public.vod_timeline_moderate(42,null,'automatic')"), /permission denied/);
  await db.exec("reset role; set role authenticated");
  await assert.rejects(() => db.query("select * from public.vod_timeline_choice"), /permission denied/);
  await assert.rejects(() => ingest([a], "2026-09-21T04:00:00Z"), /permission denied/);
  await db.exec("reset role; set role service_role");
  await moderate("root:3", "hide");
  console.log("PASS: migration idempotence, atomic projection, representative-only search, overrides across edits/deletion/return, stale snapshot rejection, anon/authenticated RLS and RPC grants, service-role moderation");
} finally { await db.close(); }
