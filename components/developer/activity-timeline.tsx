"use client";

import { Check, Copy } from "lucide-react";
import { type CSSProperties, useEffect, useState } from "react";
import { deviceLabel, fmtDur, hhmm, roleColor } from "@/components/developer/insights-dashboard";
import { getActivityDayAction, type ActivityVisit } from "@/lib/activity/query";
import { describeTarget } from "@/lib/activity/labels";
import { hapticTick } from "@/lib/ui/haptics";

// 그날 행동 타임라인(0062) — 방문(탭) 단위로 묶어 무엇을 했는지 시각순으로 보여준다.
// 개발자 전용. 서버가 개발자 여부를 다시 확인하므로 이 컴포넌트는 표시만 맡는다.
//
// 표시 원칙:
//  - 서버 이벤트(실제 변경)와 클라 이벤트(열람)를 점 색으로 구분한다 — "고쳤다"와 "봤다"는 다르다.
//  - 일정 제목은 공개 일정만 뜬다. 비공개는 범위 라벨로만(서버가 그렇게 내려준다).
//  - viewer·비로그인은 계정이 저장돼 있지 않아 '익명' 방문 줄로만 보인다(구조적 보장).

const ROLE_LABEL: Record<string, string> = {
  anon: "비로그인",
  unknown: "역할 확인 못 함", // 로그인은 했는데 역할 조회가 실패한 기록(2026-09-05, lib/auth/actor.ts)
  viewer: "시청자",
  worker: "작업자",
  manager: "매니저",
  owner: "관리자",
  developer: "개발자"
};

// meta를 한 줄로 — 값이 몇 개 안 되고 전부 원시값이라(sanitizeMeta) 단순 나열이면 충분하다.
function metaLine(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  return Object.entries(meta)
    .map(([k, v]) => `${k}=${Array.isArray(v) ? v.join(",") : String(v)}`)
    .join(" · ");
}

// 복사 텍스트의 줄바꿈. 소스에 개행 리터럴을 직접 쓰면 편집 중 깨지기 쉬워 상수로 둔다.
const NL = String.fromCharCode(10);

type Item = ActivityVisit["items"][number];
type Grouped = Item & { repeat: number; lastT: number };

// 표시 이름: 일정 제목(서버가 권한 확인 후 붙여준 것)이 있으면 그것, 없으면 사전으로 푼다.
// uuid를 그대로 보여주지 않는다 — 코드를 모르는 사람에게 uuid는 아무 뜻도 없다.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function itemName(it: Item): string {
  if (it.targetLabel) return it.targetLabel;
  if (!it.target) return "";
  if (UUID_RE.test(it.target)) {
    // 제목이 안 붙은 uuid — 스티커는 원래 제목이 없고, 일정은 이미 지워진 경우다.
    // teaser./heart./hope.도 대상이 일정이라 같은 갈래로 본다(예전엔 '(알 수 없는 항목)'으로 샜다).
    if (it.kind.startsWith("sticker.")) return "스티커";
    if (/^(event|teaser|heart|hope)\./.test(it.kind)) return "(지워진 일정)";
    return "(알 수 없는 항목)";
  }
  return describeTarget(it.kind, it.target).name;
}
function itemTitle(it: Item): string {
  const d = it.target ? describeTarget(it.kind, it.target) : null;
  return [it.targetLabel, d?.hint, it.target ? `id: ${it.target}` : ""].filter(Boolean).join("\n");
}

// 접기 판정용 meta 지문 — 값이 다르면 같은 행동이 아니다.
// hops·count는 합산 대상(아래에서 더한다)이라 지문에서 뺀다. 이게 없던 때는 target이 없는
// diag.visible이 kind만으로 뭉쳐 **visible=true와 false가 한 줄로 합쳐졌다**(실측 2026-08-07:
// 켜짐/숨김 전환 5번이 "visible=true ×5"가 되어, 탭을 다시 켠 21:32가 안 보였다).
const MERGED_KEYS = new Set(["hops", "count"]);
function metaSig(meta: Record<string, unknown> | null): string {
  if (!meta) return "";
  return Object.keys(meta)
    .filter((k) => !MERGED_KEYS.has(k))
    .sort()
    .map((k) => `${k}=${String(meta[k])}`)
    .join("|");
}

