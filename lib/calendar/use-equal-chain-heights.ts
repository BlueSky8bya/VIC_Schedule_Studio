"use client";

import { useCallback, useEffect, useRef } from "react";

// 화면 px ÷ 레이아웃 px — 포스터 표면은 transform으로, 편집실은 CSS zoom으로 줄어 있다.
function scaleOf(el: HTMLElement): number {
  const w = el.offsetWidth;
  const r = el.getBoundingClientRect().width;
  return w > 0 && r > 0 ? r / w : 1;
}

// 꺾인 띠 이음(buildChainJoins의 curve 판정 — 2026-11-16 소유자 C안) — 앞날 카드(data-curve-from)의 오른쪽 변과
// 다음날 카드(data-curve-to)의 왼쪽 변을, 칸 사이 틈에서 위/아래로 꺾여 오르내리는 '카드와 같은 몸통'으로 잇는다.
// 선이 아니라 띠라서 카드와 같은 채움·테두리색이고, 카드 뒤(z 1)에 깔려 맞닿는 변은 카드가 덮는다.
// 굵기 = 칸 사이 틈에서 양옆 여백 2px씩을 뺀 값을 7~12px로 묶는다 — 옆 일정과 딱 붙어 보이지 않고(2026-11-16 소유자
// "너무 딱 달라붙어"), 좁아도 7px 아래로 가늘어지지 않는다. 모서리는 카드 반경과 같은 볼록·5px 오목.
// svg는 앞 카드 칸 안(칸 기준 좌표).
const STEP_MIN = 7;
const STEP_MAX = 12;
const STEP_CLEAR = 2;
const STEP_CONVEX = 7;
const STEP_CONCAVE = 5;

// 색: 테두리 = 카드에 지정된 태그 테두리색(인라인). 편집실은 고르면 테두리를 투명으로 바꾸므로 계산값만 믿으면
// 띠가 사라진다 — 인라인 → 계산값(투명 아님) 순. 채움 = 카드 계산 배경색(2색 카드면 다음 카드 → 테두리색).
function opaque(c: string | undefined): boolean {
  return Boolean(c && c !== "transparent" && !/rgba\([^)]*,\s*0\)$/.test(c));
}
function strokeOf(el: HTMLElement): string {
  if (el.style.borderColor) return el.style.borderColor;
  const b = getComputedStyle(el).borderTopColor;
  return opaque(b) ? b : "currentColor";
}
// 편집실 카드는 바탕색 위에 단색 덧칠(linear-gradient(같은색, 같은색))을 한 겹 더 얹는다 — 띠에도 같은 겹을 얹어야
// 카드와 띠 색이 같아진다(안 얹으면 띠만 진한 줄무늬로 보였다, 2026-11-16 실측).
function flatOverlaysOf(el: HTMLElement): string[] {
  const img = getComputedStyle(el).backgroundImage;
  if (!img || img === "none") return [];
  const out: string[] = [];
  const re = /linear-gradient\((?:[^,()]+,\s*)?(rgba?\([^)]*\))\s*,\s*(rgba?\([^)]*\))\s*\)/g;
  for (let m = re.exec(img); m; m = re.exec(img)) if (m[1] === m[2]) out.push(m[1]);
  return out;
}
// 볼록 모서리 = 카드 자신의 모서리 반경(4~10px) — 띠의 꺾임이 카드 모서리와 같은 곡률로 이어진다.
function convexOf(el: HTMLElement): number {
  const r = parseFloat(getComputedStyle(el).borderTopLeftRadius);
  return Number.isFinite(r) ? Math.min(10, Math.max(4, r)) : STEP_CONVEX;
}
// 띠 테두리 두께 = 카드 테두리 두께. 경로를 그 절반만큼 안으로 들여 그려야 카드 테두리와 같은 줄에 선다
// (가운데 정렬 획이 반 픽셀 밖으로 삐져 카드와 띠가 만나는 곳에 단차가 보였다, 2026-11-16 소유자).
function borderWidthOf(el: HTMLElement): number {
  const w = parseFloat(getComputedStyle(el).borderTopWidth);
  return Number.isFinite(w) && w > 0 ? w : 1;
}
// 한 도형 몸통의 채움 — 배경을 비운 카드(.chain-step-solid)에 지정된 태그 색(인라인). 없으면 계산값.
function solidFillOf(from: HTMLElement, to: HTMLElement): string {
  for (const el of [from, to]) {
    if (el.classList.contains("chain-step-solid") && el.style.backgroundColor) return el.style.backgroundColor;
  }
  return fillOf(from, to);
}
function fillOf(from: HTMLElement, to: HTMLElement): string {
  for (const el of [from, to]) {
    const bg = getComputedStyle(el).backgroundColor;
    if (opaque(bg)) return bg;
  }
  return from.style.backgroundColor || strokeOf(from);
}

