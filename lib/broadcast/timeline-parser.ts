export type TimelineEntry = {
  sec: number;
  label: string;
  section: string | null; // 팬이 적은 [코너] 헤더 — 예: "소통", "게임 - FC26"
  // 팬이 "ㄴ"으로 표시한 계층 — 0(최상위)이면 아예 안 담는다(항목 100+개 × jsonb 절약).
  depth?: number;
};

// 숲 댓글 API는 본문을 HTML 이스케이프해서 준다("IT&#039;s Me") — 저장 전에 푼다.
// 이중 이스케이프도 실재해서(&amp;amp;, &amp;gt; — 2026-09-01 prod 실측) 안정될 때까지 반복,
// 상한 3회(팬이 진짜 "&amp;"를 쓰고 싶던 극단은 포기 — 표시 깨짐보다 낫다).
export function decodeHtmlEntities(text: string): string {
  let out = text;
  for (let i = 0; i < 3; i += 1) {
    const next = out
      .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
      .replace(/&#(\d+);/g, (_, dec: string) => String.fromCodePoint(Number(dec)))
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

// 항목 줄 → 초 + 라벨 + 계층. 팬마다 표기 습관이 다르다 — **2026-09-06 VOD 385편 댓글 전수조사**로
// 아래 표기를 모두 받도록 넓혔다(그전엔 첫 줄 형태만 읽어 나머지는 통째로 버려졌다):
//   "1:02:03 라벨" · "02:15 라벨"            ← 원래 지원
//   "[ 02:10:55 ] 라벨" · "(02:10) 라벨"      ← 괄호로 감싼 시각(이 표기의 댓글은 항목 0개로 전멸)
//   "ㄴ[ 02:13:59 ] 세부" · "00:15:00 ㄴ 세부" ← 계층 표시(앞·뒤 양쪽 습관)
//   "01:18:00토리님 복귀"                     ← 시각과 라벨이 붙은 표기
//   "02:29:49:✨:라벨"                        ← 시각 뒤 구분 콜론
//   "00:7:30 귤 노가리"                       ← 분·초 한 자리 오타
//   "발로란트 01:23:25" · "[🌺무꽃피] 54:30"  ← 라벨이 앞, 시각이 뒤(여러 시각이면 항목 여러 개)
// 일부러 **안** 받는 것: 라벨 없는 시각 나열("4:40:04*" 76줄 — 클립 표시라 목록에 쓸 게 없다),
// 날짜 표기("[ 26.06.02 ]"), 다른 방송을 가리키는 긴 문장(라벨 32자 상한 밖).
// "ㄴ"(└ >)는 "바로 위 항목에 딸린 세부"라는 팬들의 관습 — 라벨에 묻어두지 않고 depth로 뽑아
// UI가 들여쓰기로 보여준다. 순수 불릿(- · •)은 벗기기만 하고 계층으로 세지 않는다(뒤에 공백을
// 요구해서 "-20도" 같은 라벨을 갉아먹지 않는다).
const LEAD_RE = /^\s*((?:[ㄴ└>▸▹»]\s*|[-–—·•‣]\s+)+)/;
const HIER_RE = /[ㄴ└>▸▹»]/g;
// 분·초가 한 자리인 오타도 받는다("00:7:30" — 실측 1건). 대신 값 범위를 검사한다.
const TIME_RE = /^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?/;
// 라벨 자격: 글자/숫자가 하나는 있어야 한다. "4:40:04*"처럼 기호만 남는 줄(클립 표시 76개, 실측)이
// 항목으로 둔갑하는 걸 막는다.
const WORDISH = /[0-9A-Za-z가-힣ㄱ-ㅎㅏ-ㅣ぀-ヿ一-鿿]/;
// 시각에 바로 붙는 시간 표현("12:34분에 시작함") — 항목이 아니라 본문이다.
const TIME_WORD = /^(분|초|시|쯤|경|부터|까지|께)/;
// 라벨이 먼저, 시각이 뒤인 표기("발로란트 01:23:25", "[🌺무꽃피] 54:30", "롤 23:05 01:45:20").
// 라벨 32자 상한이 본문 문장을 걸러낸다(실측: 이 규칙이 잡는 10줄 전부 진짜 항목, 남는 탈락은
// 다른 스트리머 다시보기를 가리키는 38자 문장 하나 — 그건 이 플레이어로 못 뛰니 빼는 게 맞다).
const TRAIL_RE = /^(.{1,32}?)\s+((?:\d{1,2}:\d{1,2}(?::\d{1,2})?[\s*]*)+)$/;
const TIME_TOKEN_RE = /\d{1,2}:\d{1,2}(?::\d{1,2})?/g;
const MAX_DEPTH = 3;
// "[💬:소통]" / "[  게 임  ] - FC26" 같은 코너 헤더 줄.
const SECTION_RE = /^\s*\[\s*([^\]]+?)\s*\]\s*(?:[-–]\s*(.+?))?\s*$/;

/** 줄머리(또는 시각 뒤)의 계층·불릿 표시를 벗기고 계층 깊이를 센다. */
function stripLead(text: string): { rest: string; depth: number } {
  const m = LEAD_RE.exec(text);
  if (!m) return { rest: text.trimStart(), depth: 0 };
  return { rest: text.slice(m[0].length), depth: (m[1].match(HIER_RE) ?? []).length };
}

/** "1:02:03"/"02:15" 토큰 → 초. 분·초가 60을 넘으면 시각이 아니다(널). */
function toSeconds(hh: string, mm: string, ss?: string): number | null {
  const h = ss !== undefined ? Number(hh) : 0;
  const m = ss !== undefined ? Number(mm) : Number(hh);
  const s = ss !== undefined ? Number(ss) : Number(mm);
  if (!Number.isFinite(h) || !Number.isFinite(m) || !Number.isFinite(s)) return null;
  if (s > 59) return null;
  if (ss !== undefined && m > 59) return null; // "MM:SS"의 분은 60을 넘어도 된다("90:12")
  return h * 3600 + m * 60 + s;
}

/** 항목 줄 하나 → 엔트리(항목이 아니면 null — 호출자가 코너 헤더/장식 줄로 넘긴다). */
function parseEntryLine(line: string): TimelineEntry | null {
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
    if (after[0] !== close) return null; // 여는 괄호만 있으면 항목이 아니다
    rest = after.slice(1);
  } else if (TIME_WORD.test(rest)) {
    return null; // "12:34분에 시작함" 같은 본문 속 시각
  }
  // 시각 바로 뒤의 구분 콜론("02:29:49:✨:라벨")은 라벨이 아니라 이음새다.
  rest = rest.replace(/^[:：]+\s*/, "");
  const tail = stripLead(rest); // 시각 뒤에 붙는 계층 표시("00:15:00 ㄴ 세부")도 같은 뜻
  const label = tail.rest.trim();
  if (!WORDISH.test(label)) return null; // 빈 줄·기호만 남은 클립 표시
  depth = Math.min(depth + tail.depth, MAX_DEPTH);
  const sec = toSeconds(t[1], t[2], t[3]);
  if (sec === null) return null;
  return depth > 0 ? { sec, label, section: null, depth } : { sec, label, section: null };
}

/** "라벨 시각[ 시각…]" 줄 → 같은 라벨의 엔트리들(아니면 빈 배열). */
function parseTrailingTimeLine(line: string): TimelineEntry[] {
  const m = TRAIL_RE.exec(line);
  if (!m) return [];
  const lead = stripLead(m[1]);
  const head = lead.rest.trim();
  // "[🌺무꽃피]"처럼 통째로 대괄호면 코너 이름 정리를 그대로 쓴다.
  const bracket = /^\[\s*([^\]]+?)\s*\]$/.exec(head);
  const label = bracket ? cleanSection(bracket[1]) : head;
  if (!WORDISH.test(label)) return [];
  const out: TimelineEntry[] = [];
  for (const token of m[2].match(TIME_TOKEN_RE) ?? []) {
    const p = token.split(":");
    const sec = toSeconds(p[0], p[1], p[2]);
    if (sec === null) continue;
    const depth = Math.min(lead.depth, MAX_DEPTH);
    out.push(depth > 0 ? { sec, label, section: null, depth } : { sec, label, section: null });
  }
  return out;
}

