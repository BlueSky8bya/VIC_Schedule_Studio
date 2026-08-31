// 팬 타임라인 초기 백필(0071) — vod_archive 전체의 댓글에서 타임라인을 파싱해 vod_timeline에 저장.
// 파싱 규칙은 lib/broadcast/vod-timeline.ts와 동일해야 한다. 이후 증분은 broadcast-poll 크론.
// 사용: node scripts/backfill-vod-timelines.mjs
import { readFileSync } from "node:fs";

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

// ── lib/broadcast/vod-timeline.ts의 파서 복제 ──
function decodeHtmlEntities(text) {
  let out = text;
  for (let i = 0; i < 3; i += 1) {
    const next = out
      .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&amp;/g, "&");
    if (next === out) break;
    out = next;
  }
  return out;
}
const ENTRY_RE = /^\s*(\d{1,2}):(\d{2})(?::(\d{2}))?\s+(.+?)\s*$/;
const SECTION_RE = /^\s*\[\s*([^\]]+?)\s*\]\s*(?:[-–]\s*(.+?))?\s*$/;
function cleanSection(inner, tail) {
  let name = inner.replace(/^[^가-힣A-Za-z0-9]*:?\s*/, "").replace(/\s*:\s*$/, "");
  name = name.replace(/([가-힣])\s+(?=[가-힣])/g, "$1");
  if (tail) name = `${name} - ${tail}`;
  return name.trim();
}
function parseTimeline(text) {
  const out = [];
  let section = null;
  for (const rawLine of decodeHtmlEntities(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const entry = ENTRY_RE.exec(line);
    if (entry) {
      const h = entry[3] !== undefined ? Number(entry[1]) : 0;
      const m = entry[3] !== undefined ? Number(entry[2]) : Number(entry[1]);
      const s = entry[3] !== undefined ? Number(entry[3]) : Number(entry[2]);
      const sec = h * 3600 + m * 60 + s;
      const label = entry[4].trim();
      if (label.length > 0 && Number.isFinite(sec)) out.push({ sec, label, section });
      continue;
    }
    const head = SECTION_RE.exec(line);
    if (head) {
      const name = cleanSection(head[1], head[2]);
      if (name.length > 0) section = name;
    }
  }
  out.sort((a, b) => a.sec - b.sec);
  return out;
}

const vods = [];
for (let off = 0; ; off += 500) {
  const r = await fetch(`${U}/rest/v1/vod_archive?select=title_no&order=reg_date.desc&limit=500&offset=${off}`, {
    headers: H
  }).then((x) => x.json());
  vods.push(...r.map((v) => Number(v.title_no)));
  if (r.length < 500) break;
}
console.log("대상 VOD:", vods.length);

let withTl = 0;
let done = 0;
for (const titleNo of vods) {
  const comments = [];
  for (let page = 1; page <= 2; page += 1) {
    try {
      const j = await fetch(
        `https://chapi.sooplive.co.kr/api/${BJ}/title/${titleNo}/comment?page=${page}&per_page=30`,
        { headers: { "User-Agent": "Mozilla/5.0" } }
      ).then((x) => x.json());
      comments.push(...(j.data ?? []));
      if (page >= (j.meta?.last_page ?? 1)) break;
    } catch {
      break;
    }
  }
  let best = null;
  for (const c of comments) {
    if (typeof c.comment !== "string") continue;
    const entries = parseTimeline(c.comment);
    if (entries.length < 3) continue;
    if (!best || entries.length > best.entries.length) {
      best = { nick: decodeHtmlEntities(c.user_nick ?? ""), commentNo: c.p_comment_no ?? null, entries };
    }
  }
  if (best) withTl += 1;
  const res = await fetch(`${U}/rest/v1/vod_timeline?on_conflict=title_no`, {
    method: "POST",
    headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([
      {
        title_no: titleNo,
        author_nick: best?.nick ?? "",
        comment_no: best?.commentNo ?? null,
        entry_count: best?.entries.length ?? 0,
        entries: best?.entries ?? [],
        synced_at: new Date().toISOString()
      }
    ])
  });
  if (!res.ok) throw new Error(`upsert 실패: ${res.status} ${await res.text()}`);
  done += 1;
  if (done % 40 === 0) console.log(`  진행 ${done}/${vods.length} (타임라인 ${withTl})`);
  await sleep(200);
}
console.log(`완료: ${done}개 확인, 타임라인 존재 ${withTl}개.`);