type Pt = { x: number; y: number; r: number };
// 직교 다각형의 꼭짓점을 둥글린 경로. r은 상한 — 변 길이의 절반을 넘지 않는다.
function roundedPath(pts: Pt[]): string {
  const n = pts.length;
  const f = (v: number) => v.toFixed(2);
  let d = "";
  for (let i = 0; i < n; i += 1) {
    const p0 = pts[(i - 1 + n) % n];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % n];
    const l1 = Math.hypot(p1.x - p0.x, p1.y - p0.y) || 1;
    const l2 = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
    const r = Math.min(p1.r, l1 / 2, l2 / 2);
    const ax = p1.x + ((p0.x - p1.x) / l1) * r;
    const ay = p1.y + ((p0.y - p1.y) / l1) * r;
    const bx = p1.x + ((p2.x - p1.x) / l2) * r;
    const by = p1.y + ((p2.y - p1.y) / l2) * r;
    d += `${i === 0 ? "M" : "L"}${f(ax)},${f(ay)} Q${f(p1.x)},${f(p1.y)} ${f(bx)},${f(by)} `;
  }
  return `${d}Z`;
}

type Box = { left: number; right: number; top: number; bottom: number };
type Span = { top: number; bottom: number };

// 왼쪽 몸(x0~xa, 세로 S) + 기둥(xa~xb, 세로 전체) + 오른쪽 몸(xb~x1, 세로 T)의 합집합 윤곽.
// hidden(x) = 그 꼭짓점이 카드 밑에 숨으면 둥글리지 않는다.
function stepOutline(
  x0: number, xa: number, xb: number, x1: number, S: Span, T: Span,
  convex: number, concave: number, hidden: (x: number) => boolean
): string {
  const top = Math.min(S.top, T.top);
  const bottom = Math.max(S.bottom, T.bottom);
  const raw = [
    { x: x0, y: S.top }, { x: xa, y: S.top }, { x: xa, y: top }, { x: xb, y: top },
    { x: xb, y: T.top }, { x: x1, y: T.top }, { x: x1, y: T.bottom }, { x: xb, y: T.bottom },
    { x: xb, y: bottom }, { x: xa, y: bottom }, { x: xa, y: S.bottom }, { x: x0, y: S.bottom }
  ];
  const same = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
  const pts: { x: number; y: number }[] = [];
  for (const p of raw) if (!pts.length || !same(pts[pts.length - 1], p)) pts.push(p);
  if (pts.length > 1 && same(pts[0], pts[pts.length - 1])) pts.pop();
  const crossAt = (i: number) => {
    const p0 = pts[(i - 1 + pts.length) % pts.length];
    const p1 = pts[i];
    const p2 = pts[(i + 1) % pts.length];
    return (p1.x - p0.x) * (p2.y - p1.y) - (p1.y - p0.y) * (p2.x - p1.x);
  };
  for (let i = 0; i < pts.length && pts.length > 3; ) {
    if (Math.abs(crossAt(i)) < 0.01) pts.splice(i, 1);
    else i += 1;
  }
  let area = 0;
  for (let i = 0; i < pts.length; i += 1) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    area += p.x * q.y - q.x * p.y;
  }
  const rounded: Pt[] = pts.map((p, i) => {
    if (hidden(p.x)) return { ...p, r: 0 };
    return { ...p, r: Math.sign(crossAt(i)) === Math.sign(area) ? convex : concave };
  });
  return roundedPath(rounded);
}

// 앞 카드 S(왼쪽 칸)·다음 카드 T(오른쪽 칸)의 칸 기준 사각형 → 꺾인 띠 경로. sw = 테두리 두께(경로를 sw/2 들인다).
export function stepBandPath(
  S: Box,
  T: Box,
  convex = STEP_CONVEX,
  sw = 1
): { d: string; width: number; originX: number; originY: number; xa: number; xb: number } {
  const gap = T.left - S.right;
  const w = Math.min(STEP_MAX, Math.max(STEP_MIN, gap - STEP_CLEAR * 2));
  const mid = (S.right + T.left) / 2;
  const xa = mid - w / 2;
  const xb = mid + w / 2;
  const x0 = Math.min(S.right - 3, xa);
  const x1 = Math.max(T.left + 3, xb);
  const h = sw / 2;
  const Sy = { top: S.top + h, bottom: S.bottom - h };
  const Ty = { top: T.top + h, bottom: T.bottom - h };
  const d = stepOutline(x0, xa + h, xb - h, x1, Sy, Ty, Math.max(2, convex - h), STEP_CONCAVE, (x) =>
    Math.abs(x - x0) < 0.01 || Math.abs(x - x1) < 0.01
  );
  return { d, width: w, originX: xa, originY: S.top < T.top ? S.top : S.bottom, xa, xb };
}

