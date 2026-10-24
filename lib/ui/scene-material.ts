import { useEffect, useState } from "react";
import { companionShowcaseLayoutMutation, exposedCompanionShowcaseRect, readCompanionShowcaseCovers } from "./viewer-companion/showcase-session";

export type SceneMaterial = { canvas: HTMLCanvasElement; size: number; basis: readonly Uint8ClampedArray[]; night: boolean };
let current: SceneMaterial | undefined;
let backdropOwner: HTMLCanvasElement | undefined;
const listeners = new Set<() => void>();
let sequence = 0;
let coversCache: ReturnType<typeof readCompanionShowcaseCovers> | undefined;
function coversForPaint() {
  if (!coversCache) {
    coversCache = readCompanionShowcaseCovers();
    // Stable layout is reused across actor/item paint callbacks. Actual
    // layout/scroll/resize events below invalidate it; no frame polling.
  }
  return coversCache;
}
export function publishSceneMaterial(sample: SceneMaterial | undefined, owner: HTMLCanvasElement) {
  if (!sample && current?.canvas !== owner) return;
  current = sample;
  for (const listener of listeners) listener();
}
/** The pending world already paints a night backdrop before art is ready.
 * Title contrast follows those painted pixels, independently of item material. */
export function publishSceneBackdrop(night: boolean | undefined, owner: HTMLCanvasElement) {
  if (night === undefined && backdropOwner !== owner) return;
  backdropOwner = night === undefined ? undefined : owner;
  document.documentElement.toggleAttribute("data-ambient-night", Boolean(night));
}

/** Bilinear source-over/color field sampled at the object's actual foot.
 * RGB basis comes from the existing canvas light pass, including its spatial
 * direction, weather and ground masks; alpha is deliberately left unchanged. */
export function sceneMaterialMatrix(sample: Pick<SceneMaterial, "size" | "basis">, x: number, y: number): string {
  const n = sample.size, px = Math.max(0, Math.min(n - 1, x * (n - 1))), py = Math.max(0, Math.min(n - 1, y * (n - 1)));
  const a = Math.floor(px), b = Math.floor(py), fx = px - a, fy = py - b;
  const read = (field: Uint8ClampedArray, channel: number) => {
    const at = (u: number, v: number) => field[(v * n + u) * 4 + channel] / 255;
    const top = at(a, b) * (1 - fx) + at(Math.min(a + 1, n - 1), b) * fx;
    const bottom = at(a, Math.min(b + 1, n - 1)) * (1 - fx) + at(Math.min(a + 1, n - 1), Math.min(b + 1, n - 1)) * fx;
    return top * (1 - fy) + bottom * fy;
  };
  const values: number[] = [];
  for (let c = 0; c < 3; c++) { const black = read(sample.basis[0], c); values.push(...[1, 2, 3].map(i => read(sample.basis[i], c) - black), 0, black); }
  return [...values, 0, 0, 0, 1, 0].map(v => v.toFixed(5)).join(" ");
}

