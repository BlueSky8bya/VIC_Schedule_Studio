"use client";

import { useEffect, useRef } from "react";
import { COMPANION_TOY_KINDS, COMPANION_TOY_NAMES, type CompanionToyKind } from "@/lib/ui/viewer-companion/toy-catalog";
import { COMPANION_GROUNDED_TOY_CONTROLS, companionToyPlayDuration, sampleCompanionToyPlay } from "@/lib/ui/viewer-companion/toy-play";
import { paintCompanionToyAxis } from "@/lib/ui/viewer-companion/toy-motion-paint";
import { CompanionToyLiveArt } from "./companion-toy-live-art";
import "./companion-toys.css";

/** Explicit mechanical-art fixture, not a seeded autonomous AI witness. It
 * runs the production finite sampler, axis painter and live art/CSS for all
 * 84 identities at normal speed, once, on fixed labelled contact planes. */
export function ToyMotionFixture({ reduced = false }: { reduced?: boolean }) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    let request = 0, start = 0, disposed = false;
    const nodes = [...root.current!.querySelectorAll<HTMLButtonElement>(".vc-toy")];
    const tick = (now: number) => {
      start ||= now;
      for (const node of nodes) {
        const kind = node.dataset.kind as CompanionToyKind, duration = companionToyPlayDuration(kind);
        const elapsed = Math.max(0, now - start - 1500), p = Math.min(1, elapsed / duration), pose = sampleCompanionToyPlay(kind, p, reduced);
        const image = node.querySelector<HTMLImageElement>(".vc-toy-art")!, canvas = node.querySelector<HTMLCanvasElement>(".vc-toy-axis-art");
        const painted = Boolean(canvas && paintCompanionToyAxis(canvas, image, kind, pose.toy.rotation));
        node.toggleAttribute("data-axis-painted", painted);
        node.dataset.toyUse = pose.use; node.dataset.progress = p.toFixed(4);
        node.dataset.planted = String(COMPANION_GROUNDED_TOY_CONTROLS.has(kind));
        node.style.setProperty("--vc-toy-art-rotation", `${canvas ? 0 : pose.toy.rotation}deg`);
        node.style.setProperty("--vc-toy-play-scale", String(pose.toy.scale));
        node.style.setProperty("--vc-toy-play-facing", "1");
        // The art's known centre is the invariant pivot. Translation for
        // rolls/throws is explicit and separate from that rotation.
        node.style.transform = `translate3d(${65 + pose.toy.x}px,${66 + pose.toy.y}px,0) translate(-50%,-100%)`;
        node.dataset.paintAt = now.toFixed(3);
      }
      if (now - start < 5200) request = requestAnimationFrame(tick);
    };
    void Promise.all(nodes.map(node => node.querySelector<HTMLImageElement>("img")!.decode().catch(() => undefined))).then(() => {
      if (!disposed) { root.current!.dataset.motionReady = "true"; request = requestAnimationFrame(tick); }
    });
    return () => { disposed = true; cancelAnimationFrame(request); };
  }, [reduced]);
  return <main style={{ margin: 20, color: "#302b22", background: "#f8f2e4" }}><h1>장난감 동작 기계 검수 · 84종</h1><p>고정 접촉면에서 원본 그림·유한 재생기·실제 캔버스를 검사합니다. 자율 생활·발견·수집 검사가 아닙니다.</p><div ref={root} style={{ display: "grid", gridTemplateColumns: "repeat(12,130px)", gap: 10 }}>{COMPANION_TOY_KINDS.map(kind => <section key={kind} data-motion-kind={kind} style={{ position: "relative", width: 130, height: 105, border: "1px solid #dbc7a1", borderRadius: 8 }}><div role="img" className="vc-toy" data-kind={kind} data-carried="true" aria-label={COMPANION_TOY_NAMES[kind]} style={{ transform: "translate3d(65px,66px,0) translate(-50%,-100%)" }}><CompanionToyLiveArt kind={kind} /></div><small style={{ position: "absolute", top: 74, width: "100%", textAlign: "center" }}>{COMPANION_TOY_NAMES[kind]}</small></section>)}</div></main>;
}
