"use client";
import { useEffect, useRef, useState } from "react";
import { COMPANION_EXPRESSIONS, type CompanionExpressionId } from "@/lib/ui/viewer-companion/expressions";
import { createCompanionExpressionPainter, COMPANION_EXPRESSION_REFERENCE_SRC } from "@/lib/ui/viewer-companion/expression-painter";
import { companionSpriteMetadata, decodeCompanionSprite, peekDecodedCompanionSprite, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";

/** Production-compiled renderer proof only. The server gate is404 without
 * VISUAL_TEST_FIXTURE=1; this cannot command the living actor or its brain. */
function Portrait({ id, progress, row }: { id: CompanionExpressionId; progress: number; row: number }) {
  const picture = useRef<HTMLCanvasElement>(null), [result, setResult] = useState<string>();
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const selected = selectCompanionSprite(companionSpriteMetadata.rows[row][0], row, 0);
      await decodeCompanionSprite(selected.src); await decodeCompanionSprite(COMPANION_EXPRESSION_REFERENCE_SRC);
      const image = peekDecodedCompanionSprite(selected.src), canvas = picture.current, overlay = document.createElement("canvas");
      if (cancelled || !canvas || !image) return;
      const face = createCompanionExpressionPainter(overlay), painted = face.paint(selected, { id, progress });
      canvas.width = canvas.height = 320; const ctx = canvas.getContext("2d", { willReadFrequently: true }); if (!ctx) return;
      const cell = image.naturalWidth / selected.grid, x = selected.index % selected.grid * cell, y = Math.floor(selected.index / selected.grid) * cell;
      ctx.drawImage(image, x, y, cell, cell, 0, 0, 320, 320);
      const before = ctx.getImageData(0, 0, 320, 320).data;
      ctx.clearRect(0, 0, 320, 320); ctx.drawImage(overlay, 0, 0, 320, 320);
      const after = ctx.getImageData(0, 0, 320, 320).data; let alphaChanges = 0, changed = 0;
      for (let i = 0; i < before.length; i += 4) { if (before[i + 3] !== after[i + 3]) alphaChanges++; if (before[i] !== after[i] || before[i + 1] !== after[i + 1] || before[i + 2] !== after[i + 2]) changed++; }
      canvas.dataset.alphaChanges = String(alphaChanges); canvas.dataset.changedPixels = String(changed); canvas.dataset.painted = String(painted); canvas.dataset.source = selected.src;
      setResult(painted && !alphaChanges && changed ? "ready" : "failed");
    })();
    return () => { cancelled = true; };
  }, [id, progress, row]);
  return <canvas ref={picture} data-expression={id} data-result={result} style={{ width: 160, height: 160 }} />;
}
export default function ExpressionFixture() {
  const [progress, setProgress] = useState(.55), [row, setRow] = useState(0);
  return <main style={{ padding: 24, background: "#faf5e9", color: "#45392d", minHeight: "100vh", fontFamily: "system-ui" }}>
    <h1>36개 표정 · 동일 원화/눈 크기/몸 외곽</h1>
    <label>표정 진행 <input aria-label="표정 진행" type="range" min=".05" max=".95" step=".05" value={progress} onChange={e => setProgress(Number(e.target.value))} /></label>
    <select aria-label="원화 포즈" value={row} onChange={e => setRow(Number(e.target.value))}><option value="0">기본</option><option value="1">관찰</option><option value="9">행복</option></select>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 12, maxWidth: 1200 }}>
      {COMPANION_EXPRESSIONS.map(([id, label]) => <figure key={id} style={{ margin: 0, display: "grid", justifyItems: "center", padding: 12, border: "1px solid #d9ceb7", borderRadius: 14, background: "#fffdf7" }}><Portrait id={id} progress={progress} row={row} /><figcaption style={{ fontSize: 15 }}>{label}</figcaption></figure>)}
    </div>
  </main>;
}
