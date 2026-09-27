// 이용 기록을 **사람 말로** 풀어 쓰는 층(2026-09-27 소유자: "gate.pass니 typed=false니 내가 이거 어떻게 해석해").
// 화면·복사 리포트가 같은 함수를 쓴다. 원시 kind/meta 표기는 여기서 끝나고 밖으로 새지 않는다.
//
//  - describeMeta: meta 객체 → "저장하고 닫음 · 태그 1개" 같은 한 줄.
//  - buildStory:   행동 목록 → "08:00  10월 1일 새 일정 — 제목 입력, 옵션 바꿈 → 저장 (47초)" 같은 흐름 줄.
//  - buildGist:    행동 목록 → 한 줄 요약.
// 순수 함수(서버·클라 공용). 개인정보 없음 — 넘어오는 건 이미 공개 제목/범위 라벨뿐이다.
import { describeTarget } from "@/lib/activity/labels";
import { KIND_LABEL } from "@/lib/activity/kinds";

export type NarrativeItem = {
  t: number;
  kind: string;
  target: string | null;
  targetLabel: string | null;
  meta: Record<string, unknown> | null;
  durMs: number | null;
  source: "server" | "client";
};

// ── meta 번역 ──────────────────────────────────────────────────────────────
const HOW: Record<string, string> = {
  saved: "저장하고 닫음",
  esc: "ESC로 닫음",
  cell: "다른 칸 눌러 닫음",
  collapse: "접어서 닫음",
  x: "닫기 눌러 닫음",
  other: "닫음"
};
const MODE: Record<string, string> = { new: "새 일정", edit: "일정 수정" };
const KEY: Record<string, string> = {
  date: "날짜",
  tags: "태그",
  scope: "공개 범위",
  teaser: "최초공개",
  support: "업 도움",
  multiday: "여러 날",
  offset: "이동",
  hops: "칸 이동",
  count: "횟수",
  visible: "탭",
  kind: "종류",
  from: "출발",
  to: "도착",
  side: "쪽",
  on: "켬",
  value: "값"
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export function dateLabel(v: unknown): string {
  if (typeof v !== "string" || !DATE_RE.test(v)) return "";
  return `${Number(v.slice(5, 7))}월 ${Number(v.slice(8, 10))}일`;
}

/** meta → 사람 말 한 줄. skip에 든 키는 뺀다(이름 옆에 이미 쓴 날짜 등). 기본값·false는 말하지 않는다. */
export function describeMeta(meta: Record<string, unknown> | null, skip?: ReadonlySet<string>): string {
  if (!meta) return "";
  const out: string[] = [];
  const how = typeof meta.how === "string" ? meta.how : null;
  for (const [k, raw] of Object.entries(meta)) {
    if (skip?.has(k)) continue;
    const v = Array.isArray(raw) ? raw.join(",") : raw;
    switch (k) {
      case "how":
        out.push(HOW[String(v)] ?? `닫음(${String(v)})`);
        break;
      case "saved":
        if (!how && v === true) out.push("저장함");
        break;
      case "typed":
        if (v === true) out.push("입력함");
        break;
      case "mode":
        out.push(MODE[String(v)] ?? String(v));
        break;
      case "date":
        out.push(dateLabel(v) || String(v));
        break;
      case "tags":
        if (typeof v === "number" && v > 0) out.push(`태그 ${v}개`);
        break;
      case "scope":
        if (v === "private" || v === "owner_private") out.push("비공개");
        break;
      case "teaser":
        if (v === true) out.push("최초공개");
        break;
      case "support":
        if (v === true) out.push("업 도움");
        break;
      case "multiday":
        if (v === true) out.push("여러 날");
        break;
      case "offset":
        if (typeof v === "number" && v !== 0) out.push(`${v > 0 ? "다음" : "이전"} ${Math.abs(v)}달`);
        break;
      case "hops":
        if (typeof v === "number" && v > 0) out.push(`${v}칸 이동`);
        break;
      case "count":
        if (typeof v === "number" && v > 1) out.push(`${v}번`);
        break;
      case "visible":
        out.push(v === true ? "탭 보임" : "탭 숨김");
        break;
      default:
        if (v === false || v === null || v === undefined || v === "") break;
        out.push(v === true ? (KEY[k] ?? k) : `${KEY[k] ?? k} ${String(v)}`);
    }
  }
  return out.join(" · ");
}

// ── 이름 ──────────────────────────────────────────────────────────────────
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export function itemName(it: NarrativeItem): string {
  if (it.targetLabel) return it.targetLabel === "(공개 전 최초공개 일정)" ? "최초공개 일정" : it.targetLabel;
  if (!it.target) return "";
  if (UUID_RE.test(it.target)) {
    if (it.kind.startsWith("sticker.")) return "스티커";
    if (/^(event|teaser|heart|hope)\./.test(it.kind)) return "(지워진 일정)";
    return "(알 수 없는 항목)";
  }
  return describeTarget(it.kind, it.target).name;
}
export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind;
}

