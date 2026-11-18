"use client";

import { useCallback, useEffect, useRef } from "react";

// 화면 px ÷ 레이아웃 px — 포스터 표면은 transform으로, 편집실은 CSS zoom으로 줄어 있다.
function scaleOf(el: HTMLElement): number {
  const w = el.offsetWidth;
  const r = el.getBoundingClientRect().width;
  return w > 0 && r > 0 ? r / w : 1;
}

// 꺾인 띠 이음(buildChainJoins의 step 판정 — 2026-11-16 소유자 C안) — 앞날 카드(data-step-from)의 오른쪽 변과
// 다음날 카드(data-step-to)의 왼쪽 변을, 칸 사이 틈에서 위/아래로 꺾여 오르내리는 '카드와 같은 몸통'으로 잇는다.
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
type WrapTips = { left?: number; right?: number };
const WRAP_TIP = 7; // public-poster.css --wrap-tip와 같은 값
type Span = { top: number; bottom: number };

// 이어진 한 줄 블록의 바깥 윤곽 — 몸(카드·띠 묶음)들이 왼→오른쪽으로 서 있고, 이웃한 몸 사이는 기둥(꺾인 띠, xa~xb)이
// 잇는다. 몸이 하나면 둥근 사각형, 둘이면 꺾인 띠 한 쌍, 그 이상도 같은 규칙. 꺾인 띠 몸통·클릭 테두리·손 올림 빛이
// 전부 이 한 함수를 쓴다(2026-11-18 소유자: "모양을 바꿨으면 테두리·빛도 그 모양대로, 규칙은 하나로").
// hidden(x) = 그 꼭짓점이 카드 밑에 숨으면 둥글리지 않는다. tips = 줄바뀜 화살 모서리(◀/▶) 깊이.
type Stem = { xa: number; xb: number };
function chainOutline(
  bodies: Box[], stems: Stem[], convex: number, concave: number,
  hidden: (x: number) => boolean, tips: WrapTips = {}
): string {
  const first = bodies[0];
  const last = bodies[bodies.length - 1];
  const tl = tips.left ?? 0;
  const tr = tips.right ?? 0;
  const raw: { x: number; y: number; sharp?: boolean }[] = [];
  // 위쪽 변: 왼 → 오른쪽
  raw.push(tl ? { x: first.left + tl, y: first.top, sharp: true } : { x: first.left, y: first.top });
  stems.forEach((st, k) => {
    const A = bodies[k];
    const B = bodies[k + 1];
    const top = Math.min(A.top, B.top);
    raw.push({ x: st.xa, y: A.top }, { x: st.xa, y: top }, { x: st.xb, y: top }, { x: st.xb, y: B.top });
  });
  // 오른쪽 끝 — 화살 꼭짓점은 둥글리지 않는다.
  if (tr) {
    raw.push(
      { x: last.right - tr, y: last.top, sharp: true },
      { x: last.right, y: (last.top + last.bottom) / 2, sharp: true },
      { x: last.right - tr, y: last.bottom, sharp: true }
    );
  } else raw.push({ x: last.right, y: last.top }, { x: last.right, y: last.bottom });
  // 아래쪽 변: 오른 → 왼쪽
  for (let k = stems.length - 1; k >= 0; k -= 1) {
    const st = stems[k];
    const A = bodies[k];
    const B = bodies[k + 1];
    const bottom = Math.max(A.bottom, B.bottom);
    raw.push({ x: st.xb, y: B.bottom }, { x: st.xb, y: bottom }, { x: st.xa, y: bottom }, { x: st.xa, y: A.bottom });
  }
  if (tl) {
    raw.push(
      { x: first.left + tl, y: first.bottom, sharp: true },
      { x: first.left, y: (first.top + first.bottom) / 2, sharp: true }
    );
  } else raw.push({ x: first.left, y: first.bottom });
  const same = (a: { x: number; y: number }, b: { x: number; y: number }) =>
    Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
  const pts: { x: number; y: number; sharp?: boolean }[] = [];
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
    if (p.sharp || hidden(p.x)) return { ...p, r: 0 };
    return { ...p, r: Math.sign(crossAt(i)) === Math.sign(area) ? convex : concave };
  });
  return roundedPath(rounded);
}
// 꺾인 띠 한 쌍(앞 몸 x0~, 기둥 xa~xb, 뒤 몸 ~x1) — chainOutline의 몸 둘짜리.
function stepOutline(
  x0: number, xa: number, xb: number, x1: number, S: Span, T: Span,
  convex: number, concave: number, hidden: (x: number) => boolean, tips: WrapTips = {}
): string {
  return chainOutline(
    [{ left: x0, right: xa, ...S }, { left: xb, right: x1, ...T }],
    [{ xa, xb }], convex, concave, hidden, tips
  );
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
// stemE = 기둥(칸 사이 틈) 부분만 따로 띄우는 양 — 테두리가 틈 밖으로 나가면 옆 카드·'원래 위치' 상자 점선과 닿는다.
export function stepRingPath(
  S: Box, T: Box, xa: number, xb: number, e: number, convex = STEP_CONVEX, stemE = e, tips: WrapTips = {}
): string {
  return stepOutline(
    S.left - e, xa - stemE, xb + stemE, T.right + e,
    { top: S.top - e, bottom: S.bottom + e },
    { top: T.top - e, bottom: T.bottom + e },
    convex + e, Math.max(2, STEP_CONCAVE - e), () => false, tips
  );
}

// 마운트 직후(첫 그림)엔 등장 연출을 하지 않는다 — 방금 잇거나 순서를 바꿔 '새로 생긴' 띠만 통통 자란다.
const mountedAt = new WeakMap<HTMLElement, number>();
const hotKey = new WeakMap<HTMLElement, string | null>();

const SVG_NS = "http://www.w3.org/2000/svg";

// 띠는 지우고 다시 만들지 않고 제자리에서 고쳐 쓴다 — 레이아웃이 움직이는 동안(드래그 착지·패널 열림) 매 프레임
// 다시 그려도 등장 애니메이션이 끊기거나 처음부터 다시 시작하지 않는다.
// 자리·크기가 바뀌는 끝이 있는 움직임(전환·한 번짜리 애니메이션)이 지금 돌고 있는가.
// 그림자·밝기·색처럼 모양만 바뀌는 것은 세지 않는다 — 손을 올릴 때의 그림자 전환까지 '움직임'으로 세면 그 순간
// 이어진 카드가 제 바탕·둥근 모서리로 돌아와 띠 양옆에 둥근 밝은 자국이 생겼다(2026-11-17 소유자). 무한 반복도 안 센다.
const GEOMETRY_PROPS = /^(transform|translate|scale|rotate|margin|padding|top|left|right|bottom|width|height|min-height|max-height|inset)/;
function movesGeometry(a: Animation): boolean {
  const t = (a as Animation & { transitionProperty?: string }).transitionProperty;
  if (typeof t === "string") return GEOMETRY_PROPS.test(t);
  const effect = a.effect as KeyframeEffect | null;
  if (!effect || typeof effect.getKeyframes !== "function") return false;
  return effect
    .getKeyframes()
    .some((k) => Object.keys(k).some((prop) => GEOMETRY_PROPS.test(prop.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`))));
}
function isSliding(el: Element): boolean {
  if (typeof (el as HTMLElement).getAnimations !== "function") return false;
  return (el as HTMLElement).getAnimations().some((a) => {
    if (a.playState !== "running") return false;
    const end = a.effect?.getComputedTiming().endTime;
    return typeof end === "number" && Number.isFinite(end) && movesGeometry(a);
  });
}

// 미끄러지는 카드는 이어진 띠(머리 z 3·몸통 z 1) 위로 — 놓은 직후 카드들이 새 자리로 내려가는 동안 이미 최종 모양인
// 띠와 겹쳐 뒤섞여 보였다(2026-11-17 소유자 "난잡하게 겹침"). 움직임이 끝나면 원래 층으로.
function liftSliding(root: HTMLElement) {
  for (const el of Array.from(root.querySelectorAll<HTMLElement>(".studio-event-pill, .public-event"))) {
    const sliding = isSliding(el) && !el.hasAttribute("data-band-head");
    if (sliding && el.dataset.lifted === undefined) {
      el.dataset.lifted = "";
      el.style.zIndex = "4";
    } else if (!sliding && el.dataset.lifted !== undefined) {
      delete el.dataset.lifted;
      el.style.zIndex = "";
    }
  }
}

function drawSteps(root: HTMLElement) {
  const now = typeof performance !== "undefined" ? performance.now() : 0;
  const settled = now - (mountedAt.get(root) ?? now) > 1200;
  const hot = hotKey.get(root) ?? null;
  // 이번에 실제로 몸통을 그린 카드 — 그 밖의 카드에 남은 '그렸다' 표시는 지운다. 예전에 꺾인 띠였던 카드에 표시가
  // 남으면, 다시 꺾인 띠가 되는 순간 몸통을 그리기도 전에 바탕부터 비워져 글자만 깜빡였다(2026-11-17 소유자).
  const paintedNow = new Set<HTMLElement>();
  for (const svg of Array.from(root.querySelectorAll<SVGSVGElement>("svg[data-step-svg]"))) {
    const keys = (svg.dataset.stepSvg ?? "").split(" ").filter(Boolean);
    const host = svg.parentElement;
    const existing = new Map<string, SVGGElement>();
    for (const g of Array.from(svg.querySelectorAll<SVGGElement>(":scope > g[data-step]"))) {
      existing.set(g.dataset.step ?? "", g);
    }
    const keep = new Set<string>();
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
        const from = root.querySelector<HTMLElement>(`[data-step-from="${CSS.escape(key)}"]`);
        const to = root.querySelector<HTMLElement>(`[data-step-to="${CSS.escape(key)}"]`);
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
        const SG = groupOf(root, from);
        const TG = groupOf(root, to);
        const SU = unionBox(SG, local);
        const TU = unionBox(TG, local);
        // 묶음 바깥 끝이 줄바뀜이면 그 끝을 화살 모서리로 — 카드 칠을 이 도형이 맡으므로 카드 clip-path만으론 안 보인다.
        const tips: WrapTips = {
          left: SG.some((el) => el.classList.contains("wrap-in")) ? WRAP_TIP : 0,
          right: TG.some((el) => el.classList.contains("wrap-out")) ? WRAP_TIP : 0
        };
        const d = stepRingPath(SU, TU, xa, xb, -sw / 2, convex, -sw / 2, tips);
        const overlays = flatOverlaysOf(
          root.querySelector<HTMLElement>(".studio-event-pill:not(.chain-step-solid)") ?? from
        );
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
        // 단, 칸이 아직 등장 애니메이션 중이면(새로고침 직후 차르륵) 칸마다 따로 쌓여 다음 칸 배경이 몸통을 덮는다 —
        // 그동안은 카드가 제 칠을 그대로 가지게 두고, 애니메이션이 끝나면(animationend → 다시 잼) 표시한다.
        // '칸이 따로 쌓이는가'만 본다(transform·filter가 걸린 칸) — 놓을 칸 강조처럼 색만 바뀌는 애니메이션까지 세면
        // 끄는 동안 이어진 모양이 풀려 카드 점선과 한 덩어리 점선이 이중으로 보였다(2026-11-17 소유자).
        // (끄는 동안·착지 중에도 비운 채 둔다 — '화면에 실제로 그려진 뒤' 기준으로 매 프레임 재 보니 몸통이 늦는 장면이
        //  0이었다. 카드 칠을 되살리면 오히려 둥근 모서리가 띠 옆에 비쳐 보였다, 2026-11-17 소유자.)
        const moving = [from, to].some((card) => {
          const cell = card.closest("article");
          if (!cell) return false;
          const cs = getComputedStyle(cell);
          return cs.transform !== "none" || cs.filter !== "none";
        });
        for (const card of [from, to]) {
          if (!moving) paintedNow.add(card);
          if (moving) card.removeAttribute("data-step-painted");
          else if (!card.hasAttribute("data-step-painted")) card.setAttribute("data-step-painted", "");
        }
        // 새로 이어진 순간 — 한 덩어리가 톡 빛났다 가라앉고, 빛 한 줄기가 외곽을 한 바퀴 돈다(한 번만, 첫 그림은 조용히).
        if (fresh && settled) {
          // 끄는 동안(미리보기)엔 번쩍임·빛 없이 바로 — 놓을 자리를 옮길 때마다 터지면 툭툭 끊겨 보였다. 서서히
          // 띄우는 것도 안 된다: 카드 칠은 이미 비어 있어 몸통이 흐린 동안 글자만 떠 보였다(매 프레임 실측 7프레임).
          const previewing = Boolean(root.querySelector(".drop-gap.on, .dragging-src"));
          if (!previewing) {
            g.classList.add("is-new");
            g.addEventListener("animationend", () => g?.classList.remove("is-new"), { once: true });
            startSheen(root, { key: `b:${key}`, card: from });
          }
        }
      }
    }
    for (const [key, g] of existing) if (!keep.has(key)) g.remove();
  }
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-step-painted]"))) {
    if (!paintedNow.has(el)) el.removeAttribute("data-step-painted");
  }
}

// ── 테두리 한 바퀴 빛(2026-11-16 소유자) ──
// 일정에 손을 올리면 빛 한 줄기가 그 일정의 바깥 테두리를 한 바퀴 돈다. 이어진 일정은 앞 카드·꺾인 띠·다음 카드
// (띠로 붙은 조각까지)를 합친 한 덩어리 외곽을 돈다 — 카드마다 따로 돌면 이어진 게 끊겨 보인다. 일반 일정은 카드 테두리.
// 빛 층은 그 일정이 시작하는 칸 안의 임시 svg(카드 위 z 12). 도는 동안 매 프레임 위치를 다시 재서 카드가 살짝 떠도 따라간다.
const SHEEN_MS = 1150;
type SheenRun = { key: string; raf: number; layer: SVGSVGElement; until: number };
const sheenRun = new WeakMap<HTMLElement, SheenRun>();

type SheenTarget = { key: string; card: HTMLElement };

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
function unionBox(els: HTMLElement[], local: (r: DOMRect) => Box): Box {
  const bs = els.map((e) => local(e.getBoundingClientRect()));
  return {
    left: Math.min(...bs.map((b) => b.left)),
    right: Math.max(...bs.map((b) => b.right)),
    top: Math.min(...bs.map((b) => b.top)),
    bottom: Math.max(...bs.map((b) => b.bottom))
  };
}

// ── 블록 = 한 줄 안에서 이어져 한 덩어리로 보이는 카드들(띠로 붙은 묶음 + 꺾인 띠로 이어진 묶음) ──
// 줄바뀜(토→일)은 블록을 끊는다 — 그 너머는 wraps(다른 줄의 이어진 카드)로만 알려 준다.
type Block = {
  key: string;
  bodies: HTMLElement[][]; // 띠 묶음들(왼→오른쪽)
  steps: { from: HTMLElement; to: HTMLElement }[];
  cards: HTMLElement[];
  wraps: HTMLElement[];
};
function blockOf(root: HTMLElement, card: HTMLElement): Block {
  const seen = new Set<HTMLElement>();
  const steps = new Map<string, { from: HTMLElement; to: HTMLElement }>();
  const wraps: HTMLElement[] = [];
  const queue = [card];
  const one = (attr: string, key: string) => root.querySelector<HTMLElement>(`[${attr}="${CSS.escape(key)}"]`);
  while (queue.length) {
    const c = queue.pop()!;
    if (seen.has(c)) continue;
    for (const m of groupOf(root, c)) {
      if (seen.has(m)) continue;
      seen.add(m);
      for (const key of [m.dataset.stepFrom, m.dataset.stepTo]) {
        if (!key || steps.has(key)) continue;
        const from = one("data-step-from", key);
        const to = one("data-step-to", key);
        if (!from || !to) continue;
        steps.set(key, { from, to });
        queue.push(from, to);
      }
      const next = m.dataset.wrapTo ? one("data-wrap-from", m.dataset.wrapTo) : null;
      const prev = m.dataset.wrapFrom ? one("data-wrap-to", m.dataset.wrapFrom) : null;
      if (next) wraps.push(next);
      if (prev) wraps.push(prev);
    }
  }
  const byBody = new Map<string, HTMLElement[]>();
  let n = 0;
  for (const m of seen) {
    const k = m.dataset.chain ?? `solo:${(n += 1)}`;
    byBody.set(k, [...(byBody.get(k) ?? []), m]);
  }
  const left = (els: HTMLElement[]) => Math.min(...els.map((e) => e.getBoundingClientRect().left));
  const bodies = [...byBody.values()].sort((a, b) => left(a) - left(b));
  const lead = bodies[0][0];
  const id = lead.dataset.eventid ?? lead.dataset.bandHead ?? lead.dataset.chain ?? lead.dataset.stepFrom ?? "";
  return { key: `${id}:${seen.size}:${steps.size}`, bodies, steps: [...steps.values()], cards: [...seen], wraps };
}
// 블록 외곽 경로. e = 카드 바깥으로 띄우는 양(음수면 안쪽), stemE = 기둥만 따로 띄우는 양.
function blockPath(block: Block, local: (r: DOMRect) => Box, e: number, stemE = e): string {
  const lead = block.bodies[0][0];
  const convex = Math.max(...block.cards.map(convexOf));
  const sw = borderWidthOf(lead);
  const boxes = block.bodies.map((b) => unionBox(b, local));
  const stems = block.steps
    .map(({ from, to }) => stepBandPath(local(from.getBoundingClientRect()), local(to.getBoundingClientRect()), convex, sw))
    .sort((a, b) => a.xa - b.xa);
  const grow = (b: Box): Box => ({ left: b.left - e, right: b.right + e, top: b.top - e, bottom: b.bottom + e });
  const tips: WrapTips = {
    left: block.bodies[0].some((el) => el.classList.contains("wrap-in")) ? WRAP_TIP : 0,
    right: block.bodies[block.bodies.length - 1].some((el) => el.classList.contains("wrap-out")) ? WRAP_TIP : 0
  };
  // 기둥 수가 몸 사이 수와 안 맞으면(그리는 도중의 어중간한 장면) 전체를 감싼 한 상자로.
  const ok = stems.length === boxes.length - 1;
  return chainOutline(
    ok ? boxes.map(grow) : [grow(unionBox(block.cards, local))],
    ok ? stems.map((st) => ({ xa: st.xa - stemE, xb: st.xb + stemE })) : [],
    Math.max(2, convex + e), Math.max(2, STEP_CONCAVE - e), () => false, tips
  );
}
// scaleEl = 화면 배율(표면 transform/zoom)을 잴 HTML 요소 — svg 층은 offsetWidth가 없어 직접 못 잰다.
function localOf(host: Element, scaleEl: HTMLElement = host as HTMLElement): (r: DOMRect) => Box {
  const hostRect = host.getBoundingClientRect();
  const s = scaleOf(scaleEl);
  return (r) => ({
    left: (r.left - hostRect.left) / s,
    right: (r.right - hostRect.left) / s,
    top: (r.top - hostRect.top) / s,
    bottom: (r.bottom - hostRect.top) / s
  });
}

function sheenTargetOf(root: HTMLElement, t: EventTarget | null): SheenTarget | null {
  const g = t instanceof Element ? t.closest<SVGGElement>("g[data-step]") : null;
  const card = g?.dataset.step
    ? root.querySelector<HTMLElement>(`[data-step-from="${CSS.escape(g.dataset.step)}"]`)
    : cardAt(root, t);
  if (!card) return null;
  return { key: `b:${blockOf(root, card).key}`, card };
}
function sheenPath(root: HTMLElement, target: SheenTarget, host: HTMLElement): string | null {
  if (!target.card.isConnected) return null;
  return blockPath(blockOf(root, target.card), localOf(host), -borderWidthOf(target.card) / 2);
}

// ── 고른 일정의 테두리(편집실 점선 · 시청자 실선) ──
// 규칙 하나(2026-11-18 소유자): 이어진 일정은 줄마다 한 블록으로 바깥을 두르고, 누른 날짜 부분만 짙게.
// 띠·꺾인 띠·화살 모서리 어느 이음이든 같은 블록 외곽(blockPath)을 쓴다. 이어지지 않은 일정은 카드 자체 링(CSS) 그대로.
// 층은 달력 격자 바로 뒤 형제(svg.chain-ring-layer) 하나 — 칸 안에 두면 옆 칸 카드에 가려졌다(오른쪽 세로변 사고).
const ringLayers = new WeakMap<HTMLElement, SVGSVGElement>();
const PICKED = ".studio-event-pill.primary-selected, .band-slot.is-picked, .public-event.detail-current";
function drawRings(root: HTMLElement) {
  const pickedEl = root.querySelector<HTMLElement>(PICKED);
  const pickedCard = pickedEl?.classList.contains("band-slot")
    ? root.querySelector<HTMLElement>(`[data-band-head="${CSS.escape(pickedEl.dataset.bandSlot ?? "")}"]`)
    : pickedEl;
  const blocks: Block[] = [];
  if (pickedEl && pickedCard) {
    const done = new Set<HTMLElement>();
    const queue = [pickedCard];
    while (queue.length) {
      const c = queue.pop()!;
      if (done.has(c)) continue;
      const b = blockOf(root, c);
      b.cards.forEach((m) => done.add(m));
      blocks.push(b);
      queue.push(...b.wraps);
    }
  }
  // 혼자인 일정(이어짐 없음)은 카드 링이 맡는다.
  // 여러 칸 폭 한 장짜리 띠(같은 글 — 카드는 머리 하나, 뒤 칸은 손잡이)도 이어진 블록이다.
  const multiCell = (c: HTMLElement) => c.hasAttribute("data-band-head");
  const linked = blocks.length > 1 || (blocks[0]?.cards.length ?? 0) > 1 || Boolean(blocks[0]?.cards.some(multiCell));
  const owned = new Set<HTMLElement>(linked ? blocks.flatMap((b) => b.cards) : []);
  for (const el of Array.from(root.querySelectorAll<HTMLElement>("[data-ring-svg]"))) {
    if (!owned.has(el)) el.removeAttribute("data-ring-svg");
  }
  let layer = ringLayers.get(root);
  if (!linked || !pickedEl || !pickedCard) {
    layer?.replaceChildren();
    return;
  }
  for (const el of owned) if (!el.hasAttribute("data-ring-svg")) el.setAttribute("data-ring-svg", "");
  if (!layer || !layer.isConnected) {
    layer = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
    layer.setAttribute("class", "chain-ring-layer");
    layer.setAttribute("aria-hidden", "true");
    root.after(layer);
    ringLayers.set(root, layer);
  }
  // 편집실 = 점선(지금 손대는 중), 시청자 화면 = 실선.
  const kind = pickedEl.closest(".studio-day") ? "dash" : "solid";
  const e = kind === "dash" ? 1.75 : 3;
  const local = localOf(layer, root);
  const pick = local(pickedEl.getBoundingClientRect());
  // 여러 칸 폭 띠 머리를 눌렀으면 짙은 부분은 머리가 선 그 날짜 칸까지만(뒤 칸은 다른 날 조각).
  const cell = pickedEl.hasAttribute("data-band-head") ? pickedEl.closest<HTMLElement>("article") : null;
  if (cell) pick.right = Math.min(pick.right, local(cell.getBoundingClientRect()).right);
  const old = new Map<string, SVGGElement>();
  for (const g of Array.from(layer.querySelectorAll<SVGGElement>(":scope > g[data-ring]"))) old.set(g.dataset.ring ?? "", g);
  const keep = new Set<string>();
  for (const block of blocks) {
    keep.add(block.key);
    let g = old.get(block.key);
    if (!g) {
      // 같은 경로 두 벌 — 옅은 전체 + 누른 날짜 폭만 잘라 낸 짙은 것. 같은 경로라 점선 무늬가 이어진다.
      g = document.createElementNS(SVG_NS, "g") as SVGGElement;
      g.setAttribute("data-ring", block.key);
      const id = `cr${Math.random().toString(36).slice(2, 9)}`;
      g.innerHTML =
        `<defs><clipPath id="${id}"><rect y="-9999" height="29999"/></clipPath></defs>` +
        `<path class="ring-all"/><path class="ring-pick" clip-path="url(#${id})"/>`;
      layer.append(g);
    }
    g.setAttribute("class", `chain-ring-pair is-${kind}`);
    const d = blockPath(block, local, e, -0.75);
    const all = g.querySelector<SVGPathElement>(".ring-all")!;
    const top = g.querySelector<SVGPathElement>(".ring-pick")!;
    const hasPick = block.cards.includes(pickedCard);
    // 블록 전체가 누른 조각이면(한 장짜리) 옅은 벌은 필요 없다.
    const whole = hasPick && block.cards.length === 1 && !multiCell(block.cards[0]);
    all.setAttribute("class", `ring-all chain-ring is-${kind} is-linked`);
    top.setAttribute("class", `ring-pick chain-ring is-${kind}`);
    all.style.display = whole ? "none" : "";
    top.style.display = hasPick ? "" : "none";
    for (const path of [all, top]) if (path.getAttribute("d") !== d) path.setAttribute("d", d);
    const clip = g.querySelector("clipPath rect");
    clip?.setAttribute("x", String(pick.left - e - 2));
    clip?.setAttribute("width", String(Math.max(0, pick.right - pick.left + (e + 2) * 2)));
  }
  for (const [key, g] of old) if (!keep.has(key)) g.remove();
}
function reduceMotion(): boolean {
  if (typeof document !== "undefined" && document.documentElement.hasAttribute("data-reduce-motion")) return true;
  return typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
let sheenMaskSeq = 0;
/** 흰 바탕 마스크 + 검게 칠한 왕관 그림 자리 — 그림 알파만큼 빛이 가려진다. */
function crownMask(layer: SVGSVGElement, path: SVGPathElement): SVGGElement {
  const id = `card-sheen-mask-${++sheenMaskSeq}`;
  const defs = document.createElementNS(SVG_NS, "defs");
  const ink = document.createElementNS(SVG_NS, "filter");
  ink.setAttribute("id", `${id}-ink`);
  const cm = document.createElementNS(SVG_NS, "feColorMatrix");
  cm.setAttribute("type", "matrix");
  cm.setAttribute("values", "0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0");
  ink.append(cm);
  const mask = document.createElementNS(SVG_NS, "mask");
  mask.setAttribute("id", id);
  mask.setAttribute("maskUnits", "userSpaceOnUse");
  for (const [k, v] of [["x", "-99999"], ["y", "-99999"], ["width", "199998"], ["height", "199998"]]) mask.setAttribute(k, v);
  const bg = document.createElementNS(SVG_NS, "rect");
  for (const [k, v] of [["x", "-99999"], ["y", "-99999"], ["width", "199998"], ["height", "199998"], ["fill", "#fff"]]) bg.setAttribute(k, v);
  const holes = document.createElementNS(SVG_NS, "g");
  holes.setAttribute("filter", `url(#${id}-ink)`);
  mask.append(bg, holes);
  defs.append(ink, mask);
  layer.append(defs);
  path.setAttribute("mask", `url(#${id})`);
  return holes;
}
/** 왕관마다 지금 프레임의 자리·기울기(까딱 애니메이션 포함)로 구멍 그림을 맞춘다. 좌표는 sheenPath와 같은 host 기준. */
function placeCrownHoles(holes: SVGGElement, crowns: HTMLImageElement[], host: HTMLElement) {
  const hostRect = host.getBoundingClientRect();
  const s = scaleOf(host);
  crowns.forEach((crown, i) => {
    let img = holes.children[i] as SVGImageElement | undefined;
    if (!img) {
      img = document.createElementNS(SVG_NS, "image") as SVGImageElement;
      img.setAttribute("href", crown.currentSrc || crown.src);
      img.setAttribute("preserveAspectRatio", "none");
      holes.append(img);
    }
    if (!crown.isConnected) return img.setAttribute("width", "0");
    const r = crown.getBoundingClientRect();
    const w = crown.offsetWidth;
    const h = crown.offsetHeight;
    // 회전·눌림은 중심 기준이라 겉상자 중심 = 그림 중심. 선형 부분만 옮겨 쓴다.
    const m = new DOMMatrixReadOnly(getComputedStyle(crown).transform === "none" ? undefined : getComputedStyle(crown).transform);
    const cx = ((r.left + r.right) / 2 - hostRect.left) / s;
    const cy = ((r.top + r.bottom) / 2 - hostRect.top) / s;
    img.setAttribute("x", String(-w / 2));
    img.setAttribute("y", String(-h / 2));
    img.setAttribute("width", String(w));
    img.setAttribute("height", String(h));
    img.setAttribute("transform", `translate(${cx} ${cy}) matrix(${m.a} ${m.b} ${m.c} ${m.d} 0 0)`);
  });
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
  const block = blockOf(root, target.card);
  const lead = block.bodies[0][0];
  const host = lead.closest<HTMLElement>("article") ?? lead.parentElement;
  if (!host) return;
  const layer = document.createElementNS(SVG_NS, "svg") as SVGSVGElement;
  layer.setAttribute("class", "card-sheen-layer");
  layer.setAttribute("aria-hidden", "true");
  const path = document.createElementNS(SVG_NS, "path");
  path.setAttribute("class", "card-sheen");
  path.setAttribute("pathLength", "100");
  // 왕관 아래로 지나가게(2026-11-18 소유자) — 이 층은 표면 전체 위(z 12)에 있고 왕관은 카드 쌓임 맥락 안이라
  // 층 순서로는 못 내린다. 대신 지나가는 카드의 왕관 모양(그림 알파)을 마스크로 빛에서 도려낸다.
  const crowns = block.cards
    .map((c) => c.querySelector<HTMLImageElement>(":scope > .tier-crown"))
    .filter((c): c is HTMLImageElement => Boolean(c));
  const holes = crowns.length > 0 ? crownMask(layer, path) : null;
  layer.append(path);
  host.append(layer);
  const run: SheenRun = { key: target.key, raf: 0, layer, until: performance.now() + SHEEN_MS };
  const step = () => {
    const d = sheenPath(root, target, host);
    if (d && path.getAttribute("d") !== d) path.setAttribute("d", d);
    if (holes) placeCrownHoles(holes, crowns, host);
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
  const card = el.closest<HTMLElement>("[data-step-from], [data-step-to]");
  if (card) return card.dataset.stepFrom ?? card.dataset.stepTo ?? null;
  return el.closest<SVGGElement>("g[data-step]")?.dataset.step ?? null;
}
/** 크기·자리를 바꾸지 않는 변화인가 — 손 올림 표시와 광택 레이어. */
function isDecorativeMutation(r: MutationRecord): boolean {
  if (r.type === "attributes") {
    if (r.attributeName === "data-chain-hot") return true;
    return r.attributeName === "class" && r.target instanceof SVGElement;
  }
  if (r.type !== "childList") return false;
  const sheen = (n: Node) => n instanceof Element && n.classList.contains("card-sheen-layer");
  const nodes = [...r.addedNodes, ...r.removedNodes];
  return nodes.length > 0 && nodes.every(sheen);
}

function applyHot(root: HTMLElement, key: string | null) {
  const prev = hotKey.get(root) ?? null;
  if (prev === key) return;
  hotKey.set(root, key);
  const toggle = (k: string | null, on: boolean) => {
    if (!k) return;
    const e = CSS.escape(k);
    root
      .querySelectorAll(`[data-step-from="${e}"], [data-step-to="${e}"]`)
      .forEach((n) => n.toggleAttribute("data-chain-hot", on));
    root.querySelectorAll(`g[data-step="${e}"]`).forEach((n) => n.classList.toggle("is-hot", on));
  };
  toggle(prev, false);
  toggle(key, true);
}

// 이어진 일정(같은 data-chain) 칸들의 높이를 그 묶음에서 가장 큰 칸에 맞춘다.
// 글자 수가 달라 높이가 다른 카드가 이어질 때 이음새가 어긋나 보이는 걸 막는다.
// (2026-11-16) 같은 일을 하는 김에 같은 글 띠의 머리 폭(data-band-head)과 꺾인 띠 이음(data-step-from·to)도
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
        attributeFilter: ["class", "data-chain", "data-band-head", "data-step-from", "data-step-to", "data-chain-hot"]
      });
    }

    // 폭 변화(두 칸 폭 띠 ↔ 한 칸 카드)를 스프링으로 — WAAPI라 매 프레임 다시 쓰는 인라인 폭보다 우선한다.
    // 첫 그림(마운트 직후)과 '동작 줄이기'에선 하지 않는다.
    // (폭 애니메이션은 뺐다 — 늘어나는 동안 좁은 폭에 여러 단 배치가 먼저 적용돼 글자가 찌그러진 장면이 깜빡였다.
    //  아래처럼 그리기 전에 바로 맞추므로 첫 장면부터 제 폭이다.)

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
        // 뒤로 더 이어지면(평평한 오른쪽 변, 음수 마진) 그 넘침만큼 더 — 마지막 빈 자리 끝에서 멈추면 다음 칸 조각과 사이에
        // 틈이 벌어졌다(2026-11-17 소유자 '릴동파 25·26일 끊김').
        const overhang = Math.max(0, -parseFloat(getComputedStyle(head).marginRight) || 0);
        const w = (tail.getBoundingClientRect().right - head.getBoundingClientRect().left) / s + overhang;
        if (w > 0) {
          const target = `${Math.round(w * 10) / 10}px`;
          // 새로 띠 머리가 되면(끌기 미리보기 등) 제 칸 폭에서 띠 폭으로 부드럽게 늘어난다.
          const fresh = !head.hasAttribute("data-band-w");
          head.style.width = target;
          head.setAttribute("data-band-w", "");
          // 본문 줄을 칸마다 한 단씩 — 두 칸 폭 띠의 오른쪽이 비어 한쪽으로 쏠려 보이지 않게(2026-11-17 소유자
          // "불균형 싫다"). 둘째 단이 옆 칸 카드들의 글자 시작선에 오도록 단 간격 = 칸 간격 + 카드 좌우 안쪽 여백.
          const cs = getComputedStyle(head);
          const parent = head.parentElement;
          const ps = parent ? getComputedStyle(parent) : null;
          const cw = parent && ps
            ? parent.clientWidth - parseFloat(ps.paddingLeft) - parseFloat(ps.paddingRight)
            : head.offsetWidth;
          const pitch = (slots[0].getBoundingClientRect().left - head.getBoundingClientRect().left) / s;
          const gap = pitch - cw + parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight);
          const subs = head.querySelector(".event-subs, .pill-subs");
          const span = slots.length + 1;
          head.style.setProperty("--band-span", String(span));
          // 제목도 한 칸으로 쳐서 단마다 고르게 — 예) 제목+3줄, 2칸 → 왼쪽(제목·1줄) / 오른쪽(2줄).
          const blocks = (subs?.children.length ?? 0) + 1;
          head.style.setProperty("--band-rows", String(Math.max(1, Math.ceil(blocks / span))));
          // 글 덩어리가 칸 수보다 적으면(예: 제목 한 줄인데 세 칸 폭) 단으로 나누지 않고 띠 가운데에 — 왼쪽에 몰려 나머지
          // 칸이 비어 보이지 않게(2026-11-17 소유자 '릴동파 연습').
          head.toggleAttribute("data-band-sparse", blocks < span);
          if (Number.isFinite(gap) && gap > 0) head.style.setProperty("--band-col-gap", `${gap.toFixed(1)}px`);
          // 새로 띠가 되는 순간 — 제 칸 폭에서 옆 칸까지 왼→오른쪽으로 쭉 펼쳐지듯 드러난다(모양은 처음부터 최종이라
          // 글자가 찌그러지거나 다시 흐르지 않는다). 끌기 미리보기에서 꺾인 띠 ↔ 띠가 툭툭 바뀌던 것(2026-11-17 소유자).
          const now = typeof performance !== "undefined" ? performance.now() : 0;
          if (fresh && !reduceMotion() && now - (mountedAt.get(root!) ?? now) > 1200 && typeof head.animate === "function") {
            const r = parseFloat(cs.borderTopLeftRadius) || 8;
            const hide = Math.max(0, w - cw);
            head.animate(
              [
                { clipPath: `inset(-4px ${hide.toFixed(1)}px -4px -4px round ${r}px)` },
                { clipPath: `inset(-4px -4px -4px -4px round ${r}px)` }
              ],
              { duration: 260, easing: "cubic-bezier(0.2, 0.8, 0.2, 1)" }
            );
          }
        }
      }
      // 더는 띠 머리가 아닌 카드(끌기 미리보기·순서 변경으로 꺾인 띠가 된 경우)의 넓힌 폭을 되돌린다 — 안 그러면
      // 두 칸 폭이 남아 옆 칸 카드 위로 겹친다(그리기 전에 바로 되돌린다).
      for (const el of Array.from(root!.querySelectorAll<HTMLElement>("[data-band-w]:not([data-band-head])"))) {
        el.style.width = "";
        el.removeAttribute("data-band-w");
        el.style.removeProperty("--band-span");
        el.style.removeProperty("--band-rows");
        el.style.removeProperty("--band-col-gap");
        el.removeAttribute("data-band-sparse");
      }
      const pills = Array.from(root!.querySelectorAll<HTMLElement>("[data-chain]"));
      // 지난번에 맞춰 준 칸 중 더는 묶음이 아닌 것(이음이 바뀜)도 되돌린다 — 높이가 남아 빈 칸처럼 보이지 않게.
      for (const p of Array.from(root!.querySelectorAll<HTMLElement>("[data-eq-h]"))) {
        p.style.minHeight = "";
        p.removeAttribute("data-eq-h");
      }
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
          el.setAttribute("data-eq-h", "");
        }
      }
      drawSteps(root!);
      drawRings(root!);
      liftSliding(root!);
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
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            equalize();
            schedule();
          })
        : null;
    ro?.observe(root);
    // 바뀐 그 자리에서 바로 잰다(다음 프레임 X) — MutationObserver·ResizeObserver 콜백은 화면을 그리기 전에 돈다.
    // 다음 프레임으로 미루면, React가 카드 모양(이음 종류)을 바꾼 그 한 장면이 옛 띠·폭으로 그려져 깜빡였다.
    mo =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver((records) => {
            // 손 올림 표시(data-chain-hot·.is-hot)와 광택 레이어의 생성·삭제는 CSS·장식일 뿐 크기를 안 바꾼다 —
            // 이것까지 다시 재면 카드에 마우스를 올릴 때마다 전체 맞춤이 250ms씩 매 프레임 돌았다(2026-11-17).
            if (records.every(isDecorativeMutation)) return;
            equalize();
            schedule();
          })
        : null;
    observe();
    const onSettle = () => schedule();
    // 카드가 미끄러지는 동안(놓을 자리 열림·닫힘, 원래 위치 등장) 매 프레임 다시 잰다 — 시작 순간부터 끝까지.
    // 끝(transitionend)에만 재면 그 사이 띠·테두리가 옛 자리에 남아 카드와 겹치고 점선이 둘로 갈라져 보였다.
    // 색·그림자·필터 전환(호버 강조)은 자리를 안 바꾼다 — 자리·크기를 바꾸는 전환만 펌프를 돌린다.
    const onTransitionRun = (e: TransitionEvent) => {
      if (GEOMETRY_PROPS.test(e.propertyName)) onMotionStart();
    };
    const onMotionStart = () => {
      pumpUntil = Math.max(pumpUntil, (typeof performance !== "undefined" ? performance.now() : 0) + 480);
      if (!pumping) pump();
    };
    root.addEventListener("animationend", onSettle);
    root.addEventListener("transitionend", onSettle);
    root.addEventListener("transitionrun", onTransitionRun);
    // 착지 애니메이션(FLIP)처럼 transform을 '전환 없이' 먼저 걸고 시작하는 움직임은 transitionrun이 한 박자 늦다 —
    // 시작을 알리는 이벤트(vic:layout-motion)에 바로 다시 잰다(그리기 전).
    const onLayoutMotion = () => {
      equalize();
      onMotionStart();
    };
    window.addEventListener("vic:layout-motion", onLayoutMotion);
    root.addEventListener("animationstart", onMotionStart);
    window.addEventListener("resize", schedule);

    cleanupRef.current = () => {
      cancelled = true;
      ringLayers.get(root)?.remove();
      ringLayers.delete(root);
      cancelAnimationFrame(pumpRaf);
      ro?.disconnect();
      mo?.disconnect();
      root.removeEventListener("pointerover", onOver);
      root.removeEventListener("pointerleave", onLeave);
      root.removeEventListener("transitionrun", onTransitionRun);
      window.removeEventListener("vic:layout-motion", onLayoutMotion);
      root.removeEventListener("animationstart", onMotionStart);
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
