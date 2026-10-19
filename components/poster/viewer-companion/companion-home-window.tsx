"use client";

/* eslint-disable @next/next/no-img-element -- Five bounded local WebP stages preserve their exact transparent registration. */
import { useLayoutEffect, useRef } from "react";
import { REDUCE_MOTION_EVENT } from "@/lib/ui/motion";
import type { CompanionHomeEnvironment } from "@/lib/ui/viewer-companion/home-environment";
import type { CompanionHomeCurtain } from "@/lib/ui/viewer-companion/home-curtain";
import { resolveCompanionWindowScene } from "@/lib/ui/viewer-companion/home-window-scene";
import { COMPANION_CURTAIN_STAGES, companionCurtainStage, createCompanionCurtainTransition } from "@/lib/ui/viewer-companion/home-curtain-transition";
import "./companion-home-window.css";

export function HomeWindow({ environment, curtain, inactive }: { environment?: CompanionHomeEnvironment; curtain: CompanionHomeCurtain; inactive?: boolean }) {
  const scene = resolveCompanionWindowScene(environment), stage = companionCurtainStage(curtain);
  const host = useRef<HTMLDivElement>(null), apply = useRef<(() => void) | undefined>(undefined);
  // SSR gets its actual current picture once. After mount, only the finite
  // controller writes opacity; React never overwrites an interrupted blend.
  const initialStage = useRef(stage);
  const latest = useRef({ stage, curtain, inactive }); latest.current = { stage, curtain, inactive };
  useLayoutEffect(() => {
    const element = host.current; if (!element) return;
    const document = element.ownerDocument, win = document.defaultView; if (!win) return;
    const images = [...element.querySelectorAll<HTMLImageElement>(".vc-window-curtain-stage")];
    const transition = createCompanionCurtainTransition(images.map(image => ({
      opacity(value) { image.style.opacity = String(value); },
      readOpacity() { return Number(win.getComputedStyle(image).opacity); },
      animate: typeof images[0]?.animate === "function" ? (frames, options) => image.animate(frames, options) : undefined,
    })), initialStage.current);
    const update = () => {
      const { stage, curtain, inactive } = latest.current, html = document.documentElement;
      const enabled = curtain.animate && curtain.active && !inactive && !document.hidden && !element.closest("[hidden],[inert]")
        && !html.hasAttribute("data-reduce-motion") && !["off", "soft"].includes(html.dataset.gfx ?? "");
      const css = win.getComputedStyle(html), duration = css.getPropertyValue("--dur-2").trim(), amount = Number.parseFloat(duration);
      transition.update(stage, enabled, { stepMs: amount * (duration.endsWith("ms") ? 1 : 1000), easing: css.getPropertyValue("--ease").trim() || "ease-in-out" });
    };
    apply.current = update; update();
    // Reuse existing disclosure/visibility/graphics boundaries, not another
    // observer, clock, interval or per-frame React update.
    document.addEventListener("visibilitychange", update);
    const events = ["vic:panel-section", "vic:gfx-pref", "vic:gfx-auto", REDUCE_MOTION_EVENT, "storage"];
    events.forEach(event => win.addEventListener(event, update));
    return () => { apply.current = undefined; document.removeEventListener("visibilitychange", update); events.forEach(event => win.removeEventListener(event, update)); transition.dispose(); };
  }, []);
  useLayoutEffect(() => { apply.current?.(); }, [stage, curtain.animate, curtain.active, inactive]);
  return <div ref={host} className="vc-home-window" aria-hidden="true" data-season={scene.season} data-weather={scene.weather} data-band={environment?.band} data-phase={scene.phase} data-night={environment?.night || undefined} data-curtain={curtain.phase} data-curtain-stage={stage} data-curtain-rest={curtain.rest} data-curtain-motion={curtain.animate && curtain.active && !inactive ? "on" : "off"}>
    <span className="vc-window-glass">
      <img className="vc-window-landscape" src={scene.landscapeSrc} alt="" width="512" height="384" draggable={false} decoding="async" loading="lazy" />
      {scene.overlaySrc && <img className="vc-window-weather" src={scene.overlaySrc} alt="" width="512" height="384" draggable={false} decoding="async" loading="lazy" />}
      <span className="vc-window-atmosphere" /><span className="vc-window-crossbar" />
    </span>
    <span className="vc-window-sill" />
    <span className="vc-window-curtain-overlay" aria-hidden="true">
      {COMPANION_CURTAIN_STAGES.map(index => <img key={index} className="vc-window-curtain-stage" data-curtain-image={index} src={`/companion/home/126/curtain-stage-${index}.webp`} alt="" width="256" height="192" draggable={false} decoding="async" loading="lazy" style={{ opacity: index === initialStage.current ? 1 : 0 }} />)}
    </span>
  </div>;
}