// 고른 묶음을 한 덩어리로 감싸는 테두리 — 앞 카드 + 띠 + 다음 카드 바깥을 e만큼 띄워 한 줄로 두른다.
// 카드마다 따로 두르던 점선/실선 링(띠 위에서 끊기고 겹치던 것)을 대신한다.
export function stepRingPath(S: Box, T: Box, xa: number, xb: number, e: number, convex = STEP_CONVEX): string {
  return stepOutline(
    S.left - e, xa - e, xb + e, T.right + e,
    { top: S.top - e, bottom: S.bottom + e },
    { top: T.top - e, bottom: T.bottom + e },
    convex + e, Math.max(2, STEP_CONCAVE - e), () => false
  );
}

// 마운트 직후(첫 그림)엔 등장 연출을 하지 않는다 — 방금 잇거나 순서를 바꿔 '새로 생긴' 띠만 통통 자란다.
const mountedAt = new WeakMap<HTMLElement, number>();
const hotKey = new WeakMap<HTMLElement, string | null>();

const SVG_NS = "http://www.w3.org/2000/svg";

// 띠는 지우고 다시 만들지 않고 제자리에서 고쳐 쓴다 — 레이아웃이 움직이는 동안(드래그 착지·패널 열림) 매 프레임
// 다시 그려도 등장 애니메이션이 끊기거나 처음부터 다시 시작하지 않는다.
function drawSteps(root: HTMLElement) {
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  const settled = now - (mountedAt.get(root) ?? now) > 1200;
  const hot = hotKey.get(root) ?? null;
  for (const svg of Array.from(root.querySelectorAll<SVGSVGElement>("svg[data-curve-svg]"))) {
    const keys = (svg.dataset.curveSvg ?? "").split(" ").filter(Boolean);
    const host = svg.parentElement;
    const existing = new Map<string, SVGGElement>();
    for (const g of Array.from(svg.querySelectorAll<SVGGElement>(":scope > g[data-step]"))) {
      existing.set(g.dataset.step ?? "", g);
    }
    const keep = new Set<string>();
    const rings = new Map<string, string>();
    const ringKinds = new Map<string, string>();
    // 누른 조각 쪽(앞/다음)과 띠 가운데 x — 누른 날짜 쪽 테두리는 진하게, 이어진 다른 쪽은 옅게 가른다.
    const ringSides = new Map<string, { picked: "from" | "to"; mid: number }>();
    if (host) {
      const hostRect = host.getBoundingClientRect();
      const s = scaleOf(host);
      const local = (r: DOMRect): Box => ({
        left: (r.left - hostRect.left) / s,
        right: (r.right - hostRect.left) / s,
        top: (r.top - hostRect.top) / s,
        bottom: (r.bottom - hostRect.top) / s
      });
      for (const key of keys) {
        const from = root.querySelector<HTMLElement>(`[data-curve-from="${CSS.escape(key)}"]`);
        const to = root.querySelector<HTMLElement>(`[data-curve-to="${CSS.escape(key)}"]`);
        if (!from || !to) continue;
        keep.add(key);
        const SB = local(from.getBoundingClientRect());
        const TB = local(to.getBoundingClientRect());
        const convex = convexOf(from);
        const sw = borderWidthOf(from);
        const { originX, originY, xa, xb } = stepBandPath(SB, TB, convex, sw);
        // (2026-11-16 소유자 "중간에 단차") 몸통 = 앞 카드(띠로 붙은 조각 포함) + 기둥 + 다음 카드 전체를 한 도형으로.
        // 두 카드는 배경·테두리를 비우고(.chain-step-solid) 이 도형이 칠·테두리를 한 번에 맡는다 — 카드와 띠가 따로
        // 칠해지며 생기던 색 경계·테두리 어긋남이 구조적으로 없다. 테두리 두께 = 카드 테두리 두께, 절반 안쪽에 선다.
        const SU = unionBox(groupOf(root, from), local);
        const TU = unionBox(groupOf(root, to), local);
        const d = stepRingPath(SU, TU, xa, xb, -sw / 2, convex);
        const overlays = flatOverlaysOf(
          root.querySelector<HTMLElement>(".studio-event-pill:not(.chain-step-solid)") ?? from
        );
        // 한 덩어리 테두리 — 편집실에서 편집 중으로 고른 조각(점선) 또는 시청자 화면에서 상세를 연 조각(실선).
        const ringKind = from.matches(".primary-selected") || to.matches(".primary-selected")
          ? "dash"
          : from.matches(".detail-current") || to.matches(".detail-current")
            ? "solid"
            : null;
        if (ringKind) {
          rings.set(key, stepRingPath(SU, TU, xa, xb, ringKind === "dash" ? 1.75 : 3, convex));
          ringKinds.set(key, ringKind);
          const mark = ringKind === "dash" ? ".primary-selected" : ".detail-current";
          ringSides.set(key, { picked: from.matches(mark) ? "from" : "to", mid: (xa + xb) / 2 });
        }
        // 고른 묶음(편집실 .selected/.primary-selected)이면 띠도 선택색 테두리로 — 무엇이 묶였는지 보이게.
        const picked =
          from.matches(".selected, .primary-selected") || to.matches(".selected, .primary-selected");
        const stroke = strokeOf(from);
        let g = existing.get(key);
        const fresh = !g;
        if (!g) {
          g = document.createElementNS(SVG_NS, "g") as SVGGElement;
          g.setAttribute("data-step", key);
          const body = document.createElementNS(SVG_NS, "path");
          body.setAttribute("class", "chain-step-body");
          g.append(body);
          svg.append(g);
        }
        g.classList.add("chain-step");
        g.classList.toggle("is-selected", picked);
        g.classList.toggle("is-hot", hot === key);
        g.style.setProperty("--chain-color", stroke);
        g.style.transformOrigin = `${originX.toFixed(1)}px ${originY.toFixed(1)}px`;
        const body = g.querySelector<SVGPathElement>(".chain-step-body")!;
        // 덧칠 겹(편집실) — 몸통 바로 위, 빛줄기 아래. 개수가 바뀌면 다시 깐다.
        const layers = Array.from(g.querySelectorAll<SVGPathElement>(".chain-step-tint"));
        if (layers.length !== overlays.length) {
          layers.forEach((l) => l.remove());
          for (let i = 0; i < overlays.length; i += 1) {
            const l = document.createElementNS(SVG_NS, "path");
            l.setAttribute("class", "chain-step-tint");
            g.append(l);
          }
        }
        Array.from(g.querySelectorAll<SVGPathElement>(".chain-step-tint")).forEach((l, i) => {
          if (l.getAttribute("d") !== d) l.setAttribute("d", d);
          l.style.fill = overlays[i];
        });
        if (body.getAttribute("d") !== d) body.setAttribute("d", d);
        body.style.fill = solidFillOf(from, to);
        body.style.stroke = stroke;
        body.style.strokeWidth = `${sw}px`;
        // 카드가 흐려지는 상태(끌기 원래 자리·필터 흐림)는 몸통도 같이 흐린다.
        g.style.opacity = getComputedStyle(from).opacity;
        // 몸통을 그렸다는 표시 — 이 뒤에야 CSS가 두 카드의 칠을 비우고 맞닿는 변을 연다(새로고침 직후 깜빡임 방지).
        // 클래스가 아니라 data 속성이라 React가 다시 그려도 지워지지 않는다.
        if (!from.hasAttribute("data-step-painted")) from.setAttribute("data-step-painted", "");
        if (!to.hasAttribute("data-step-painted")) to.setAttribute("data-step-painted", "");
        // 새로 이어진 순간 — 한 덩어리가 톡 빛났다 가라앉고, 빛 한 줄기가 외곽을 한 바퀴 돈다(한 번만, 첫 그림은 조용히).
        if (fresh && settled) {
          g.classList.add("is-new");
          g.addEventListener("animationend", () => g?.classList.remove("is-new"), { once: true });
          startSheen(root, { key: `s:${key}`, from: groupOf(root, from), to: groupOf(root, to) });
        }
      }
    }
    for (const [key, g] of existing) if (!keep.has(key)) g.remove();
    // 앞쪽 층(카드 위)의 한 덩어리 테두리
    const front = host?.querySelector<SVGSVGElement>(":scope > svg[data-curve-ring]");
    if (front) {
      const old = new Map<string, SVGGElement>();
      for (const el of Array.from(front.querySelectorAll<SVGGElement>(":scope > g[data-ring]"))) {
        old.set(el.dataset.ring ?? "", el);
      }
      for (const [key, d] of rings) {
        const side = ringSides.get(key)!;
        let el = old.get(key);
        if (!el) {
          // 같은 경로 두 벌을 띠 가운데에서 잘라 그린다 — 누른 쪽(진하게)·이어진 쪽(옅게). 같은 경로라 점선 무늬가 이어진다.
          el = document.createElementNS(SVG_NS, "g") as SVGGElement;
          el.setAttribute("data-ring", key);
          const id = `cr${Math.random().toString(36).slice(2, 9)}`;
          el.innerHTML =
            `<defs><clipPath id="${id}a"><rect class="clip-l" x="-9999" y="-9999" height="29999"/></clipPath>` +
            `<clipPath id="${id}b"><rect class="clip-r" y="-9999" width="19999" height="29999"/></clipPath></defs>` +
            `<path class="ring-l" clip-path="url(#${id}a)"/><path class="ring-r" clip-path="url(#${id}b)"/>`;
          front.append(el);
        }
        const kind = ringKinds.get(key);
        el.setAttribute("class", `chain-ring-pair is-${kind}`);
        el.querySelector(".clip-l")?.setAttribute("width", String(side.mid + 9999));
        el.querySelector(".clip-r")?.setAttribute("x", String(side.mid));
        const left = el.querySelector<SVGPathElement>(".ring-l")!;
        const right = el.querySelector<SVGPathElement>(".ring-r")!;
        for (const [path, isPicked] of [[left, side.picked === "from"], [right, side.picked === "to"]] as const) {
          path.setAttribute("class", `chain-ring is-${kind}${isPicked ? "" : " is-linked"}`);
          if (path.getAttribute("d") !== d) path.setAttribute("d", d);
        }
      }
      for (const [key, el] of old) if (!rings.has(key)) el.remove();
    }
  }
}

