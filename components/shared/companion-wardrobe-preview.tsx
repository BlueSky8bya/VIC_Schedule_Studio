"use client";

import { useEffect, useRef, useState } from "react";
import { createCompanionAccessoryPainter } from "@/lib/ui/viewer-companion/accessory";
import type { CompanionAccessoryId } from "@/lib/ui/viewer-companion/gifts";
import { createCompanionMotion, nextCompanionPaint } from "@/lib/ui/viewer-companion/motion";
import { companionSpriteMetadata, peekDecodedCompanionSprite, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { chooseCompanionPreviewBehavior, companionPreviewDrawing, companionPreviewDuration, createCompanionPreviewPreparation, sampleCompanionPreview } from "@/lib/ui/viewer-companion/wardrobe-preview";
import "@/components/poster/viewer-companion/viewer-companion.css";

/** A local drawing only: no actor, world, care, discovery or gift operations. */
export function CompanionWardrobePreview({ accessory, behaviors, enabled }: { accessory: CompanionAccessoryId | null; behaviors: readonly string[]; enabled: boolean }) {
  const host = useRef<HTMLDivElement>(null), canvas = useRef<HTMLCanvasElement>(null), sprite = useRef<HTMLSpanElement>(null), pose = useRef<HTMLSpanElement>(null);
  const back = useRef<HTMLSpanElement>(null), front = useRef<HTMLSpanElement>(null), gift = useRef<HTMLSpanElement>(null);
  const [replay, setReplay] = useState(0), [quiet, setQuiet] = useState(true);
  const behaviorKey = behaviors.join("|");
  useEffect(() => {
    const element = host.current, drawing = canvas.current, spritePlane = sprite.current, posePlane = pose.current;
    if (!element || !drawing || !spritePlane || !posePlane || !back.current || !front.current || !gift.current) return;
    const context = drawing.getContext("2d");
    if (!context) return;
    const painter = createCompanionAccessoryPainter({ back: back.current, front: front.current, gift: gift.current });
    const motion = createCompanionMotion({ clips: Object.fromEntries(companionSpriteMetadata.rows.map((row, index) => [index, row.map((_, column) => column)])), rowCount: companionSpriteMetadata.rows.length, loopRows: [0, 2, 8, 9, 11, 20], maxFrameRate: 14 });
    const preparation = createCompanionPreviewPreparation();
    let raf: number | null = null, rest: ReturnType<typeof setTimeout> | null = null, generation = 0, disposed = false;
    let previous: ReturnType<typeof chooseCompanionPreviewBehavior> = null;
    const restricted = () => document.documentElement.hasAttribute("data-reduce-motion") || ["off", "soft"].includes(document.documentElement.dataset.gfx ?? "");
    const visible = () => !disposed && enabled && !document.hidden && element.isConnected;
    const cancel = () => { generation++; if (raf !== null) cancelAnimationFrame(raf); if (rest !== null) clearTimeout(rest); raf = null; rest = null; };
    const paint = (behavior: ReturnType<typeof chooseCompanionPreviewBehavior>, elapsed: number, now: number) => {
      const sample = sampleCompanionPreview(behavior, elapsed);
      const shape = motion.sample({ row: sample.row, phase: sample.phase, status: behavior ? "play" : "idle", x: 0, y: 0, now, reduced: !behavior });
      const selection = selectCompanionSprite(companionSpriteMetadata.rows[shape.row][shape.column], shape.row, shape.column);
      // Read and draw synchronously. Never keep a decoded Image reference,
      // change its source, move its live DOM owner or touch the shared LRU.
      const image = peekDecodedCompanionSprite(selection.src);
      if (!image) return false;
      const frame = companionPreviewDrawing(selection, image.naturalWidth, image.naturalHeight);
      context.clearRect(0, 0, drawing.width, drawing.height);
      context.drawImage(image, frame.sourceX, frame.sourceY, frame.sourceWidth, frame.sourceHeight, 0, 0, drawing.width, drawing.height);
      spritePlane.style.transform = `translate(${frame.x}%,${frame.y}%)`;
      spritePlane.style.clipPath = `inset(${frame.clip.map(value => `${value}%`).join(" ")})`;
      const bob = shape.bob + sample.lift, tilt = shape.tilt + sample.lean;
      posePlane.style.transform = `translateY(${bob}px) rotate(${tilt}deg) scale(${shape.scaleX * (1 + sample.compression * .5)},${shape.scaleY * (1 - sample.compression)})`;
      painter.paint(selection, accessory, false);
      element.dataset.previewRow = String(shape.row);
      element.dataset.previewReady = "";
      return true;
    };
    const prepare = (row: number, token: number) => preparation(row, () => visible() && token === generation);
    const schedule = (token: number) => {
      if (!visible() || restricted() || token !== generation) return;
      rest = setTimeout(() => { rest = null; void cycle(token); }, 1000 + Math.random() * 2000);
    };
    const cycle = async (token: number) => {
      if (!visible() || restricted() || token !== generation) return;
      const behavior = chooseCompanionPreviewBehavior(behaviorKey.split("|"), previous);
      if (!behavior) return;
      previous = behavior;
      if (!await prepare(sampleCompanionPreview(behavior, 0).row, token)) { schedule(token); return; }
      if (restricted()) return;
      const start = performance.now(), duration = companionPreviewDuration(behavior);
      let paintedAt = start - 1000 / 14;
      const tick = (now: number) => {
        raf = null;
        if (!visible() || restricted() || token !== generation) return;
        if (now - start >= duration) {
          // Another discovered packet can evict an unowned idle texture from
          // the shared3-node cache. Reprepare idle without a waiting RAF loop.
          void prepare(0, token).then(ready => {
            if (!visible() || restricted() || token !== generation) return;
            if (ready) paint(null, 0, performance.now());
            schedule(token);
          });
          return;
        }
        const due = nextCompanionPaint(now, paintedAt, 14);
        if (due !== null) { paintedAt = due; paint(behavior, now - start, now); }
        raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    const refresh = async () => {
      cancel(); setQuiet(restricted());
      if (!visible()) { painter.clear(); return; }
      const token = generation;
      if (!await prepare(0, token)) return;
      paint(null, 0, performance.now());
      if (!restricted()) void cycle(token);
    };
    const observer = new MutationObserver(() => { void refresh(); });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-reduce-motion", "data-gfx"] });
    document.addEventListener("visibilitychange", refresh);
    void refresh();
    return () => { disposed = true; cancel(); observer.disconnect(); document.removeEventListener("visibilitychange", refresh); painter.clear(); element.removeAttribute("data-preview-ready"); };
  }, [accessory, behaviorKey, enabled, replay]);
  return <div className="rhh-wardrobe-preview-wrap">
    <div aria-label="빅타민 미리보기" className="rhh-wardrobe-preview" ref={host} role="img">
      <span aria-hidden="true" className="vc-pose" ref={pose}><span className="vc-wearable vc-wearable-back" ref={back} /><span className="vc-sprite" ref={sprite}><canvas height={192} ref={canvas} width={192} /></span><span className="vc-wearable vc-wearable-front" ref={front} /><span className="vc-wearable vc-gift-prop" ref={gift} /></span>
      {!enabled && <span className="rhh-wardrobe-preview-paused">쉬는 중</span>}
    </div>
    <button className="rhh-link" data-act="companion-wardrobe-preview" data-sfx="off" disabled={!enabled || quiet || !chooseCompanionPreviewBehavior(behaviors, null, () => 0)} onClick={() => setReplay(value => value + 1)} type="button">다시 보기</button>
  </div>;
}