function createPainter() {
  const entries = new Map<HTMLElement, { point: { x: number; y: number }; matrix?: SVGFEColorMatrixElement; filter?: SVGFilterElement; id?: string; value?: string }>();
  let svg: SVGSVGElement | undefined;
  const ns = "http://www.w3.org/2000/svg";
  const update = (only?: HTMLElement) => {
    const html = document.documentElement;
    const canvas = current?.canvas;
    const enabled = current && canvas?.isConnected && html.dataset.ambient !== "off" && !["off", "soft"].includes(html.dataset.gfx ?? "");
    const rect = enabled ? canvas.getBoundingClientRect() : undefined;
    const canvasStyle = enabled ? getComputedStyle(canvas!) : undefined;
    const visible = rect && rect.width > 0 && rect.height > 0 && canvasStyle?.display !== "none";
    const covers = visible && !html.hasAttribute("data-showcase") ? coversForPaint() : [];
    for (const [node, entry] of entries) {
      if (!node.isConnected) { entry.filter?.remove(); entries.delete(node); continue; }
      if (only && node !== only) continue;
      const box = node.getBoundingClientRect();
      const exposed = visible && exposedCompanionShowcaseRect(box, { width: innerWidth, height: innerHeight }, covers);
      if (!exposed) { node.style.removeProperty("--vc-scene-light-filter"); node.removeAttribute("data-scene-lit"); continue; }
      if (!svg) {
        svg = document.createElementNS(ns, "svg"); svg.setAttribute("aria-hidden", "true"); svg.setAttribute("width", "0"); svg.setAttribute("height", "0"); svg.style.position = "fixed"; svg.style.pointerEvents = "none"; document.body.append(svg);
      }
      if (!entry.matrix) {
        entry.id = `vic-scene-material-${++sequence}`;
        entry.filter = document.createElementNS(ns, "filter"); entry.filter.id = entry.id; entry.filter.setAttribute("color-interpolation-filters", "sRGB");
        entry.filter.setAttribute("x", "-30%"); entry.filter.setAttribute("y", "-30%"); entry.filter.setAttribute("width", "160%"); entry.filter.setAttribute("height", "160%");
        entry.matrix = document.createElementNS(ns, "feColorMatrix"); entry.matrix.setAttribute("type", "matrix"); entry.filter.append(entry.matrix); svg.append(entry.filter);
      }
      // CSS anchors and ancestor motion can move a settled object without
      // changing its model coordinates. Sample its actual displayed foot.
      const source = sceneMaterialMatrix(current!, ((box.left + box.right) / 2 - rect!.left) / rect!.width, (box.bottom - rect!.top) / rect!.height);
      const strength = Math.max(0, Math.min(1, Number(canvasStyle?.opacity ?? 1)));
      const value = strength >= .999 ? source : source.split(" ").map((v, i) => (Number(v) * strength + ([0, 6, 12, 18].includes(i) ? 1 - strength : 0)).toFixed(5)).join(" ");
      if (value !== entry.value) { entry.matrix.setAttribute("values", value); entry.value = value; }
      node.style.setProperty("--vc-scene-light-filter", `url("#${entry.id}")`); node.setAttribute("data-scene-lit", "");
    }
  };
  return {
    apply(node: HTMLElement | null | undefined, point: { x: number; y: number }) { if (!node) return; const old = entries.get(node); if (old) old.point = point; else entries.set(node, { point }); update(node); },
    attach() {
      const refresh = () => { coversCache = undefined; update(); };
      const relight = () => update();
      listeners.add(relight);
      const observer = new MutationObserver(refresh); observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-ambient", "data-ambient-dim", "data-gfx", "data-showcase", "data-pchrome"] });
      const layout = new MutationObserver(records => { if (records.some(companionShowcaseLayoutMutation)) refresh(); });
      layout.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "hidden", "open", "aria-hidden", "aria-modal"] });
      const events = ["vic:panel-section", "vic:side-panel", "vic:companion-home", "vic:companion-overlay", "vic:layout-motion", "transitionend", "animationend"];
      for (const name of events) window.addEventListener(name, refresh, true);
      window.addEventListener("scroll", refresh, { passive: true, capture: true }); window.addEventListener("resize", refresh, { passive: true });
      return () => { listeners.delete(relight); observer.disconnect(); layout.disconnect(); for (const name of events) window.removeEventListener(name, refresh, true); window.removeEventListener("scroll", refresh, true); window.removeEventListener("resize", refresh); for (const node of entries.keys()) { node.style.removeProperty("--vc-scene-light-filter"); node.removeAttribute("data-scene-lit"); } entries.clear(); svg?.remove(); svg = undefined; };
    }
  };
}

export function useCompanionSceneMaterial() {
  const [painter] = useState(createPainter);
  useEffect(() => painter.attach(), [painter]);
  return painter;
}
