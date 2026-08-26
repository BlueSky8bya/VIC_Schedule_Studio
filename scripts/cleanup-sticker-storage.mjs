// 0065(스티커·작업자 철수) 동반 스크립트 — 스티커 스토리지 버킷의 객체를 비운다.
//   node scripts/cleanup-sticker-storage.mjs          # dry-run: 객체 목록만
//   node scripts/cleanup-sticker-storage.mjs --delete # 실제 삭제
// .env.local의 SUPABASE_SERVICE_ROLE_KEY를 읽는다(서버 전용). 대상 버킷: 'sticker-assets'
// (db/policies/0006_sticker_uploads.sql이 만든 공개 버킷). 삭제 뒤 0065 SQL이 빈 버킷 행을 지운다.
import fs from "node:fs";

const env = Object.fromEntries(
  fs
    .readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^"|"$/g, "")];
    })
);
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const key = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 필요");
  process.exit(1);
}
const BUCKET = "sticker-assets";
const doDelete = process.argv.includes("--delete");
const H = { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json" };

async function listAll(prefix = "") {
  const out = [];
  let offset = 0;
  for (;;) {
    const res = await fetch(`${url}/storage/v1/object/list/${BUCKET}`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ prefix, limit: 100, offset, sortBy: { column: "name", order: "asc" } })
    });
    if (!res.ok) throw new Error(`list ${res.status}: ${await res.text()}`);
    const items = await res.json();
    for (const it of items) {
      // 폴더(메타 없는 항목)는 재귀
      if (!it.id && !it.metadata) out.push(...(await listAll(`${prefix}${it.name}/`)));
      else out.push(`${prefix}${it.name}`);
    }
    if (items.length < 100) break;
    offset += 100;
  }
  return out;
}

const names = await listAll();
console.log(`bucket ${BUCKET}: ${names.length} objects`);
for (const n of names) console.log("  ", n);
if (!doDelete) {
  console.log("(dry-run — 실제 삭제는 --delete)");
  process.exit(0);
}
if (names.length > 0) {
  const res = await fetch(`${url}/storage/v1/object/${BUCKET}`, {
    method: "DELETE",
    headers: H,
    body: JSON.stringify({ prefixes: names })
  });
  if (!res.ok) throw new Error(`delete ${res.status}: ${await res.text()}`);
  console.log("deleted", names.length);
}
// 객체가 0이면 버킷 자체도 지운다(SQL에선 storage.buckets 직접 삭제가 금지됨).
const del = await fetch(`${url}/storage/v1/bucket/${BUCKET}`, { method: "DELETE", headers: H });
console.log("bucket delete", del.status, del.ok ? "" : (await del.text()).slice(0, 120));
console.log("done — 이제 0065 마이그레이션을 적용한다.");
