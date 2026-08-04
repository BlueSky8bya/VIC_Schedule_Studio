"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { deviceColor, deviceLabel, fmtDur, hhmm } from "@/components/developer/insights-dashboard";
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

type Item = ActivityVisit["items"][number];
type Grouped = Item & { repeat: number };

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

// 같은 행동이 연달아 반복되면 한 줄로 접는다(×N). 접기 전에는 '월 이동 offset=-1'이 12줄씩
// 쌓여 정작 중요한 줄(수정·잠금해제)을 덮었다 — 반복은 정보가 아니라 배경이다.
// 체류(dur_ms)는 합산한다: 같은 화면을 오갔으면 합이 그 화면에 머문 시간이다.
function groupItems(items: Item[]): Grouped[] {
  const out: Grouped[] = [];
  for (const it of items) {
    const prev = out[out.length - 1];
    if (prev && prev.kind === it.kind && prev.target === it.target) {
      prev.repeat += 1;
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
    out.push({ ...it, repeat: 1 });
  }
  return out;
}

// 접힌 방문의 한 줄 요약 — 펼치지 않고도 "무엇을 한 방문인가"가 보여야 한다.
// 실제 변경(server)이 있으면 그게 그 방문의 성격이므로 먼저 세운다.
function visitGist(items: Item[]): string {
  const server = items.filter((i) => i.source === "server");
  const pick = (server.length > 0 ? server : items).map((i) => i.label);
  const uniq: string[] = [];
  for (const label of pick) if (!uniq.includes(label)) uniq.push(label);
  const head = uniq.slice(0, 3).join(" · ");
  const rest = uniq.length > 3 ? ` 외 ${uniq.length - 3}` : "";
  return (server.length > 0 ? `변경 ${server.length}건 — ` : "") + head + rest;
}

export function ActivityTimeline({ dateKey }: { dateKey: string }) {
  const [visits, setVisits] = useState<ActivityVisit[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copied, setCopied] = useState<string | null>(null); // 복사 완료 표시(방문 key, 전체는 "*")
  const [open, setOpen] = useState(true); // 옆 카드와 같은 기본 상태

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    getActivityDayAction(dateKey)
      .then((r) => {
        if (!alive) return;
        if (r.ok) setVisits(r.visits);
        else setErr(r.error);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [dateKey]);

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
  const visitText = (v: ActivityVisit): string => {
    const head = `[${v.account} · ${ROLE_LABEL[v.role] ?? v.role} · ${deviceLabel(v.device)}] ${hhmm(v.startMs)}–${hhmm(v.endMs)}`;
    const lines = groupItems(v.items).map((it) => {
      const name = itemName(it);
      const parts = [
        hhmm(it.t),
        it.label + (it.repeat > 1 ? ` ×${it.repeat}` : ""),
        name,
        it.durMs ? fmtDur(Math.round(it.durMs / 1000)) : "",
        metaLine(it.meta),
        // 화면에선 숨기는 원본 id를 복사본에는 반드시 남긴다 — 붙여넣어 오류를 찾으려면
        // (이름이 왜 저래? 왜 뭉쳤어?) 원본이 있어야 한다. 이름과 같으면 생략.
        it.target && it.target !== name ? `[${it.kind} ${it.target}]` : ""
      ].filter(Boolean);
      return "  " + parts.join("  ");
    });
    return [head, ...lines].join("\n");
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
  const allText = `${dateKey}\n\n${visits.map(visitText).join("\n\n")}`;

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
            {expanded.size === visits.length ? "모두 접기" : "모두 펼치기"}
          </button>
          <button
            className="act-tool"
            data-act="activity-copy"
            onClick={() => copy(allText, "*")}
            type="button"
          >
            {copied === "*" ? "복사됨" : "복사"}
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
                  <span className="act-dev" style={{ background: deviceColor(v.device) }} />
                  <span className="act-head-main">
                    <b className="act-acct">{v.account}</b>
                    <span className="act-sub">
                      {ROLE_LABEL[v.role] ?? v.role} · {deviceLabel(v.device)}
                      {changes > 0 ? ` · 변경 ${changes}` : ""} · {rows.length}줄
                    </span>
                  </span>
                  <span className="act-span">
                    {hhmm(v.startMs)}–{hhmm(v.endMs)}
                  </span>
                </button>
                <button
                  aria-label="이 방문 복사"
                  className="act-icon"
                  data-act="activity-copy"
                  onClick={() => copy(visitText(v), v.key)}
                  title="이 방문 복사"
                  type="button"
                >
                  {copied === v.key ? <Check size={13} /> : <Copy size={13} />}
                </button>
              </div>
              {isOpen ? (
                <ol className="act-items">
                  {rows.map((it, i) => {
                    const d = it.target ? describeTarget(it.kind, it.target) : null;
                    return (
                      <li key={i} data-source={it.source}>
                        <span className="act-t">{hhmm(it.t)}</span>
                        <span className="act-body" title={itemTitle(it)}>
                          <span className="act-kind">
                            {it.label}
                            {it.repeat > 1 ? <b className="act-rep">×{it.repeat}</b> : null}
                          </span>
                          {/* 위치는 이름 앞에 조용히 — 일정 제목이 붙은 줄에는 없다. */}
                          {!it.targetLabel && d?.area ? (
                            <em className="act-area">{d.area}</em>
                          ) : null}
                          <span className="act-target">{itemName(it)}</span>
                          {it.meta ? <span className="act-meta">{metaLine(it.meta)}</span> : null}
                        </span>
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
        진한 줄 = 실제 변경 · 옅은 줄 = 열람 · 비공개는 범위만 · 보존 90일
      </p>
        </>
      )}
    </section>
  );
}