// ── 테두리 한 바퀴 빛(2026-11-16 소유자) ──
// 일정에 손을 올리면 빛 한 줄기가 그 일정의 바깥 테두리를 한 바퀴 돈다. 이어진 일정은 앞 카드·꺾인 띠·다음 카드
// (띠로 붙은 조각까지)를 합친 한 덩어리 외곽을 돈다 — 카드마다 따로 돌면 이어진 게 끊겨 보인다. 일반 일정은 카드 테두리.
// 빛 층은 그 일정이 시작하는 칸 안의 임시 svg(카드 위 z 12). 도는 동안 매 프레임 위치를 다시 재서 카드가 살짝 떠도 따라간다.
const SHEEN_MS = 1150;
type SheenRun = { key: string; raf: number; layer: SVGSVGElement; until: number };
const sheenRun = new WeakMap<HTMLElement, SheenRun>();

type SheenTarget = { key: string; from?: HTMLElement[]; to?: HTMLElement[]; group?: HTMLElement[] };

function cardAt(root: HTMLElement, t: EventTarget | null): HTMLElement | null {
  const el = t instanceof Element ? t : null;
  if (!el) return null;
  const slot = el.closest<HTMLElement>(".band-slot.is-hit");
  if (slot && root.contains(slot)) {
    return root.querySelector<HTMLElement>(`[data-band-head="${CSS.escape(slot.dataset.bandSlot ?? "")}"]`);
  }
  const card = el.closest<HTMLElement>(".public-event, .studio-event-pill");
  return card && root.contains(card) ? card : null;
}
function groupOf(root: HTMLElement, card: HTMLElement): HTMLElement[] {
  const key = card.dataset.chain;
  if (!key) return [card];
  const all = Array.from(root.querySelectorAll<HTMLElement>(`[data-chain="${CSS.escape(key)}"]`)).filter(
    (n) => !n.classList.contains("band-slot")
  );
  return all.length ? all : [card];
}
function sheenTargetOf(root: HTMLElement, t: EventTarget | null): SheenTarget | null {
  const g = t instanceof Element ? t.closest<SVGGElement>("g[data-step]") : null;
  const stepKey =
    g?.dataset.step ??
    (() => {
      const c = cardAt(root, t);
      return c?.dataset.curveFrom ?? c?.dataset.curveTo ?? null;
    })();
  if (stepKey) {
    const from = root.querySelector<HTMLElement>(`[data-curve-from="${CSS.escape(stepKey)}"]`);
    const to = root.querySelector<HTMLElement>(`[data-curve-to="${CSS.escape(stepKey)}"]`);
    if (from && to) return { key: `s:${stepKey}`, from: groupOf(root, from), to: groupOf(root, to) };
  }
  const card = cardAt(root, t);
  if (!card) return null;
  const group = groupOf(root, card);
  const id = card.dataset.chain ?? card.dataset.eventid ?? card.dataset.bandHead;
  return { key: `c:${id ?? ""}:${group.length}`, group };
}

