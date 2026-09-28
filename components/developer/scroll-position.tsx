"use client";

import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

// 목록 안에서 "지금 어디쯤 읽고 있나"를 알려주는 표시(2026-09-11 소유자 요청 → 2026-09-28 개정).
//
// 이 창의 목록들(행동 타임라인 · 적게 쓰인 기능 · 세션 로그)은 제 안에서 스크롤하되
// **스크롤바를 그리지 않는다**(창 공통 규칙). 그래서 길게 펼치면 전체에서 어디쯤인지, 아래에
// 더 있는지 알 방법이 없었다. 처음엔 눈금+숫자(3–7 / 42줄 · 34%)로 말했는데 딱딱하고 눈에 안
// 띄었다(2026-09-28 소유자). 지금은 두 가지로 말한다:
//   ① 목록 오른쪽 가장자리의 **읽기 구슬** — 가는 홈을 따라 미끄러지는 빛나는 구슬. 스크롤하는
//      동안 또렷해지고, 손을 떼면 잦아들어 흐릿한 점으로 남는다(iOS 인디케이터 문법). 맨 위 줄이
//      스스로 밝힌 이름(data-pos, 예: 시각)이 구슬 옆 알약에 따라붙는다 — 숫자 대신 이정표.
//   ② 목록 자체의 **가장자리 페이드**(data-edge) — 위/아래에 더 있으면 그쪽 끝이 종이 속으로
//      녹아든다. "스크롤이 끝났나?"를 숫자 없이 한눈에 말한다.
// 조작 수단이 아니라 이정표다(끌 수 없음).
//
// 배치: 이 컴포넌트는 목록 **바로 앞** 형제로 둔다. 높이 0인 앵커에서 목록의 위치·높이를 재어
// 구슬 홈을 절대배치하므로 부모에 position을 요구하지 않는다.

const IDLE_MS = 1100; // 마지막 스크롤 뒤 이만큼 지나면 구슬이 잦아든다.

type Pos = { pct: number; label: string; top: number; height: number; edge: string };

export function ScrollPosition({
  listRef,
  watch
}: {
  listRef: RefObject<HTMLElement | null>;
  /** 세는 단위 — 예전 숫자 표시의 흔적. 호환용으로 받기만 한다. */
  unit?: string;
  /** 목록 내용이 바뀌면 다시 재도록 넘기는 값(길이·필터 서명 등). */
  watch?: string | number;
}) {
  const [pos, setPos] = useState<Pos | null>(null);
  const [live, setLive] = useState(false);
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const idleRef = useRef(0);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    let raf = 0;
    const measure = () => {
      raf = 0;
      const max = el.scrollHeight - el.clientHeight;
      // 넘치지 않으면 표시할 위치가 없다(모바일은 목록이 통째로 늘어나 여기로 온다).
      if (max <= 4) {
        delete el.dataset.edge;
        setPos((p) => (p === null ? p : null));
        return;
      }
      const cr = el.getBoundingClientRect();
      const ar = anchorRef.current?.getBoundingClientRect();
      const kids = Array.from(el.children) as HTMLElement[];
      let first = -1;
      for (let i = 0; i < kids.length; i += 1) {
        const r = kids[i].getBoundingClientRect();
        if (r.bottom > cr.top + 4 && r.top < cr.bottom - 4) {
          first = i;
          break;
        }
      }
      const atTop = el.scrollTop <= 2;
      const atBottom = el.scrollTop >= max - 2;
      const edge = atTop && atBottom ? "none" : atTop ? "bottom" : atBottom ? "top" : "top bottom";
      // 가장자리 페이드는 목록 자신이 그린다(마스크) — 구슬은 목록 밖 형제라 마스크에 안 잘린다.
      if (el.dataset.edge !== edge) el.dataset.edge = edge;
      const next: Pos = {
        pct: Math.min(1, Math.max(0, el.scrollTop / max)),
        label: kids[first]?.dataset.pos ?? "",
        top: ar ? cr.top - ar.top : 0,
        height: cr.height,
        edge
      };
      setPos((p) =>
        p &&
        p.pct === next.pct &&
        p.label === next.label &&
        p.top === next.top &&
        p.height === next.height
          ? p
          : next
      );
    };
    const onScroll = () => {
      if (!raf) raf = window.requestAnimationFrame(measure);
    };
    const onUserScroll = () => {
      onScroll();
      setLive(true);
      window.clearTimeout(idleRef.current);
      idleRef.current = window.setTimeout(() => setLive(false), IDLE_MS);
    };
    measure();
    el.addEventListener("scroll", onUserScroll, { passive: true });
    // 내용·크기가 바뀌면 다시 잰다. 언마운트 순간 0×0으로 울리는 건 위 max 가드가 흡수한다.
    const ro = new ResizeObserver(onScroll);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", onUserScroll);
      ro.disconnect();
      window.clearTimeout(idleRef.current);
      if (raf) window.cancelAnimationFrame(raf);
    };
  }, [listRef, watch]);

  // 앵커는 위치를 재는 기준이라 pos가 없어도 항상 그린다(높이 0 — 배치에 영향 없음).
  return (
    <div
      aria-hidden="true"
      className="scrollpos"
      data-live={live ? "1" : undefined}
      ref={anchorRef}
      style={
        pos
          ? ({
              "--sp-top": `${pos.top}px`,
              "--sp-h": `${pos.height}px`,
              "--sp-pct": pos.pct.toFixed(4)
            } as CSSProperties)
          : undefined
      }
    >
      {pos ? (
        <div className="scrollpos-rail">
          <span className="scrollpos-bead">
            {pos.label ? <em className="scrollpos-tag">{pos.label}</em> : null}
          </span>
        </div>
      ) : null}
    </div>
  );
}
