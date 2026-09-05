// 팬 타임라인 파서 **거울**(0071) — `lib/broadcast/vod-timeline.ts`의 규칙을 그대로 옮긴 것.
//
// 왜 사본이 있나: 백필/재수집 스크립트는 순수 node(.mjs)라 TS 모듈(경로 별칭 `@/`)을 못 읽는다.
// 왜 안전한가: `tests/unit/vod-timeline.test.ts`의 "거울 동치" 테스트가 두 구현을 같은 표본에
// 통과시켜 출력이 어긋나면 빌드가 깨진다. 규칙을 고치면 **양쪽 다** 고친다.
export function decodeHtmlEntities(text) {
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

const LEAD_RE = /^\s*((?:[ㄴ└>▸▹»]\s*|[-–—·•‣]\s+)+)/;
const HIER_RE = /[ㄴ└>▸▹»]/g;
const TIME_RE = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/;
const WORDISH = /[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ぀-ヿ一-鿿]/;
const TIME_WORD = /^(분|초|시|쯤|경|부터|까지|께)/;
const TRAIL_RE = /^(.{1,32}?)\s+((?:\d{1,2}:\d{1,2}(?::\d{1,2})?[\s*]*)+)$/;
const TIME_TOKEN_RE = /\d{1,2}:\d{1,2}(?::\d{1,2})?/g;
const MAX_DEPTH = 3;
const SECTION_RE = /^\s*\[\s*([^\]]+?)\s*\]\s*(?:[-–]\s*(.+?))?\s*$/;

function cleanSection(inner, tail) {
  let name = inner.replace(/^[^가-힣A-Za-z0-9]*:?\s*/, "").replace(/\s*:\s*$/, "");
  name = name.replace(/([가-힣])\s+(?=[가-힣])/g, "$1");
  if (tail) name = `${name} - ${tail}`;
  return name.trim();
}

function stripLead(text) {
  const m = LEAD_RE.exec(text);
  if (!m) return { rest: text.trimStart(), depth: 0 };
  return { rest: text.slice(m[0].length), depth: (m[1].match(HIER_RE) ?? []).length };
}

function toSeconds(hh, mm, ss) {
  const h = ss !== undefined ? Number(hh) : 0;
  const m = ss !== undefined ? Number(mm) : Number(hh);
  const s = ss !== undefined ? Number(ss) : Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s)) return null;
  if (s > 59) return null;
  if (ss !== undefined && m > 59) return null;
  return h * 3600 + m * 60 + s;
}

function parseEntryLine(line) {
  const lead = stripLead(line);
  let rest = lead.rest;
  let depth = lead.depth;
  const close = rest[0] === "[" ? "]" : rest[0] === "(" ? ")" : "";
  if (close) rest = rest.slice(1).trimStart();
  const t = TIME_RE.exec(rest);
  if (!t) return null;
  rest = rest.slice(t[0].length);
  if (close) {
    const after = rest.replace(/^\s*/, "");
    if (after[0] !== close) return null;
    rest = after.slice(1);
  } else if (TIME_WORD.test(rest)) {
    return null;
  }
  rest = rest.replace(/^[:：]+\s*/, "");
  const tail = stripLead(rest);
  const label = tail.rest.trim();
  if (!WORDISH.test(label)) return null;
  depth = Math.min(depth + tail.depth, MAX_DEPTH);
  const sec = toSeconds(t[1], t[2], t[3]);
  if (sec === null) return null;
  return depth > 0 ? { sec, label, section: null, depth } : { sec, label, section: null };
}

function parseTrailingTimeLine(line) {
  const m = TRAIL_RE.exec(line);
  if (!m) return [];
  const lead = stripLead(m[1]);
  const head = lead.rest.trim();
  const bracket = /^\[\s*([^\]]+?)\s*\]$/.exec(head);
  const label = bracket ? cleanSection(bracket[1]) : head;
  if (!WORDISH.test(label)) return [];
  const out = [];
  for (const token of m[2].match(TIME_TOKEN_RE) ?? []) {
    const p = token.split(":");
    const sec = toSeconds(p[0], p[1], p[2]);
    if (sec === null) continue;
    const depth = Math.min(lead.depth, MAX_DEPTH);
    out.push(depth > 0 ? { sec, label, section: null, depth } : { sec, label, section: null });
  }
  return out;
}

export function parseTimeline(text) {
  const out = [];
  let section = null;
  for (const rawLine of decodeHtmlEntities(text).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    const entry = parseEntryLine(line);
    if (entry) {
      entry.section = section;
      out.push(entry);
      continue;
    }
    const head = SECTION_RE.exec(line);
    if (head) {
      if (TIME_RE.test(head[1].trim())) continue;
      const name = cleanSection(head[1], head[2]);
      if (name.length > 0) section = name;
      continue;
    }
    const trailing = parseTrailingTimeLine(line);
    if (trailing.length > 0) {
      for (const e of trailing) {
        e.section = section;
        out.push(e);
      }
      continue;
    }
  }
  out.sort((a, b) => a.sec - b.sec);
  return out;
}

export function pickTimelineComment(comments) {
  let best = null;
  for (const c of comments) {
    if (typeof c.comment !== "string") continue;
    const entries = parseTimeline(c.comment);
    if (entries.length < 3) continue;
    if (!best || entries.length > best.entries.length) {
      best = {
        nick: typeof c.user_nick === "string" ? decodeHtmlEntities(c.user_nick) : "",
        commentNo: Number.isFinite(Number(c.p_comment_no)) ? Number(c.p_comment_no) : null,
        entries
      };
    }
  }
  return best;
}