// 같은 행동이 연달아 반복되면 한 줄로 접는다(×N). 접기 전에는 '월 이동 offset=-1'이 12줄씩
// 쌓여 정작 중요한 줄(수정·잠금해제)을 덮었다 — 반복은 정보가 아니라 배경이다.
// 체류(dur_ms)는 합산한다: 같은 화면을 오갔으면 합이 그 화면에 머문 시간이다.
// 시각은 첫 항목 것만 남기지 않는다 — lastT를 들고 있다가 화면·복사본에 '첫–끝'으로 쓴다.
// (예전엔 첫 시각만 보여, 4시간에 걸친 5건이 "17:55 ×5"로 보이고 뒤의 21:32가 사라졌다.)
function groupItems(items: Item[]): Grouped[] {
  const out: Grouped[] = [];
  for (const it of items) {
    const prev = out[out.length - 1];
    if (
      prev &&
      prev.kind === it.kind &&
      prev.target === it.target &&
      metaSig(prev.meta) === metaSig(it.meta)
    ) {
      prev.repeat += 1;
      prev.lastT = it.t;
      if (it.durMs) prev.durMs = (prev.durMs ?? 0) + it.durMs;
      // 세는 값(hops·count)은 합산한다 — 첫 줄 것만 남기면 '×2 hops=17'처럼 나머지가 사라져
      // 실제보다 작게 읽힌다(실측).
      if (prev.meta && it.meta) {
        const merged: Record<string, unknown> = { ...prev.meta };
        for (const key of ["hops", "count"]) {
          const a = prev.meta[key];
          const b = it.meta[key];
          if (typeof a === "number" && typeof b === "number") merged[key] = a + b;
        }
        prev.meta = merged;
      }
      continue;
    }
    out.push({ ...it, repeat: 1, lastT: it.t });
  }
  return out;
}

/**
 * 줄마다 '어느 창 안의 일인가'를 깊이로 매긴다 — 패널 진입/이탈이 여닫는 괄호다.
 *
 * 진입 줄은 여는 괄호이므로 **바깥 깊이**에 서고, 그 뒤의 줄부터 한 칸 들어간다. 이탈 줄은 닫는
 * 괄호라 제 진입 줄과 같은 깊이로 돌아온다. 화면(route)이 바뀌면 스택을 비운다.
 * 짝이 어긋난 기록(이탈 신호 유실)에서도 깊이가 새지 않게, 이탈은 스택에서 그 창을 찾아
 * **그 위에 열린 것들까지 함께** 닫는다. 못 찾으면 깊이를 건드리지 않는다.
 */
const MAX_DEPTH = 3; // 더 들어가면 글자가 오른쪽으로 밀려 읽기가 더 나빠진다
function withDepth(rows: Grouped[]): { it: Grouped; depth: number }[] {
  const stack: string[] = [];
  return rows.map((it) => {
    const t = it.target ?? "";
    if (it.kind === "route.enter" || it.kind === "route.leave") {
      stack.length = 0;
      return { it, depth: 0 };
    }
    if (it.kind === "section.enter") {
      const d = stack.length;
      stack.push(t);
      return { it, depth: Math.min(d, MAX_DEPTH) };
    }
    if (it.kind === "section.leave") {
      const i = stack.lastIndexOf(t);
      if (i >= 0) stack.length = i;
      return { it, depth: Math.min(stack.length, MAX_DEPTH) };
    }
    return { it, depth: Math.min(stack.length, MAX_DEPTH) };
  });
}

