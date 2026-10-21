"use client";

import { useLayoutEffect, useRef } from "react";
import { REDUCE_MOTION_EVENT } from "@/lib/ui/motion";
import { companionDiscoveryFlightPlan, createCompanionDiscoveryFlightGate, validCompanionDiscoveryNotice, type CompanionDiscoveryNotice } from "@/lib/ui/viewer-companion/discovery-flight";
import { CompanionCollectionArt } from "./companion-collection-art";
import { CompanionToyArt } from "./companion-toy-art";
import { COMPANION_PORTRAIT_READY_EVENT } from "@/lib/ui/viewer-companion/memory-catalog";
import "./companion-discovery-flight.css";

export type { CompanionDiscoveryNotice } from "@/lib/ui/viewer-companion/discovery-flight";

/** One finite, pointer-free souvenir. All collection/experience ACKs belong to
 * the caller; displaying, canceling or finishing never writes a discovery. */
export function CompanionDiscoveryFlight({ notice, enabled, onComplete }: { notice: CompanionDiscoveryNotice | null; enabled: boolean; onComplete: (serial: number) => void }) {
  const host = useRef<HTMLSpanElement>(null), gate = useRef<ReturnType<typeof createCompanionDiscoveryFlightGate> | null>(null), complete = useRef(onComplete);
  gate.current ??= createCompanionDiscoveryFlightGate(); complete.current = onComplete;
  useLayoutEffect(() => {
    if (!notice || !gate.current!.accept(notice.serial)) return;
    const node = host.current, document = node?.ownerDocument, win = document?.defaultView;
    let animation: Animation | undefined, stopped = false;
    const finish = () => {
      if (stopped) return; stopped = true;
      if (animation) { animation.onfinish = null; animation.cancel(); }
      if (gate.current!.finish(notice.serial)) complete.current(notice.serial);
    };
    if (!enabled || !node || !document || !win || document.hidden || !validCompanionDiscoveryNotice(notice)) { finish(); return; }
    const quiet = () => document.documentElement.hasAttribute("data-reduce-motion") || ["off", "soft"].includes(document.documentElement.dataset.gfx ?? "");
    const initiallyQuiet = quiet();
    let book: DOMRect | undefined;
    for (const element of document.querySelectorAll<HTMLElement>(".vc-book-button")) {
      const rect = element.getBoundingClientRect();
      if (element.isConnected && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < win.innerHeight && rect.right > 0 && rect.left < win.innerWidth && win.getComputedStyle(element).visibility !== "hidden" && !element.closest("[hidden],[inert],[aria-hidden='true']")) { book = rect; break; }
    }
    const plan = companionDiscoveryFlightPlan(notice.source, book ? { x: book.left + book.width / 2, y: book.top + book.height / 2 } : undefined, initiallyQuiet);
    const boundary = () => { if (document.hidden || quiet() !== initiallyQuiet) finish(); };
    const storage = (event: StorageEvent) => { if (event.key === null || ["vic.reduceMotion", "vic.gfx", "vic.gfxPref"].includes(event.key)) boundary(); };
    document.addEventListener("visibilitychange", boundary);
    const events = [REDUCE_MOTION_EVENT, "vic:gfx-pref", "vic:gfx-auto"];
    events.forEach(event => win.addEventListener(event, boundary)); win.addEventListener("storage", storage);
    const start = () => {
      if (stopped) return;
      if (plan && typeof node.animate === "function") {
        animation = node.animate(plan.frames, { duration: plan.duration, easing: win.getComputedStyle(document.documentElement).getPropertyValue("--ease").trim() || "ease-out", fill: "both" });
        animation.onfinish = finish;
      } else finish();
    };
    // Only this newly earned picture is decoded. Unknown collection entries
    // are never mounted or prefetched, and canceled decodes cannot replay.
    const image = node.querySelector<HTMLImageElement>("img"), svg = node.querySelector("image"), stamp = node.querySelector<HTMLElement>("[data-collection-art]");
    const src = image?.currentSrc || image?.src || svg?.getAttribute("href") || (stamp && win.getComputedStyle(stamp).backgroundImage.match(/url\(["']?(.*?)["']?\)/)?.[1]);
    const portrait = node.querySelector<HTMLCanvasElement>("canvas[data-collection-art-id]");
    const portraitReady = () => { if (portrait?.dataset.portraitReady === "true") start(); else finish(); };
    if (portrait) {
      if (portrait.dataset.portraitReady !== undefined) portraitReady();
      else portrait.addEventListener(COMPANION_PORTRAIT_READY_EVENT, portraitReady, { once: true });
    }
    else if (src) { const picture = new win.Image(); picture.src = src; if (typeof picture.decode === "function") void picture.decode().then(start, finish); else start(); }
    else finish();
    return () => { portrait?.removeEventListener(COMPANION_PORTRAIT_READY_EVENT, portraitReady); document.removeEventListener("visibilitychange", boundary); events.forEach(event => win.removeEventListener(event, boundary)); win.removeEventListener("storage", storage); finish(); };
  }, [notice, enabled]);
  if (!notice || !validCompanionDiscoveryNotice(notice)) return null;
  return <span aria-hidden="true" className="vc-discovery-flight" ref={host} hidden={!enabled} data-discovery-kind={notice.kind}>
    {notice.kind === "toy" ? <CompanionToyArt kind={notice.id} /> : <CompanionCollectionArt kind={notice.kind === "food" ? "food-stamp" : notice.kind === "behavior" ? "behavior-stamp" : "situation-stamp"} id={notice.id} />}
  </span>;
}
