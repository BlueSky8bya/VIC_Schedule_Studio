// In-memory PostgreSQL only. 0154: anon/authenticated read public(101) + 구독플러스(107) VOD metadata, nothing else.
// Run: node tests/sql/vod-archive-plus-public.mjs node_modules/@electric-sql/pglite/dist/index.js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create table public.vod_archive(title_no bigint primary key, auth_no integer);
    grant select on public.vod_archive to anon, authenticated, service_role;
    alter table public.vod_archive enable row level security;
    create policy vod_archive_public_read on public.vod_archive for select to anon, authenticated using (auth_no=101);
    insert into public.vod_archive values (42,101),(43,102),(44,107),(45,0);`);
  const sql = readFileSync("db/migrations/0154_vod_archive_plus_public.sql", "utf8");
  await db.exec(sql);
  await db.exec(sql); // idempotent
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    assert.deepEqual((await db.query("select title_no from public.vod_archive order by title_no")).rows.map((r) => Number(r.title_no)), [42, 44]);
    await db.exec("reset role");
  }
  await db.exec("set role service_role");
  assert.equal((await db.query("select count(*)::int n from public.vod_archive")).rows[0].n, 4);
  await db.exec("reset role");
  console.log("vod-archive-plus-public: ok");
} finally {
  await db.close();
}