// 접힌 방문의 한 줄 요약 — 펼치지 않고도 "무엇을 한 방문인가"가 보여야 한다.
// 실제 변경(server)이 있으면 그게 그 방문의 성격이므로 먼저 세운다.
function visitGist(items: Item[]): string {
  const server = items.filter((i) => i.source === "server");
  const pick = (server.length > 0 ? server : items).map((i) => i.label);
  // 횟수까지 남긴다 — 라벨만 접으면 "저장 12번"이 "저장"이 되어, 접힌 줄만 보고는 한 번 한 일과
  // 반복한 일이 구별되지 않는다(Map은 처음 나온 순서를 지킨다).
  const n = new Map<string, number>();
  for (const label of pick) n.set(label, (n.get(label) ?? 0) + 1);
  const uniq = [...n.entries()];
  const head = uniq
    .slice(0, 3)
    .map(([label, c]) => (c > 1 ? `${label} ×${c}` : label))
    .join(" · ");
  const rest = uniq.length > 3 ? ` 외 ${uniq.length - 3}` : "";
  return (server.length > 0 ? `변경 ${server.length}건 — ` : "") + head + rest;
}

export function ActivityTimeline({
  dateKey,
  reloadKey = 0
}: {
  dateKey: string;
  reloadKey?: number;
}) {
  const [visits, setVisits] = useState<ActivityVisit[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null); // 복사 완료 표시(방문 key, 전체는 "*")
  const [open, setOpen] = useState(true); // 옆 카드와 같은 기본 상태
  const [diag, setDiag] = useState(false); // 진단 층(보존 3일) 포함 — 버그 쫓을 때만
  const [loadedAt, setLoadedAt] = useState<number | null>(null); // 언제 받은 값인지(굳음 감지)

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    getActivityDayAction(dateKey, diag)
      .then((r) => {
        if (!alive) return;
        if (r.ok) setVisits(r.visits);
        else setErr(r.error);
      })
      .finally(() => {
        if (alive) {
          setLoading(false);
          setLoadedAt(Date.now());
        }
      });
    return () => {
      alive = false;
    };
  }, [dateKey, diag, reloadKey]);

  if (loading) {
    // 스켈레톤은 실제 내용이 앉을 자리에 둔다(HCI — 위치 보존).
    return (
      <section className="vcard">
        <h4 className="insight-subhead">행동 타임라인</h4>
        <div className="act-skeleton" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
      </section>
    );
  }
  if (err) {
    return (
      <section className="vcard">
        <h4 className="insight-subhead">행동 타임라인</h4>
        <p className="insight-empty">{err}</p>
      </section>
    );
  }
  if (!visits || visits.length === 0) {
    return (
      <section className="vcard">
        <h4 className="insight-subhead">행동 타임라인</h4>
        <p className="insight-empty">이 날 기록된 행동이 없어요.</p>
      </section>
    );
  }

  // 붙여넣어 공유·보관할 수 있는 평문. 화면과 같은 압축(연속 반복 ×N)을 그대로 쓴다 —
  // 화면에서 본 것과 복사한 것이 달라지면 둘 중 뭘 믿을지 모르게 된다.
  const visitLines = (items: Item[]): string[] =>
    groupItems(items).map((it) => {
      const name = itemName(it);
      const parts = [
        // 접힌 줄은 '첫–끝'. 첫 시각만 쓰면 리포트를 붙여넣은 사람이 "그 뒤로 아무 일도 없었다"로
        // 읽는다(실측: 21:32의 재진입이 17:55 한 줄에 먹혔다).
        it.lastT - it.t >= 60_000 ? `${hhmm(it.t)}–${hhmm(it.lastT)}` : hhmm(it.t),
        it.label + (it.repeat > 1 ? ` ×${it.repeat}` : ""),
        name,
        it.durMs ? fmtDur(Math.round(it.durMs / 1000)) : "",
        metaLine(it.meta),
        // 화면에선 숨기는 원본 id를 복사본에는 반드시 남긴다 — 붙여넣어 오류를 찾으려면
        // (이름이 왜 저래? 왜 뭉쳤어?) 원본이 있어야 한다. 이름과 같으면 생략.
        it.target && it.target !== name ? `[${it.kind} ${it.target}]` : `[${it.kind}]`
      ].filter(Boolean);
      return "  " + parts.join("  ");
    });

  const visitHead = (v: ActivityVisit, items: Item[]): string => {
    const changes = items.filter((i) => i.source === "server").length;
    const diagN = items.filter((i) => i.kind.startsWith("diag.")).length;
    return [
      `[${v.account} · ${ROLE_LABEL[v.role] ?? v.role} · ${deviceLabel(v.device)}] ${hhmm(v.startMs)}–${hhmm(v.endMs)}`,
      `항목 ${items.length}건 (변경 ${changes} · 진단 ${diagN})`
    ].join(NL);
  };
  // 붙여넣으면 바로 원인 분석이 되는 리포트. "이거 했는데 안 됐어요"에 이 한 덩어리만 붙이면
  // 무엇을 눌렀고 화면이 무엇을 그렸는지가 다 들어 있다.
  // 진단 층은 기본 조회에서 빠져 있으므로, 복사할 때는 **그 자리에서 다시 받아** 포함시킨다
  // (사용자가 '진단' 버튼을 켜둔 상태였는지에 결과가 달라지면 안 된다).
  const buildReport = async (v: ActivityVisit | null): Promise<string> => {
    let items = v ? v.items : visits.flatMap((x) => x.items);
    let full = diag;
    if (!diag) {
      const r = await getActivityDayAction(dateKey, true);
      if (r.ok) {
        full = true;
        if (v) items = r.visits.find((x) => x.key === v.key)?.items ?? items;
        else items = r.visits.flatMap((x) => x.items);
      }
    }
    const env = [
      `# VIC 이용 기록 리포트`,
      `날짜 ${dateKey}${v ? "" : " (그날 전체)"}`,
      v ? visitHead(v, items) : `방문 ${visits.length}건 · 항목 ${items.length}건`,
      `진단 층 ${full ? "포함" : "없음(불러오기 실패)"} · 진단 보존 3일 / 일반 90일`,
      // ⚠ 아래 세 줄은 **복사를 누른 이 기기**의 정보다. 기록된 방문의 기기가 아니다.
      // 표시를 안 했더니 안드로이드 방문 리포트에 Windows UA가 찍혀 한 세션으로 읽혔다(실측).
      // 방문의 기기는 위 방문 머리줄에 있다.
      `— 아래는 복사한 기기(기록된 방문의 기기가 아님) —`,
      typeof navigator !== "undefined" ? `복사한 브라우저 ${navigator.userAgent}` : "",
      typeof window !== "undefined"
        ? `복사한 화면 ${window.innerWidth}×${window.innerHeight} · ${window.location.origin}`
        : "",
      `복사 시각 ${new Date().toLocaleString("ko-KR")}`,
      ""
    ].filter(Boolean);
    if (v) return [...env, ...visitLines(items)].join(NL);
    // 그날 전체는 방문별로 나눠 적는다(뭉치면 어느 방문의 일인지 사라진다).
    const byVisit = visits.map((x) => [visitHead(x, x.items), ...visitLines(x.items)].join(NL));
    return [...env, ...byVisit].join(NL + NL);
  };

  const copy = async (text: string, key: string) => {
    hapticTick();
    try {
      await navigator.clipboard.writeText(text);
      hapticTick(); // 누름 → 완료 두 번(사이 간격이 실제 왕복)
      setCopied(key);
      window.setTimeout(() => setCopied((c) => (c === key ? null : c)), 1400);
    } catch {
      setCopied(null); // 클립보드 거부(권한·비보안 컨텍스트) — 조용히 실패
    }
  };
  const copyReport = async (v: ActivityVisit | null, key: string) => {
    setCopied(`${key}:loading`);
    await copy(await buildReport(v), key);
  };

  // 같은 계정이 같은 날 여러 탭을 열면 방문이 탭 수만큼 갈라진다(visit_key = 탭). 그게 사실이지만
  // 보는 쪽에선 "왜 여기 없지?"가 된다 — 다른 탭 줄에 쌓였을 뿐이다. 그래서 탭 번호를 붙인다.
  const tabNo = new Map<string, { n: number; of: number }>();
  {
    const byAccount = new Map<string, ActivityVisit[]>();
    for (const v of visits) {
      const list = byAccount.get(v.account);
      if (list) list.push(v);
      else byAccount.set(v.account, [v]);
    }
    for (const list of byAccount.values()) {
      if (list.length < 2) continue; // 하나뿐이면 번호가 오히려 소음이다
      [...list]
        .sort((a, b) => a.startMs - b.startMs)
        .forEach((v, i) => tabNo.set(v.key, { n: i + 1, of: list.length }));
    }
  }

  return (
    <section className="vcard">
      <header className="act-head">
        {/* 옆 카드(적게 쓰인 기능)와 같은 머리 형식 — 한쪽만 접기가 없으면 어색하다. */}
        <button
          aria-expanded={open}
          className="act-fold"
          data-act="activity-open"
          onClick={() => {
            hapticTick();
            setOpen((v) => !v);
          }}
          type="button"
        >
          <span className="act-caret" aria-hidden="true">
            {open ? "▾" : "▸"}
          </span>
          <span className="insight-subhead">행동 타임라인</span>
        </button>
        {open ? (
        <div className="act-head-tools">
          <button
            className="act-tool"
            data-act="activity-expand-all"
            onClick={() => {
              hapticTick();
              setExpanded((prev) =>
                prev.size === visits.length ? new Set() : new Set(visits.map((v) => v.key))
              );
            }}
            type="button"
          >
            {expanded.size === visits.length ? "접기" : "펼치기"}
          </button>
          <button
            aria-label="그날 전체 진단 리포트 복사"
            className="act-icon"
            data-act="activity-copy"
            onClick={() => copyReport(null, "*")}
            title="그날 전체 진단 리포트 복사"
            type="button"
          >
            {copied === "*" ? <Check size={13} /> : <Copy size={13} />}
          </button>
          <button
            aria-pressed={diag}
            className={`act-tool${diag ? " is-on" : ""}`}
            data-act="activity-diag"
            onClick={() => {
              hapticTick();
              setDiag((v) => !v);
            }}
            title="진단 층까지 화면에 표시 (복사는 항상 포함)"
            type="button"
          >
            진단
          </button>
        </div>
        ) : (
          <span className="usage-gist">
            방문 {visits.length} · {visits.reduce((n, v) => n + v.items.length, 0)}줄
          </span>
        )}
      </header>
      {!open ? null : (
        <>
      <ul className="act-visits">
        {visits.map((v) => {
          const isOpen = expanded.has(v.key); // 바깥 open(카드 접기)과 헷갈리지 않게 다른 이름
          const rows = groupItems(v.items);
          const changes = v.items.filter((i) => i.source === "server").length;
          // 아직 열려 있는 탭 — 클라 배치가 최대 15초에 한 번 올라오므로 3분을 넉넉한 경계로 본다.
          const live = Date.now() - v.endMs < 3 * 60_000;
          return (
            <li className="act-visit" key={v.key} data-open={isOpen ? "" : undefined}>
              {/* 헤더 한 줄: 토글(넓은 과녁) + 복사. 복사를 별도 줄에 두면 그 줄 왼쪽이
                  통째로 빈다 — 헤더 오른쪽 끝에 붙여 빈 공간을 없앤다. */}
              <div className="act-visit-head">
                <button
                  aria-expanded={isOpen}
                  className="act-visit-toggle"
                  data-act="activity-visit-toggle"
                  onClick={() => {
                    hapticTick();
                    setExpanded((prev) => {
                      const next = new Set(prev);
                      if (next.has(v.key)) next.delete(v.key);
                      else next.add(v.key);
                      return next;
                    });
                  }}
                  type="button"
                >
                  <span className="act-caret" aria-hidden="true">
                    {isOpen ? "▾" : "▸"}
                  </span>
                  {/* 점은 **역할 색**(관리자=민트·개발자=파랑·매니저=보라…). 예전엔 기기 색이라
                      개발자와 관리자가 같은 파랑으로 보여 줄이 안 갈렸다(실측 지적).
                      기기는 아래 줄에 글자로 이미 나오므로 색까지 쓸 필요가 없다. */}
                  <span
                    className="act-dev"
                    style={{ background: roleColor(v.role) }}
                    title={ROLE_LABEL[v.role] ?? v.role}
                  />
                  <span className="act-head-main">
                    <b className="act-acct">{v.account}</b>
                    <span className="act-sub">
                      <b style={{ color: roleColor(v.role) }}>{ROLE_LABEL[v.role] ?? v.role}</b> ·{" "}
                      {deviceLabel(v.device)}
                      {tabNo.has(v.key)
                        ? ` · 탭 ${tabNo.get(v.key)!.n}/${tabNo.get(v.key)!.of}`
                        : ""}
                      {changes > 0 ? ` · 변경 ${changes}` : ""} · {rows.length}줄
                    </span>
                  </span>
                  <span className="act-span">
                    {hhmm(v.startMs)}–{live ? <b className="act-live">지금</b> : hhmm(v.endMs)}
                  </span>
                </button>
                <button
                  aria-label="이 방문 진단 리포트 복사"
                  className="act-icon"
                  data-act="activity-copy"
                  onClick={() => copyReport(v, v.key)}
                  title="이 방문의 진단 리포트 복사 — 무엇을 눌렀고 화면이 무엇을 그렸는지까지"
                  type="button"
                >
                  {copied === v.key ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
              {isOpen ? (
                <ol className="act-items">
                  {withDepth(rows).map(({ it, depth }, i) => {
                    const d = it.target ? describeTarget(it.kind, it.target) : null;
                    const name = itemName(it);
                    const area = it.targetLabel ? null : (d?.area ?? null);
                    // 위치는 **바뀔 때만** 적는다 — 같은 화면에서 연달아 한 일이 대부분이라
                    // 매 줄에 '편집실'이 붙으면 그 글자가 화면의 절반을 차지한다. 이름이 이미
                    // 그 위치를 말하는 줄("편집실 → 편집실")도 뺀다.
                    const prev: Grouped | undefined = rows[i - 1];
                    const prevArea = prev
                      ? prev.targetLabel
                        ? null
                        : (prev.target ? describeTarget(prev.kind, prev.target).area ?? null : null)
                      : null;
                    const showArea = Boolean(area) && area !== prevArea && !(area && name.includes(area));
                    // 시각도 **분이 바뀔 때만** — 같은 분에 여덟 줄이 쌓이면 시각 열이 잡음이 된다.
                    const sameMinute = prev ? hhmm(prev.t) === hhmm(it.t) : false;
                    return (
                      <li
                        data-depth={depth || undefined}
                        data-fold={it.kind === "section.enter" ? "open" : it.kind === "section.leave" ? "close" : undefined}
                        data-source={it.source}
                        key={i}
                        style={depth ? ({ "--d": depth } as CSSProperties) : undefined}
                      >
                        {/* 접힌 줄(×N)이 시간 폭을 가지면 끝 시각도 보여준다 — 40px 칸이라
                            옆으로 붙이지 않고 아래에 작게 쌓는다. */}
                        <span className="act-t">
                          {sameMinute ? "" : hhmm(it.t)}
                          {it.lastT - it.t >= 60_000 ? <i>↓{hhmm(it.lastT)}</i> : null}
                        </span>
                        <span className="act-body" title={itemTitle(it)}>
                          {/* 머리글 = 한 일. 종류(버튼·화면 진입…)는 그 뒤의 조용한 꼬리. */}
                          <b className="act-name">{name || it.label}</b>
                          {it.repeat > 1 ? <b className="act-rep">×{it.repeat}</b> : null}
                          {name ? <em className="act-kindq">{it.label}</em> : null}
                          {it.meta ? <span className="act-meta">{metaLine(it.meta)}</span> : null}
                        </span>
                        {showArea ? <em className="act-area">{area}</em> : null}
                        {it.durMs ? (
                          <span className="act-dur">{fmtDur(Math.round(it.durMs / 1000))}</span>
                        ) : null}
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="act-gist">{visitGist(v.items)}</p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="vt-occ-note">
        진한 줄 = 실제 변경 · 옅은 줄 = 열람 · 비공개는 범위만 · 보존 90일(진단 3일)
        {loadedAt ? ` · ${hhmm(loadedAt)} 기준` : ""}
      </p>
        </>
      )}
    </section>
  );
}
