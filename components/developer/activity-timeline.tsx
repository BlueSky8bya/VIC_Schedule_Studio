"use client";

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
function itemName(it: Item): string {
  if (it.targetLabel) return it.targetLabel;
  if (!it.target) return "";
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
      const parts = [
        hhmm(it.t),
        it.label + (it.repeat > 1 ? ` ×${it.repeat}` : ""),
        itemName(it),
        it.durMs ? fmtDur(Math.round(it.durMs / 1000)) : "",
        metaLine(it.meta)
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
        <h4 className="insight-subhead">행동 타임라인</h4>
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
            {copied === "*" ? "복사됨" : "전체 복사"}
          </button>
        </div>
      </header>
      <ul className="act-visits">
        {visits.map((v) => {
          const open = expanded.has(v.key);
          const rows = groupItems(v.items);
          return (
            <li className="act-visit" key={v.key}>
              {/* 방문은 기본 접힘 — 하루에 방문이 여럿이면 펼친 채로는 아무것도 안 보인다.
                  헤더 자체가 토글이라 클릭 과녁이 넓다(HCI: 포인터 이동 최소화). */}
              <button
                aria-expanded={open}
                className="act-visit-head"
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
                  {open ? "▾" : "▸"}
                </span>
                <span className="act-dev" style={{ background: deviceColor(v.device) }} />
                <b className="act-acct">{v.account}</b>
                <span className="act-role">{ROLE_LABEL[v.role] ?? v.role}</span>
                <span className="act-span">
                  {hhmm(v.startMs)}–{hhmm(v.endMs)} · {deviceLabel(v.device)} · {rows.length}줄
                </span>
                {open ? null : <span className="act-gist">{visitGist(v.items)}</span>}
              </button>
              {open ? (
                <>
                  {/* 펼친 김에 이 방문만 따로 복사 — 특정 세션을 공유할 때 전체는 과하다. */}
                  <div className="act-visit-tools">
                    <button
                      className="act-tool"
                      data-act="activity-copy"
                      onClick={() => copy(visitText(v), v.key)}
                      type="button"
                    >
                      {copied === v.key ? "복사됨" : "이 방문 복사"}
                    </button>
                  </div>
                  <ol className="act-items">
                  {rows.map((it, i) => (
                    <li key={i} data-source={it.source}>
                      <span className="act-t">{hhmm(it.t)}</span>
                      <span className="act-kind">
                        {it.label}
                        {it.repeat > 1 ? <b className="act-rep">×{it.repeat}</b> : null}
                      </span>
                      {/* 일정은 제목(권한 확인 후 조인), 그 외는 사람이 읽는 이름으로 푼다 —
                          타임라인에 `.stf-btn` 같은 값이 그대로 뜨면 읽을 수 없다. */}
                      <span className="act-target" title={itemTitle(it)}>
                        {itemName(it)}
                      </span>
                      {it.durMs ? (
                        <span className="act-dur">{fmtDur(Math.round(it.durMs / 1000))}</span>
                      ) : null}
                      {it.meta ? <span className="act-meta">{metaLine(it.meta)}</span> : null}
                    </li>
                  ))}
                  </ol>
                </>
              ) : null}
            </li>
          );
        })}
      </ul>
      <p className="vt-occ-note">
        점이 진한 줄은 실제 변경(서버 기록), 옅은 줄은 열람입니다. 비공개 일정은 제목 대신 범위만
        표시돼요. 보존 90일.
      </p>
    </section>
  );
}