// 코너 이름 정리: 이모지·콜론 접두 제거("💬:소통"→"소통"), 벌린 공백 접기("게 임"→"게임").
function cleanSection(inner: string, tail?: string): string {
  let name = inner.replace(/^[^가-힣A-Za-z0-9]*:?\s*/, "").replace(/\s*:\s*$/, "");
  name = name.replace(/([가-힣])\s+(?=[가-힣])/g, "$1");
  if (tail) name = `${name} - ${tail}`;
  return name.trim();
}

/** 타임라인 댓글 원문 → 챕터 배열(시각 오름차순 보장, 파싱 불가 줄은 건너뜀). */
export function parseTimeline(text: string): TimelineEntry[] {
  const out: TimelineEntry[] = [];
  let section: string | null = null;
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
      // "[ 02:10:55 ]"처럼 라벨 없는 시각 줄이 코너 이름 "02:10:55"로 둔갑하지 않게 막는다.
      if (TIME_RE.test(head[1].trim())) continue;
      const name = cleanSection(head[1], head[2]);
      if (name.length > 0) section = name;
      continue;
    }
    // 라벨이 앞, 시각이 뒤인 표기는 마지막에 본다(앞선 규칙이 다 아니라고 한 줄에서만).
    const trailing = parseTrailingTimeLine(line);
    if (trailing.length > 0) {
      for (const e of trailing) {
        e.section = section;
        out.push(e);
      }
      continue;
    }
    // 그 외 장식 줄(✨타임라인✨ 등)은 무시.
  }
  out.sort((a, b) => a.sec - b.sec);
  return out;
}