function unionBox(els: HTMLElement[], local: (r: DOMRect) => Box): Box {
  const bs = els.map((e) => local(e.getBoundingClientRect()));
  return {
    left: Math.min(...bs.map((b) => b.left)),
    right: Math.max(...bs.map((b) => b.right)),
    top: Math.min(...bs.map((b) => b.top)),
    bottom: Math.max(...bs.map((b) => b.bottom))
  };
}
function sheenPath(target: SheenTarget, host: HTMLElement): string | null {
  const hostRect = host.getBoundingClientRect();
  const s = scaleOf(host);
  const local = (r: DOMRect): Box => ({
    left: (r.left - hostRect.left) / s,
    right: (r.right - hostRect.left) / s,
    top: (r.top - hostRect.top) / s,
    bottom: (r.bottom - hostRect.top) / s
  });
  const lead = (target.from ?? target.group)?.[0];
  if (!lead) return null;
  const sw = borderWidthOf(lead);
  const h = sw / 2;
  const radius = parseFloat(getComputedStyle(lead).borderTopLeftRadius) || 8;
  if (target.from && target.to) {
    const S = unionBox(target.from, local);
    const T = unionBox(target.to, local);
    const convex = convexOf(lead);
    const { xa, xb } = stepBandPath(S, T, convex, sw);
    return stepRingPath(S, T, xa, xb, -h, convex);
  }
  const B = unionBox(target.group!, local);
  const r = Math.max(2, radius - h);
  return roundedPath([
    { x: B.left + h, y: B.top + h, r },
    { x: B.right - h, y: B.top + h, r },
    { x: B.right - h, y: B.bottom - h, r },
    { x: B.left + h, y: B.bottom - h, r }
  ]);
}
function reduceMotion(): boolean {
  if (typeof document !== "undefined" && document.documentElement.hasAttribute("data-reduce-motion")) return true;
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
function startSheen(root: HTMLElement, target: SheenTarget | null) {
  const cur = sheenRun.get(root);
  if (!target) return; // 손을 떼도 돌던 빛은 한 바퀴를 마저 돈다
  if (cur && cur.key === target.key && performance.now() < cur.until) return;
  if (cur) {
    cancelAnimationFrame(cur.raf);
    cur.layer.remove();
    sheenRun.delete(root);
  }
  if (reduceMotion()) return;
  const lead = (target.from ?? target.group)?.[0];
  const host = lead?.closest<HTMLElement>("article") ?? lead?.parentElement;
  if (!host) return;
  const layer = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  layer.setAttribute("class", "card-sheen-layer");
  layer.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("class", "card-sheen");
  path.setAttribute("pathLength", "100");
  layer.append(path);
  host.append(layer);
  const run: SheenRun = { key: target.key, raf: 0, layer, until: performance.now() + SHEEN_MS };
  const step = () => {
    const d = sheenPath(target, host);
    if (d && path.getAttribute("d") !== d) path.setAttribute("d", d);
    if (performance.now() < run.until && layer.isConnected) {
      run.raf = requestAnimationFrame(step);
    } else {
      layer.remove();
      if (sheenRun.get(root) === run) sheenRun.delete(root);
    }
  };
  step();
  sheenRun.set(root, run);
}

// 띠와 두 카드를 한 몸으로 반응시킨다 — 어느 하나에 손을 올리면 셋이 같이 밝아지고 빛이 띠를 따라 한 번 흐른다.
function stepKeyOf(t: EventTarget | null): string | null {
  const el = t instanceof Element ? t : null;
  if (!el) return null;
  const card = el.closest<HTMLElement>("[data-curve-from], [data-curve-to]");
  if (card) return card.dataset.curveFrom ?? card.dataset.curveTo ?? null;
  return el.closest<SVGGElement>("g[data-step]")?.dataset.step ?? null;
}
function applyHot(root: HTMLElement, key: string | null) {
  const prev = hotKey.get(root) ?? null;
  if (prev === key) return;
  hotKey.set(root, key);
  const toggle = (k: string | null, on: boolean) => {
    if (!k) return;
    const e = CSS.escape(k);
    root
      .querySelectorAll(`[data-curve-from="${e}"], [data-curve-to="${e}"]`)
      .forEach((n) => n.toggleAttribute("data-chain-hot", on));
    root.querySelectorAll(`g[data-step="${e}"]`).forEach((n) => n.classList.toggle("is-hot", on));
  };
  toggle(prev, false);
  toggle(key, true);
}

// 이어진 일정(같은 data-chain) 칸들의 높이를 그 묶음에서 가장 큰 칸에 맞춘다.
// 글자 수가 달라 높이가 다른 카드가 이어질 때 이음새가 어긋나 보이는 걸 막는다.
// (2026-11-16) 같은 일을 하는 김에 같은 글 띠의 머리 폭(data-band-head)과 곡선 이음(data-curve-*)도
// 여기서 같이 맞춘다 — 셋 다 '레이아웃이 바뀔 때마다 다시 재야 하는' 같은 종류의 일이라 한 펌프를 쓴다.
//
// ── 왜 callback ref인가(구조적 보장) ──
// 예전엔 RefObject + useLayoutEffect(deps)였다. 그런데 편집실 그리드는 시청자 미리보기·잠금
// 로딩·월 이동(key) 등으로 '통째로 언마운트→리마운트'된다. 그때 ref.current는 새 DOM이 되는데,
// deps에 그 트리거가 안 들어가 있으면 effect가 다시 안 돌아 '갔다 오면 높이가 틀어진' 채 굳었다.
// → 트리거를 일일이 deps에 넣는 방식은 새 화면 전환이 생길 때마다 또 깨질 수 있다(확률 0 불가).
//
// callback ref는 React가 '요소가 실제로 (언)마운트될 때마다' 반드시 호출한다. 즉 어떤 경로로
// 그리드가 다시 뜨든(미리보기 복귀·잠금 해제·월 변경·그 무엇이든) 항상 새 요소로 재설정된다.
// "어떤 상태를 deps에 빠뜨렸나"라는 문제 자체가 사라진다 → 리마운트로 인한 미정렬 확률 0.
// 그리드가 안 바뀐 채 '내용만' 바뀌는 경우(제목 수정·카드 추가/삭제)는 내부 MutationObserver가,
// 폭/스케일 변화는 ResizeObserver가 잡는다. deps는 데이터 변화 시 한 번 더 맞추는 보강일 뿐이다.
export function useEqualChainHeights<T extends HTMLElement>(
  deps: unknown[] = []
): (el: T | null) => void {
  const cleanupRef = useRef<(() => void) | null>(null);
  const scheduleRef = useRef<(() => void) | null>(null);

  const setRef = useCallback((root: T | null) => {
    // 이전 요소가 있었다면 관찰자·리스너를 모두 정리한다.
    if (cleanupRef.current) {
      cleanupRef.current();
      cleanupRef.current = null;
      scheduleRef.current = null;
    }
    if (!root) {
      return;
    }

    let cancelled = false;
    let mo: MutationObserver | null = null;

    function observe() {
      mo?.observe(root!, {
        subtree: true,
        childList: true, // 카드 생성/삭제
        characterData: true, // 제목·항목 글자 변경
        attributes: true,
        // style(=우리 minHeight·폭)은 제외(self-trigger 방지)
        attributeFilter: ["class", "data-chain", "data-band-head", "data-curve-from", "data-curve-to", "data-chain-hot"]
      });
    }

    function equalize() {
      if (cancelled) {
        return;
      }
      mo?.disconnect(); // 측정·쓰기 동안 관찰 정지 → 우리 minHeight 변경이 자신을 트리거 못함
      // ① 같은 글 띠의 머리 카드 폭 = 머리 칸 왼쪽 ~ 마지막 빈 자리(bandSlot) 오른쪽.
      //    표면이 transform/zoom으로 줄어 있어도 맞도록 화면 px를 레이아웃 px로 되돌린다(scaleOf).
      for (const head of Array.from(root!.querySelectorAll<HTMLElement>("[data-band-head]"))) {
        const slots = root!.querySelectorAll<HTMLElement>(
          `[data-band-slot="${CSS.escape(head.dataset.bandHead ?? "")}"]`
        );
        const tail = slots[slots.length - 1];
        if (!tail) {
          head.style.width = "";
          continue;
        }
        const s = scaleOf(head);
        const w = (tail.getBoundingClientRect().right - head.getBoundingClientRect().left) / s;
        if (w > 0) head.style.width = `${Math.round(w * 10) / 10}px`;
      }
      const pills = Array.from(root!.querySelectorAll<HTMLElement>("[data-chain]"));
      for (const p of pills) {
        p.style.minHeight = ""; // 먼저 초기화해 자연 높이를 잰다
      }
      const groups = new Map<string, HTMLElement[]>();
      for (const p of pills) {
        const key = p.dataset.chain;
        if (!key) {
          continue;
        }
        const g = groups.get(key);
        if (g) {
          g.push(p);
        } else {
          groups.set(key, [p]);
        }
      }
      for (const group of groups.values()) {
        if (group.length < 2) {
          continue; // 혼자면 맞출 필요 없음
        }
        let max = 0;
        for (const el of group) {
          max = Math.max(max, el.offsetHeight);
        }
        for (const el of group) {
          el.style.minHeight = `${max}px`;
        }
      }
      drawSteps(root!);
      observe(); // 반영 끝난 뒤 다시 관찰
    }

    // ── 왜 '매 프레임 펌프'인가(편집 패널 열 때 높이 튐 수정) ──
    // 예전엔 더블-rAF 디바운스였다. 그런데 편집 패널이 열/닫힐 때 그리드 폭이 0.52s 동안 계속
    // 바뀌고 ResizeObserver가 '매 프레임' 발화한다 → 디바운스가 대기 rAF를 매번 취소해 equalize가
    // transitionend에 딱 한 번만 돌았다. 그 사이 긴 글자 카드는 낡은 minHeight를 넘겨 '혼자 먼저'
    // 커지고, 나머지는 끝나서야 따라 점프 → '15일만 튀고 6~14가 뒤늦게 따라오는' 글리치.
    // → 트리거가 오면 '다음 프레임부터 매 프레임' equalize를 돌리고, 마지막 트리거 후 잠깐(꼬리)
    //   더 돌린다. 그러면 이어진 칸들이 폭 변화 내내 같이 높이를 맞춰 한 번에 부드럽게 움직인다.
    let pumpRaf = 0;
    let pumpUntil = 0;
    let pumping = false;
    function pump() {
      pumping = true;
      const step = () => {
        if (cancelled) {
          pumping = false;
          return;
        }
        equalize();
        if (typeof performance !== "undefined" && performance.now() < pumpUntil) {
          pumpRaf = requestAnimationFrame(step);
        } else {
          pumping = false;
        }
      };
      pumpRaf = requestAnimationFrame(step);
    }
    function schedule() {
      // 마지막 트리거 뒤로도 ~250ms(패널 transition 0.52s를 매 프레임 덮고 꼬리 여유) 더 펌프.
      pumpUntil = (typeof performance !== "undefined" ? performance.now() : 0) + 250;
      if (!pumping) {
        pump();
      }
    }
    scheduleRef.current = schedule;

    mountedAt.set(root, typeof performance !== "undefined" ? performance.now() : 0);
    // 같은 일정 안에서 손이 움직일 때마다 다시 돌지 않게 — 다른 일정(또는 빈 곳)으로 옮겼을 때만 새로 돈다.
    let sheenKey: string | null = null;
    const onOver = (e: PointerEvent) => {
      applyHot(root, stepKeyOf(e.target));
      if (e.pointerType && e.pointerType !== "mouse") return;
      const target = sheenTargetOf(root, e.target);
      const k = target?.key ?? null;
      if (k !== sheenKey) {
        sheenKey = k;
        startSheen(root, target);
      }
    };
    const onLeave = () => {
      applyHot(root, null);
      sheenKey = null;
    };
    root.addEventListener("pointerover", onOver);
    root.addEventListener("pointerleave", onLeave);
    // 마운트 즉시 1차(페인트 전 가깝게) + 레이아웃 안정 후 한 번 더.
    equalize();
    schedule();
    // 웹폰트 로딩 전 폴백 글꼴로 재면 높이가 어긋난다. 준비되면 다시 맞춘다.
    if (typeof document !== "undefined" && document.fonts) {
      document.fonts.ready.then(() => schedule()).catch(() => {});
    }
    const ro =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => schedule()) : null;
    ro?.observe(root);
    mo = typeof MutationObserver !== "undefined" ? new MutationObserver(() => schedule()) : null;
    observe();
    const onSettle = () => schedule();
    root.addEventListener("animationend", onSettle);
    root.addEventListener("transitionend", onSettle);
    window.addEventListener("resize", schedule);

    cleanupRef.current = () => {
      cancelled = true;
      cancelAnimationFrame(pumpRaf);
      ro?.disconnect();
      mo?.disconnect();
      root.removeEventListener("pointerover", onOver);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("animationend", onSettle);
      root.removeEventListener("transitionend", onSettle);
      window.removeEventListener("resize", schedule);
    };
  }, []);

  // 데이터(이벤트/뷰 등)가 바뀌면 한 번 더 맞춘다 — MutationObserver 보강. 그리드가 안 바뀐 채
  // 내용만 갱신되는 경우의 안전망(콜백 ref는 요소가 안 바뀌면 호출되지 않으므로).
  useEffect(() => {
    scheduleRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // 컴포넌트 언마운트 시 정리.
  useEffect(() => {
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, []);

  return setRef;
}