// ── 시간 표기 ──────────────────────────────────────────────────────────────
export function hhmm(ms: number): string {
  const d = new Date(ms + 9 * 3_600_000);
  return `${String(d.getUTCHours()).padStart(2, "0")}:${String(d.getUTCMinutes()).padStart(2, "0")}`;
}
export function fmtDur(sec: number): string {
  if (sec < 60) return `${sec}초`;
  const m = Math.round(sec / 60);
  if (m < 60) return `${m}분`;
  const h = Math.floor(m / 60);
  return `${h}시간${m % 60 ? ` ${m % 60}분` : ""}`;
}

// ── 흐름(이야기) ───────────────────────────────────────────────────────────
const IDLE_MS = 5 * 60_000; // 이보다 긴 틈은 '자리 비움'으로 말한다
const BROWSE_TARGETS = new Set(["calendar-cell", "auto:.studio-event-pill", "studio-event-pill", "agenda-item"]);

// 편집 카드 안에서 누른 것 → 동사구. 없으면 사전 이름 그대로.
function editorVerb(target: string): string | null {
  if (target === "title-input") return "제목 입력";
  if (target === "tp-chip") return "태그 고름";
  if (target === "opt-chip") return "옵션 바꿈";
  if (target.startsWith("dtp-")) return "공개 시각 고름";
  if (target === "미정 표시") return "미정 토글";
  if (target === "fold-head") return "패널 접었다 폄";
  if (target === "close-teaser-gate") return "잠금 화면 닫음";
  if (target === "save-event" || target === "teaser-gate-submit" || target === "calendar-cell") return null;
  if (target.startsWith("auto:")) return null;
  const d = describeTarget("ui.click", target);
  return d.unnamed ? null : d.name;
}

type Episode = {
  start: number;
  end: number;
  date: string;
  mode: string;
  title: string; // 만들거나 고친 일정 제목(서버 이벤트에서)
  verbs: string[]; // 순서 유지, 중복 제거
  created: number;
  updated: number;
  deleted: number;
  gateSubmit: number;
  gatePass: number;
  idleMs: number;
  how: string;
};

function pushUniq(arr: string[], v: string | null) {
  if (v && !arr.includes(v)) arr.push(v);
}

function episodeText(e: Episode): string {
  const parts: string[] = [];
  if (e.gatePass > 0) parts.push("비밀번호 확인");
  if (e.gateSubmit > e.gatePass) parts.push(`비밀번호 ${e.gateSubmit - e.gatePass}번 틀림`);
  for (const v of e.verbs) parts.push(v);
  if (e.created) parts.push(e.title ? `"${e.title}" 만듦` : "일정 만듦");
  if (e.updated) parts.push(e.updated > 1 ? `${e.updated}번 고침` : "고침");
  if (e.deleted) parts.push("지움");
  const head = `${dateLabel(e.date) || "일정"} ${MODE[e.mode] ?? "편집"} 카드`;
  const tail = HOW[e.how] ?? (e.how ? `닫음(${e.how})` : "닫음");
  const dur = e.end > e.start ? fmtDur(Math.round((e.end - e.start) / 1000)) : "";
  const idle = e.idleMs >= IDLE_MS ? `, 카드 열어둔 채 ${fmtDur(Math.round(e.idleMs / 1000))} 자리 비움` : "";
  return `${head} — ${parts.length ? parts.join(", ") : "아무것도 안 고침"} → ${tail}${dur ? ` (${dur})` : ""}${idle}`;
}

