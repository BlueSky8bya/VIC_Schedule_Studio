"use client";

import { useLayoutEffect, useMemo, useRef, type CSSProperties } from "react";
import type { BroadcastTag, ColorPaletteEntry } from "@/lib/domain/schedule-types";
import { createTagVisualResolver } from "@/lib/tags/tag-visual";
import { hapticTick } from "@/lib/ui/haptics";

// 한 칸에 두려고 글자를 줄이는 한도(원래 크기 대비). 이보다 더 줄여야 하면 두 칸을 쓴다.
const MIN_FIT = 0.88;
// 배분정렬 자간 상한(글자 크기 대비) — 넘게 벌리면 "시 참 의 날"처럼 낱글자로 흩어져 보인다.
const MAX_SPREAD = 0.3;

// 2계층 이벤트 태그 피커(편집실/모바일 공용). 대분류별로 묶고, 세부는 그 아래 칩으로. 검색으로
// 많은 태그도 빠르게 찾는다. 세부 칩은 부모 대분류 색을 따라 보여 그룹이 한눈에 보인다.
// 색은 카드에서 '대분류'로 합쳐지므로(중복 색 OK) 피커도 대분류 색으로 칠한다.
export function TagPicker({
  tags,
  palette,
  selectedIds,
  onToggle,
  max,
  disabled = false
}: {
  tags: BroadcastTag[];
  palette: ColorPaletteEntry[];
  selectedIds: string[];
  onToggle: (tagId: string) => void;
  max: number;
  disabled?: boolean;
}) {
  // 0A: 색은 단일 resolver로. 대분류(세부면 부모) 색을 따라간다(기존 categoryColorKey와 동일).
  const tagVisual = useMemo(() => createTagVisualResolver(tags, palette), [tags, palette]);

  // flat 태그를 콘텐츠(content)와 방식(modifier)으로 나눈다. 방식(합방·시참 등)은 "어떻게/누구"라
  // 콘텐츠와 칸을 나눠 고른다. (세부 계층은 폐기 — 게임 이름 등 인스턴스는 제목으로.)
  const { contentTags, modifierTags } = useMemo(() => {
    const tops = [...tags]
      .filter((t) => (t.parentId ?? null) === null)
      .sort((a, b) => Number(a.displayName === "기타") - Number(b.displayName === "기타"));
    return {
      contentTags: tops.filter((t) => t.kind !== "modifier"),
      modifierTags: tops.filter((t) => t.kind === "modifier")
    };
  }, [tags]);

  // 글꼴이 커져 이름이 한 칸에 안 들어가는 칩만 두 칸을 차지한다(2026-11-18 소유자: 1~2개 때문에 3열을
  // 망가뜨리지 않게). 나머지는 그대로 한 칸이고, 빈자리는 뒤 칩이 채운다(CSS grid-auto-flow: dense).
  // 칸 폭·이름 폭을 실측해 DOM 속성(data-wide)만 바꾼다 — 렌더를 다시 돌리지 않는다.
  const root = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const host = root.current;
    if (!host || typeof ResizeObserver === "undefined") return;
    const measure = () => {
      for (const grid of host.querySelectorAll<HTMLElement>(".tp-content, .tp-mods")) {
        const gs = getComputedStyle(grid);
        const cols = gs.gridTemplateColumns.split(" ").filter(Boolean).length;
        const gap = parseFloat(gs.columnGap) || 0;
        const inner = grid.clientWidth - (parseFloat(gs.paddingLeft) || 0) - (parseFloat(gs.paddingRight) || 0);
        const col = (inner - gap * (cols - 1)) / Math.max(1, cols);
        for (const chip of grid.querySelectorAll<HTMLElement>(":scope > .tp-chip")) {
          const name = chip.querySelector<HTMLElement>(".tp-name");
          if (!name) continue;
          // 맞춤(글자 줄임·배분)을 풀고 원래 폭을 잰다. 같은 프레임 안이라 깜빡이지 않고, 결과가 같으면 RO도 다시 울리지 않는다.
          name.style.removeProperty("font-size");
          name.style.removeProperty("letter-spacing");
          name.style.removeProperty("margin-right");
          const cs = getComputedStyle(chip), mark = getComputedStyle(chip, "::before");
          const markW = mark.content && mark.content !== "none" ? (parseFloat(mark.width) || 0) + (parseFloat(cs.columnGap) || 0) : 0;
          const chrome = markW + (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0)
            + (parseFloat(cs.borderLeftWidth) || 0) + (parseFloat(cs.borderRightWidth) || 0);
          const nameW = name.scrollWidth; // 말줄임으로 잘려 있어도 원래 글자 폭
          const room1 = col - chrome - 0.5;
          // 2026-11-18 소유자: 어중간하게 넘치는 이름이 두 칸을 차지하면 오른쪽이 텅 빈다 →
          // ① 조금 넘치면(원래 크기의 88%까지) 그 칩 글자만 살짝 줄여 한 칸에 둔다.
          // ② 그래도 안 되는 진짜 긴 이름만 두 칸 — 남는 폭은 한글 배분정렬(자간, 상한 0.3em)로 채우고,
          //    그래도 남으면 가운데로 모아 양옆 여백을 같게 한다. ③ 두 칸에도 안 들어가면 한 줄 전체(+말줄임).
          const room2 = 2 * col + gap - chrome - 0.5;
          const fit = cols > 1 && col > 0 && nameW > room1 ? room1 / nameW : 1;
          const wide = fit < MIN_FIT ? (nameW > room2 && cols > 2 ? "full" : "2") : null;
          if ((chip.getAttribute("data-wide") ?? null) !== wide) {
            if (wide) chip.setAttribute("data-wide", wide);
            else chip.removeAttribute("data-wide");
          }
          let center = false;
          if (fit < 1 && !wide) {
            name.style.fontSize = `${(parseFloat(getComputedStyle(name).fontSize) * fit).toFixed(2)}px`;
          } else if (wide === "2") {
            const text = name.textContent ?? "";
            const n = [...text].length;
            const em = parseFloat(getComputedStyle(name).fontSize) || 14;
            let spare = room2 - nameW;
            // 한글 배분정렬은 한글만 — 영문·띄어쓰기가 섞인 이름은 자간을 벌리면 단어가 흩어진다.
            if (/[가-힣]/.test(text) && !/[\sA-Za-z0-9]/.test(text) && n > 1 && spare > 0) {
              const ls = Math.min(spare / (n - 1), em * MAX_SPREAD);
              name.style.letterSpacing = `${ls.toFixed(2)}px`;
              name.style.marginRight = `${(-ls).toFixed(2)}px`; // 마지막 글자 뒤 자간은 지운다
              spare -= ls * (n - 1);
            }
            center = spare > 4;
          } else if (wide === "full") {
            // 한 줄 전체 칩도 같은 문법 — 남으면 가운데로(넘쳐서 말줄임이면 왼쪽 정렬 그대로).
            center = cols * col + gap * (cols - 1) - chrome - nameW > 4;
          }
          if (chip.hasAttribute("data-center") !== center) chip.toggleAttribute("data-center", center);
        }
      }
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(host);
    for (const name of host.querySelectorAll(".tp-name")) ro.observe(name);
    document.fonts?.addEventListener("loadingdone", measure);
    return () => { ro.disconnect(); document.fonts?.removeEventListener("loadingdone", measure); };
  }, [tags, selectedIds]);

  const full = selectedIds.length >= max;
  const orderOf = (id: string) => selectedIds.indexOf(id);

  const chip = (tag: BroadcastTag, isSub: boolean) => {
    const v = tagVisual.visualOf(tag.id);
    if (v.missing || !v.bg) return null;
    const selected = selectedIds.includes(tag.id);
    const blocked = !selected && full;
    return (
      <button
        className={`tp-chip${isSub ? " sub" : ""}${selected ? " selected" : ""}`}
        data-color={v.colorKey ?? undefined}
        disabled={disabled || blocked}
        key={tag.id}
        onClick={() => {
          hapticTick();
          onToggle(tag.id);
        }}
        style={
          {
            // 색은 CSS 변수로 전달 — 기본 렌더는 이전과 동일하고, 편집 팝오버처럼
            // 스코프별로 '색 점 + 선택 시 채움' 등으로 재해석할 수 있게 한다.
            "--tp-bg": v.cssBg,
            "--tp-border": v.cssBorder ?? undefined,
            "--tp-ink": v.cssInk ?? undefined
          } as CSSProperties
        }
        title={blocked ? `태그는 최대 ${max}개까지 고를 수 있어요` : tag.displayName}
        type="button"
       data-act="tp-chip">
        {selected ? <b className="tp-order">{orderOf(tag.id) + 1}</b> : null}
        <span className="tp-name">{tag.displayName}</span>
      </button>
    );
  };

  // 두 묶음(콘텐츠·형식)은 같은 카드 문법(.tp-group: 라벨이 칸 '안'에)으로 통일한다 —
  // 예전엔 콘텐츠 라벨만 칸 밖에 떠 있어 비대칭이었다(2026-08-31 사용자 지적).
  // 선택 개수(n/max) 배지는 이 컴포넌트가 아니라 호출부의 '태그' 제목 옆에 붙는다.
  return (
    <div className="tag-picker2" ref={root}>
      <div className="tp-group">
        <div className="tp-section-label">콘텐츠</div>
        <div className="tp-content">{contentTags.map((t) => chip(t, false))}</div>
      </div>
      {modifierTags.length > 0 ? (
        <div className="tp-group tp-group-mods">
          <div className="tp-section-label">형식</div>
          <div className="tp-mods">{modifierTags.map((t) => chip(t, false))}</div>
        </div>
      ) : null}
    </div>
  );
}
