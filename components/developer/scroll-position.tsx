"use client";

import { useEffect, useState, type RefObject } from "react";

// 목록 안에서 "지금 어디쯤 읽고 있나"를 알려주는 표시(2026-09-11 소유자 요청).
//
// 이 창의 목록들(행동 타임라인 · 적게 쓰인 기능 · 세션 로그)은 제 안에서 스크롤하되
// **스크롤바를 그리지 않는다**(창 공통 규칙). 그래서 길게 펼치면 전체에서 어디쯤인지 알 방법이
// 없었다. 스크롤바를 되살리는 대신 위치를 **글자와 눈금으로** 말한다 — 끌 수 없는 표시라
// 조작 수단이 아니라 이정표다.
//
// 값은 목록의 직계 자식(li)을 재어 구한다: 지금 보이는 줄의 범위 · 전체 대비 비율 ·
// 맨 위 줄이 스스로 밝힌 이름(data-pos, 예: 시각·위치). 비율만 쓰면 "34%"가 몇 번째인지
// 감이 안 오고, 번호만 쓰면 목록이 길 때 감이 안 온다 — 둘 다 준다.

const TICKS = 8; // 눈금 칸 수. 스크롤바로 오해되지 않게 성기게 끊는다.

type Pos = { from: number; to: number; total: number; pct: number; label: string };

export function ScrollPosition({
  listRef,
  unit = "줄",
  watch
}: {
  listRef: RefObject<HTMLElement | null>;
  /** 세는 단위 — "줄" · "건" · "개". */
  unit?: string;
  /** 목록 내용이 바뀌면 다시 재도록 넘기는 값(길이·필터 서명 등). */
  watch?: string | number;
}) {
  const [pos, setPos] = useState<Pos | null>(null);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const max = el.scrollHeight - el.clientHeight;
      // 넘치지 않으면 표시할 위치가 없다(모바일은 목록이 통째로 늘어나 여기로 온다).
      if (max <= 4) {
        setPos((p) => (p === null ? p : null));
        return;
      }
      const cr = el.getBoundingClientRect();
      const kids = Array.from(el.children) as HTMLElement[];
      let from = -1;
      let to = -1;
      for (let i = 0; i < kids.length; i += 1) {
        const r = kids[i].getBoundingClientRect();
        if (r.bottom > cr.top + 4 && r.top < cr.bottom - 4) {
          if (from < 0) from = i;
          to = i;
        }
      }
      if (from < 0) {
        from = 0;
        to = 0;
      }
      const next: Pos = {
        from,
        to,
        total: kids.length,
        pct: Math.round((el.scrollTop / max) * 100),
        label: kids[from]?.dataset.pos ?? ""
      };
      setPos((p) =>
        p &&
        p.from === next.from &&
        p.to === next.to &&
        p.total === next.total &&
        p.pct === next.pct &&
        p.label === next.label
          ? p
          : next
      );
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(measure);
    };
    measure();
    el.addEventListener("scroll", onScroll, { passive: true });
    // 내용·크기가 바뀌면 다시 잰다. 언마운트 순간 0×0으로 울리는 건 위 max 가드가 흡수한다.
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onScroll);
      ro.disconnect();
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [listRef, watch]);

  if (!pos) return null;
  const filled = Math.round((pos.pct / 100) * (TICKS - 1));
  return (
    <div className="scrollpos" aria-hidden="true">
      <span className="scrollpos-ticks">
        {Array.from({ length: TICKS }, (_, i) => (
          <i data-on={i <= filled ? "1" : undefined} key={i} />
        ))}
      </span>
      <span className="scrollpos-n">
        {pos.from + 1}
        {pos.to > pos.from ? `–${pos.to + 1}` : ""} / {pos.total}
        {unit}
      </span>
      <span className="scrollpos-pct">{pos.pct}%</span>
      {pos.label ? <em className="scrollpos-label">{pos.label}</em> : null}
    </div>
  );
}