/** 방문 하나의 행동 목록 → 흐름 줄 배열. */
export function buildStory(items: NarrativeItem[]): string[] {
  const rows = [...items].sort((a, b) => a.t - b.t);
  const lines: { t: number; end: number; text: string; key: string; n: number }[] = [];
  const push = (t: number, end: number, text: string, key = "") => {
    const last = lines[lines.length - 1];
    // 같은 이야기가 연달아 반복되면 한 줄로(×N) — 떡밥 일정을 다섯 번 열어 고친 것은 다섯 줄이 아니라 한 줄이다.
    if (key && last && last.key === key) {
      last.n += 1;
      last.end = end;
      return;
    }
    lines.push({ t, end, text, key, n: 1 });
  };

  let browse: { t: number; end: number; cells: number; cards: number } | null = null;
  const flushBrowse = () => {
    if (!browse) return;
    const bits: string[] = [];
    if (browse.cards) bits.push(`일정 카드 ${browse.cards}번`);
    if (browse.cells) bits.push(`날짜 칸 ${browse.cells}번`);
    push(browse.t, browse.end, `달력 둘러봄 — ${bits.join(", ")} 눌러봄`);
    browse = null;
  };

  let ep: Episode | null = null;
  let prevT: number | null = null;
  for (const it of rows) {
    // 틈 — 편집 카드 안이면 카드에 귀속, 밖이면 독립 줄.
    if (prevT !== null && it.t - prevT >= IDLE_MS) {
      if (ep) ep.idleMs += it.t - prevT;
      else {
        flushBrowse();
        push(prevT, it.t, `자리 비움 ${fmtDur(Math.round((it.t - prevT) / 1000))}`);
      }
    }
    prevT = it.t;

    if (it.kind === "section.enter" && it.target === "editor") {
      // 카드를 연 그 클릭(직전 5초 안의 카드/칸 누름)은 '둘러봄'이 아니라 카드 열기다 — 빼고 남은 게 있을 때만 둘러봄 줄.
      if (browse && it.t - browse.end <= 5000) {
        if (browse.cards > 0) browse.cards -= 1;
        else if (browse.cells > 0) browse.cells -= 1;
        if (browse.cards + browse.cells === 0) browse = null;
      }
      flushBrowse();
      ep = {
        start: it.t,
        end: it.t,
        date: typeof it.meta?.date === "string" ? it.meta.date : "",
        mode: typeof it.meta?.mode === "string" ? it.meta.mode : "",
        title: "",
        verbs: [],
        created: 0,
        updated: 0,
        deleted: 0,
        gateSubmit: 0,
        gatePass: 0,
        idleMs: 0,
        how: ""
      };
      continue;
    }
    if (ep) {
      if (it.kind === "section.leave" && it.target === "editor") {
        ep.end = it.t;
        ep.how = typeof it.meta?.how === "string" ? it.meta.how : "";
        const text = episodeText(ep);
        // 반복 접기 키: 같은 날짜·같은 모드·같은 결과면 같은 이야기.
        push(ep.start, ep.end, text, `ep|${ep.date}|${ep.mode}|${ep.how}|${ep.updated > 0}|${ep.created > 0}`);
        ep = null;
        continue;
      }
      if (it.kind === "ui.click" && it.target) {
        if (it.target === "teaser-gate-submit") ep.gateSubmit += 1;
        else pushUniq(ep.verbs, editorVerb(it.target));
      } else if (it.kind === "gate.pass") ep.gatePass += 1;
      else if (it.kind === "event.create") {
        ep.created += 1;
        ep.title ||= itemName(it);
      } else if (it.kind === "event.update") {
        ep.updated += 1;
        ep.title ||= itemName(it);
      } else if (it.kind === "event.delete") ep.deleted += 1;
      else if (it.source === "server" || it.kind.startsWith("section.")) {
        pushUniq(ep.verbs, `${kindLabel(it.kind)}${itemName(it) ? ` ${itemName(it)}` : ""}`);
      }
      continue;
    }

    // 카드 밖
    if (it.kind === "ui.click" && it.target && BROWSE_TARGETS.has(it.target)) {
      browse ??= { t: it.t, end: it.t, cells: 0, cards: 0 };
      browse.end = it.t;
      if (it.target === "calendar-cell") browse.cells += 1;
      else browse.cards += 1;
      continue;
    }
    if (it.kind === "ui.click" && it.target && /^month-(next|prev)$/.test(it.target)) continue; // month.change가 말한다
    if (it.kind === "gate.pass") continue; // 카드 밖에 찍힌 통과는 순서가 밀린 것 — 카드 줄이 이미 말한다
    if (it.kind.startsWith("diag.")) continue;
    flushBrowse();
    if (it.kind === "month.change") {
      push(it.t, it.t, `${String(it.target ?? "").replace(/^\d{4}-0?/, "")}월 달력 봄`);
      continue;
    }
    if (it.kind === "route.enter") {
      push(it.t, it.t, `${itemName(it) || "다른 화면"}으로 이동`);
      continue;
    }
    if (it.kind === "route.leave" || it.kind === "section.leave") continue;
    if (it.kind === "section.enter") {
      push(it.t, it.t, `${itemName(it) || "창"} 엶`);
      continue;
    }
    if (it.kind === "ui.click") {
      const d = it.target ? describeTarget("ui.click", it.target) : null;
      if (!d || d.unnamed) continue;
      push(it.t, it.t, `${d.name} 누름`, `click|${it.target}`);
      continue;
    }
    const name = itemName(it);
    push(it.t, it.t, `${kindLabel(it.kind)}${name ? ` — ${name}` : ""}`, `k|${it.kind}|${it.target ?? ""}`);
  }
  if (ep) {
    ep.end = prevT ?? ep.start;
    push(ep.start, ep.end, episodeText(ep) + " (닫힘 기록 없음)");
  }
  flushBrowse();

  return lines.map((l) => {
    const time = l.end - l.t >= 60_000 ? `${hhmm(l.t)}–${hhmm(l.end)}` : hhmm(l.t);
    return `${time}  ${l.text}${l.n > 1 ? ` ×${l.n}` : ""}`;
  });
}

