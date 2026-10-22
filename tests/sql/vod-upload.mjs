// In-memory PostgreSQL only. 0155: anon/authenticated read only auth_no=107 uploads; service_role writes.
// Run: node tests/sql/vod-upload.mjs node_modules/@electric-sql/pglite/dist/index.js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
const { PGlite } = await import(pathToFileURL(resolve(process.argv[2])).href);
const db = new PGlite();
try {
  await db.exec("create role anon; create role authenticated; create role service_role bypassrls;");
  const sql = readFileSync("db/migrations/0155_vod_upload.sql", "utf8");
  await db.exec(sql);
  await db.exec(sql); // idempotent
  await db.exec("set role service_role");
  await db.exec(`insert into public.vod_upload(title_no,upload_day,title,auth_no) values (1,'2025-10-28','sub',107),(2,'2025-10-28','other',102)`);
  await db.exec("update public.vod_upload set title='sub!' where title_no=1");
  await db.exec("reset role");
  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    assert.deepEqual((await db.query("select title_no from public.vod_upload order by title_no")).rows.map((r) => Number(r.title_no)), [1]);
    await assert.rejects(db.query("insert into public.vod_upload(title_no,upload_day,auth_no) values (3,'2025-01-01',107)"), /permission denied/);
    await db.exec("reset role");
  }
  console.log("vod-upload: ok");
} finally {
  await db.close();
}
