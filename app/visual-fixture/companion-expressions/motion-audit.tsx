"use client";
import { useEffect, useRef, useState } from "react";
import { COMPANION_EXPRESSIONS, COMPANION_EXPRESSION_MS, sampleCompanionExpression } from "@/lib/ui/viewer-companion/expressions";
import { createCompanionExpressionPainter, COMPANION_EXPRESSION_REFERENCE_SRC } from "@/lib/ui/viewer-companion/expression-painter";
import { companionSpriteMetadata, decodeCompanionSprite, peekDecodedCompanionSprite, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";

/** A finite real-clock player of the production painter, never a command or
 * receipt in the living actor. The enclosing server route is fixture-gated. */
export function ExpressionMotionAudit({ row }: { row: number }) {
  const picture = useRef<HTMLCanvasElement>(null), [proof, setProof] = useState("");
  useEffect(() => {
    let cancelled = false, raf = 0;
    void (async () => {
      const cells = companionSpriteMetadata.rows[row].map(index => selectCompanionSprite(index));
      for (const src of new Set([COMPANION_EXPRESSION_REFERENCE_SRC, ...cells.map(c => c.src)])) await decodeCompanionSprite(src);
      if (cancelled || !picture.current) return;
      const canvas = picture.current; canvas.width = 960; canvas.height = 960;
      const ctx = canvas.getContext("2d")!, entries = COMPANION_EXPRESSIONS.map(([id]) => {
        const face = document.createElement("canvas"); return { id, face, painter: createCompanionExpressionPainter(face) };
      });
      const frames: { elapsed: number; progress: number; pose: number; drawn: number; closure: number[] }[] = [];
      let started = 0;
      const tick = (now: number) => {
        if (cancelled) return; if (!started) started = now;
        const elapsed = now - started, progress = Math.min(.999, Math.max(.001, elapsed / COMPANION_EXPRESSION_MS));
        const selected = cells[Math.min(cells.length - 1, Math.floor(elapsed / COMPANION_EXPRESSION_MS * cells.length))];
        const image = peekDecodedCompanionSprite(selected.src)!, cell = image.naturalWidth / selected.grid;
        ctx.clearRect(0, 0, 960, 960); let drawn = 0;
        entries.forEach(({ id, face, painter }, i) => {
          const x = i % 6 * 160, y = Math.floor(i / 6) * 160;
          if (painter.paint(selected, { id, progress })) { ctx.drawImage(face, x, y, 160, 160); drawn++; }
          else ctx.drawImage(image, selected.index % selected.grid * cell, Math.floor(selected.index / selected.grid) * cell, cell, cell, x, y, 160, 160);
        });
        frames.push({ elapsed, progress, pose: selected.physicalIndex, drawn, closure: ["awake", "giggle", "relief"].map(id => {
          const f = sampleCompanionExpression(id as "awake" | "giggle" | "relief", progress); return f.leftClosure * f.weight;
        }) });
        if (elapsed < COMPANION_EXPRESSION_MS) raf = requestAnimationFrame(tick);
        else setProof(JSON.stringify({ row, frames, scope: "Real-clock source-cell transitions in production-compiled painter; no living-action trigger claim" }));
      };
      raf = requestAnimationFrame(tick);
    })();
    return () => { cancelled = true; cancelAnimationFrame(raf); };
  }, [row]);
  return <section><canvas ref={picture} data-motion-canvas style={{ width: 960, maxWidth: "100%" }} /><output data-motion-proof={Boolean(proof) || undefined} style={{ display: "none" }}>{proof}</output></section>;
}
