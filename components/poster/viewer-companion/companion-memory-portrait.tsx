"use client";
import { useEffect, useRef } from "react";
import type { CompanionExpressionId } from "@/lib/ui/viewer-companion/expressions";
import { COMPANION_EXPRESSION_REFERENCE_SRC, createCompanionExpressionPainter } from "@/lib/ui/viewer-companion/expression-painter";
import { companionSpriteMetadata, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import { COMPANION_PORTRAIT_READY_EVENT } from "@/lib/ui/viewer-companion/memory-catalog";

const selected = selectCompanionSprite(companionSpriteMetadata.rows[0][0], 0, 0);
// Two fixed source packets only. These read-only images never acquire or
// evict a connected live actor's decoded node, including wardrobe previews.
const portraitSources = new Set([selected.src, COMPANION_EXPRESSION_REFERENCE_SRC]);
const images = new Map<string, HTMLImageElement>(), pending = new Map<string, Promise<void>>();
function prepare(src: string) {
  if (!portraitSources.has(src) || images.has(src)) return Promise.resolve();
  const existing = pending.get(src); if (existing) return existing;
  const image = new Image(); image.src = src;
  const ready = image.decode().then(() => { images.set(src, image); }).finally(() => { pending.delete(src); });
  pending.set(src, ready); return ready;
}

/** One static portrait from the exact live painter, not another animation.
 * Read-only source pixels, two fixed source packets, no discovery writes. */
export function CompanionMemoryPortrait({ id, className }: { id: CompanionExpressionId; className?: string }) {
  const picture = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      let ready = false;
      try { await Promise.all([...portraitSources].map(prepare)); ready = true; } catch { /* A failed source stays an unpainted portrait. */ }
      if (cancelled || !picture.current) return;
      const painted = ready && createCompanionExpressionPainter(picture.current, src => images.get(src)).paint(selected, { id, progress: .55 });
      picture.current.dataset.portraitReady = String(painted);
      picture.current.dispatchEvent(new Event(COMPANION_PORTRAIT_READY_EVENT));
    })();
    return () => { cancelled = true; };
  }, [id]);
  return <canvas ref={picture} aria-hidden="true" className={["vc-collection-art", className].filter(Boolean).join(" ")} data-collection-art="behavior-stamp" data-collection-art-id={`expression:${id}`} />;
}
