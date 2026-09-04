// 합방(게스트) 다시보기 등록(0075) — 토리님이 **다른 스트리머 방송국**에 출연한 VOD를 vod_archive에 guest 행으로 넣는다.
// 수집기(chapi 목록)는 토리님 방송국만 읽으므로 이 스크립트가 유일한 입구다. 메타는 SOOP VOD 조회 API에서 받는다
// (api.m.sooplive.co.kr/station/video/a/view — 제목·호스트 id/닉·길이·방송 시각·썸네일·조회수, 무인증 공개).
// 팬 타임라인(0071)도 같이 수집한다(댓글 API 경로는 **호스트** 채널).
//
// 사용: node scripts/add-guest-vods.mjs 251221=https://vod.sooplive.com/player/181346197 260221=187565207 ...
//   왼쪽 = 방송 시작일(KST, YYMMDD 또는 YYYY-MM-DD) — 토리님 일정과 맞추는 날짜. API의 방송 시작일과 다르면 경고만 하고
//   준 날짜를 믿는다(합방은 호스트 방송 시각 기준이라 새벽 경계 등 사람 판단이 우선).
// 멱등: 같은 title_no는 갱신(upsert). .env.local(운영 DB)을 읽는다 — 실행 = 운영 데이터 쓰기.
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
if (!U || !K) {
  console.error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY를 .env.local에서 찾지 못했습니다.");
  process.exit(1);
}
const H = { apikey: K, Authorization: `Bearer ${K}`, "Content-Type": "application/json" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── 인자 파싱 ────────────────────────────────────────────────────────────────────────────────
function parseDay(s) {
  const m6 = /^(\d{2})(\d{2})(\d{2})$/.exec(s);
  if (m6) return `20${m6[1]}-${m6[2]}-${m6[3]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  return null;
}
function parseTitleNo(s) {
  const m = /player\/(\d+)/.exec(s) ?? /^(\d+)$/.exec(s.trim());
  return m ? Number(m[1]) : null;
}
const targets = [];
for (const arg of process.argv.slice(2)) {
  const eq = arg.indexOf("=");
  if (eq < 0) {
    console.error(`형식 오류: ${arg} (YYMMDD=URL|title_no)`);
    process.exit(1);
  }
  const day = parseDay(arg.slice(0, eq).trim());
  const titleNo = parseTitleNo(arg.slice(eq + 1).trim());
  if (!day || !titleNo) {
    console.error(`형식 오류: ${arg}`);
    process.exit(1);
  }
  targets.push({ day, titleNo });
}
if (!targets.length) {
  console.error("등록할 항목이 없습니다. 예: node scripts/add-guest-vods.mjs 251221=https://vod.sooplive.com/player/181346197");
  process.exit(1);
}

// ── SOOP ──────────────────────────────────────────────────────────────────────────────────────
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
const kstToIso = (v) => {
  if (typeof v !== "string" || v.length < 19) return null;
  const ms = Date.parse(`${v.slice(0, 19).replace(" ", "T")}+09:00`);
  return Number.isFinite(ms) ? new Date(ms).toISOString() : null;
};
async function fetchVodInfo(titleNo) {
  const res = await fetch("https://api.m.sooplive.co.kr/station/video/a/view", {
    method: "POST",
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Content-Type": "application/x-www-form-urlencoded",
      Referer: "https://vod.sooplive.co.kr/"
    },
    body: `nTitleNo=${titleNo}&nApiLevel=10&nPlaylistIdx=0`,
    signal: AbortSignal.timeout(10000)
  });
  if (!res.ok) throw new Error(`view API ${res.status}`);
  const json = await res.json();
  if (json?.result !== 1 || !json.data) throw new Error(`view API result ${json?.result}`);
  return json.data;
}
// ── 타임라인 파서(lib/broadcast/vod-timeline.ts 복제) ───────────────────────────────────────
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
async function fetchTimeline(hostId, titleNo) {
  const comments = [];
  for (let page = 1; page <= 2; page += 1) {
    try {
      const res = await fetch(`https://chapi.sooplive.co.kr/api/${hostId}/title/${titleNo}/comment?page=${page}&per_page=30`, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(8000)
      });
      if (!res.ok) break;
      const j = await res.json();
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
      best = { nick: typeof c.user_nick === "string" ? decodeHtmlEntities(c.user_nick) : "", commentNo: Number(c.p_comment_no) || null, entries };
    }
  }
  return best;
}
async function upsert(table, rows) {
  const res = await fetch(`${U}/rest/v1/${table}?on_conflict=title_no`, {
    method: "POST",
    headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows)
  });
  if (!res.ok) throw new Error(`${table} upsert ${res.status}: ${await res.text()}`);
}

// ── 실행 ──────────────────────────────────────────────────────────────────────────────────────
for (const t of targets) {
  const d = await fetchVodInfo(t.titleNo);
  const [startKst, endKst] = String(d.write_tm ?? "").split("~").map((s) => s.trim());
  const apiDay = startKst ? startKst.slice(0, 10) : null;
  if (apiDay && apiDay !== t.day) console.warn(`  ! ${t.titleNo}: 준 날짜 ${t.day} ≠ API 방송 시작일 ${apiDay} — 준 날짜로 귀속`);
  const row = {
    title_no: t.titleNo,
    bno: d.broad_idx ? String(d.broad_idx) : null,
    broadcast_day: t.day,
    title: decodeHtmlEntities(String(d.title ?? d.full_title ?? "")),
    duration_ms: Number(d.total_file_duration) || 0,
    reg_date: kstToIso(endKst) ?? kstToIso(startKst),
    comment_cnt: Number(d.memo_cnt) || 0,
    like_cnt: Number(d.recommend_cnt) || 0,
    read_cnt: Number(d.view_cnt) || 0,
    auth_no: Number.isFinite(Number(d.auth_no)) ? Number(d.auth_no) : 0,
    thumb: typeof d.thumb === "string" ? d.thumb : "",
    guest: true,
    host_id: String(d.bj_id ?? ""),
    host_nick: decodeHtmlEntities(String(d.writer_nick ?? "")),
    synced_at: new Date().toISOString()
  };
  await upsert("vod_archive", [row]);
  const tl = await fetchTimeline(row.host_id, t.titleNo);
  await upsert("vod_timeline", [
    {
      title_no: t.titleNo,
      author_nick: tl?.nick ?? "",
      comment_no: tl?.commentNo ?? null,
      entry_count: tl?.entries.length ?? 0,
      entries: tl?.entries ?? [],
      synced_at: new Date().toISOString()
    }
  ]);
  console.log(
    `✓ ${t.day} #${t.titleNo} [${row.host_nick} / ${row.host_id}] ${row.title} — ${Math.round(row.duration_ms / 60000)}분 · auth ${row.auth_no} · 타임라인 ${tl ? `${tl.entries.length}개(${tl.nick})` : "없음"}`
  );
  await sleep(300);
}
console.log(`완료: ${targets.length}건. 공개 캐시(300초)가 지나면 시청자 화면에 보입니다 — 바로 보려면 배포 후 revalidate.`);