/** 한 줄 요약 — 만든 것·고친 것·비밀번호·자리 비움. */
export function buildGist(items: NarrativeItem[]): string {
  const rows = [...items].sort((a, b) => a.t - b.t);
  const created = rows.filter((i) => i.kind === "event.create").map(itemName);
  const updated = new Set(rows.filter((i) => i.kind === "event.update").map((i) => i.target ?? ""));
  const updateN = rows.filter((i) => i.kind === "event.update").length;
  const deleted = rows.filter((i) => i.kind === "event.delete").length;
  const gateSubmit = rows.filter((i) => i.kind === "ui.click" && i.target === "teaser-gate-submit").length;
  const gatePass = rows.filter((i) => i.kind === "gate.pass").length;
  let idle = 0;
  for (let i = 1; i < rows.length; i++) {
    const gap = rows[i].t - rows[i - 1].t;
    if (gap >= IDLE_MS) idle += gap;
  }
  const bits: string[] = [];
  if (created.length) bits.push(`일정 ${created.length}개 만듦(${created.map((c) => `"${c}"`).join(", ")})`);
  if (updateN) bits.push(`일정 ${updated.size}개를 ${updateN}번 고침`);
  if (deleted) bits.push(`일정 ${deleted}개 지움`);
  if (gatePass || gateSubmit) {
    bits.push(`최초공개 비밀번호 확인 ${gatePass}번${gateSubmit > gatePass ? `(${gateSubmit - gatePass}번 틀림)` : ""}`);
  }
  if (idle >= IDLE_MS) bits.push(`자리 비움 ${fmtDur(Math.round(idle / 1000))}`);
  if (bits.length === 0) bits.push("둘러보기만 하고 바꾼 것 없음");
  return bits.join(" · ");
}
