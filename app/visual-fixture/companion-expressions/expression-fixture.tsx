"use client";
import { useEffect, useRef, useState } from "react";
import { COMPANION_EXPRESSIONS, type CompanionExpressionId } from "@/lib/ui/viewer-companion/expressions";
import { createCompanionExpressionPainter, COMPANION_EXPRESSION_REFERENCE_INDEX, COMPANION_EXPRESSION_REFERENCE_SRC } from "@/lib/ui/viewer-companion/expression-painter";
import { companionSpriteMetadata, decodeCompanionSprite, peekDecodedCompanionSprite, selectCompanionSprite } from "@/lib/ui/viewer-companion/sprite-quality";
import anchors from "@/lib/ui/viewer-companion/expression-anchors-161.json";
import overrides from "@/lib/ui/viewer-companion/expression-pose-overrides.json";
import { companionAppearanceBounds, companionAppearanceEyes, companionAppearanceFrames, companionAppearancePoint } from "@/lib/ui/viewer-companion/appearance";
import { companionFaceLayout } from "@/lib/ui/viewer-companion/face-layout";
import { ExpressionMotionAudit } from "./motion-audit";

// The current face layout (68b46f11): the painter reads every anchor through the appearance material correction,
// and an authored cell's canonical mouth sits where companionFaceLayout puts it, not at the raw October anchor.
const currentFaces = new Map([...anchors.frames, ...overrides.frames].map(a => [a.physicalIndex, {
  eyes: companionAppearanceEyes(a.physicalIndex, a.eyes),
  mouth: a.mouth ? { ...companionAppearancePoint(a.physicalIndex, a.mouth), bounds: companionAppearanceBounds(a.physicalIndex, a.mouth.bounds) } : null, orientation: a.orientation }]));
// Owner 2026-11-18: every eye is drawn at the running reference drawing's size, so the eye region is at least that
// shared eye (plus the painter's 1 unit lid room and .65 fringe, and half a unit for pixel rounding) around the centre.
const referenceEyes = anchors.frames.find(a => a.physicalIndex === COMPANION_EXPRESSION_REFERENCE_INDEX)!.eyes;
const sharedEyeWidth = Math.max(...referenceEyes.map(e => e.bounds[2] - e.bounds[0])), sharedEyeHeight = Math.max(...referenceEyes.map(e => e.bounds[3] - e.bounds[1]));

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
  const [motion, setMotion] = useState(false);
  const [audit, setAudit] = useState(""), [auditing, setAuditing] = useState(false);
  async function auditAnchors() {
    setAuditing(true);
    const canvas = document.createElement("canvas"), source = document.createElement("canvas"); source.width = source.height = 192;
    const ctx = source.getContext("2d", { willReadFrequently: true })!, painter = createCompanionExpressionPainter(canvas), results = [];
    for (const pose of anchors.frames) {
      const selected = selectCompanionSprite(pose.physicalIndex); await decodeCompanionSprite(selected.src); await decodeCompanionSprite(COMPANION_EXPRESSION_REFERENCE_SRC);
      const image = peekDecodedCompanionSprite(selected.src)!; const cell = image.naturalWidth / selected.grid;
      ctx.clearRect(0, 0, 192, 192); ctx.drawImage(image, selected.index % selected.grid * cell, Math.floor(selected.index / selected.grid) * cell, cell, cell, 0, 0, 192, 192);
      const before = ctx.getImageData(0, 0, 192, 192).data;
      let first: Uint8ClampedArray | undefined;
      for (const id of ["sour", "greeting"] as const) {
        const painted = painter.paint(selected, { id, progress: .55 }), after = canvas.getContext("2d")!.getImageData(0, 0, 192, 192).data;
        let alpha = 0, cheek = 0, outside = 0, changed = 0; const outsideAt: number[][] = [];
        // A deliberately broader independent face region; all body/ears and
        // source orange cheeks must stay byte-identical, including alpha253.
        // A closed native eye has tiny bounds. Its canonical open-eye box
        // still belongs to the face, so measure from calibrated centres too.
        // Measured from the current face layout: material-corrected eyes, and a mouth region that covers both the
        // source mouth bounds and the mouth's current position (companionFaceLayout for an authored cell).
        const face = currentFaces.get(pose.physicalIndex)!, layout = companionFaceLayout(face);
        const authored = Boolean(companionAppearanceFrames.get(pose.physicalIndex)?.eyeState);
        const mouth = face.mouth ? { x: authored ? layout.mouthX : face.mouth.x, y: authored ? layout.mouthY : face.mouth.y, bounds: face.mouth.bounds } : null;
        const boxes = [...face.eyes.map((e, i) => {
            const view = face.orientation === "quarter" ? (referenceEyes[i].bounds[2] - referenceEyes[i].bounds[0]) / sharedEyeWidth : 1;
            const halfX = Math.max(4.5, Math.max(referenceEyes[i].bounds[2] - referenceEyes[i].bounds[0], sharedEyeWidth) * view / 2 + 1 + .65 + .5);
            const up = Math.max(5.5, sharedEyeHeight / 2 + 1.6 + .65 + .5), down = Math.max(5.5, sharedEyeHeight / 2 + 1.2 + .65 + .5);
            return [Math.min(e.bounds[0] - 2, e.center[0] - halfX), Math.min(e.bounds[1] - 3, e.center[1] - up), Math.max(e.bounds[2] + 2, e.center[0] + halfX), Math.max(e.bounds[3] + 3, e.center[1] + down)];
          }),
          ...(mouth ? [[Math.min(mouth.bounds[0] - 2, mouth.x - 6), Math.min(mouth.bounds[1] - 2, mouth.y - 4), Math.max(mouth.bounds[2] + 2, mouth.x + 6), Math.max(mouth.bounds[3] + 2, mouth.y + 5)]] : [])];
        // The source's red mouth interior is orange by RGB but belongs to the mouth it is replacing (the painter's
        // source-mouth region). Every other orange source pixel is a cheek and must stay byte-identical.
        const sourceMouth = (x: number, y: number) => Boolean(mouth && (authored
          ? x >= mouth.x - 3.4 && x <= mouth.x + 3.4 && y >= mouth.y - 2 && y <= mouth.y + 3.6
          : x >= mouth.bounds[0] - .6 && x <= mouth.bounds[2] + .6 && y >= mouth.bounds[1] - .6 && y <= mouth.bounds[3] + .6));
        for (let i = 0; i < before.length; i += 4) {
          if (before[i + 3] !== after[i + 3]) alpha++;
          if (before[i] === after[i] && before[i + 1] === after[i + 1] && before[i + 2] === after[i + 2]) continue;
          changed++; const x = i / 4 % 192 / 2.4, y = Math.floor(i / 4 / 192) / 2.4;
          if (!boxes.some(([l, t, r, b]) => x >= l && x <= r && y >= t && y <= b)) { outside++; if (outsideAt.length < 6) outsideAt.push([+x.toFixed(2), +y.toFixed(2)]); }
          if (before[i] > 210 && before[i + 1] < 190 && before[i + 2] < 135 && !sourceMouth(x, y)) cheek++;
        }
        let contrastPixels = 0;
        if (first) { for (let i = 0; i < after.length; i += 4) if (Math.abs(first[i] - after[i]) + Math.abs(first[i + 1] - after[i + 1]) + Math.abs(first[i + 2] - after[i + 2]) > 45) contrastPixels++; }
        else first = after.slice();
        results.push({ physicalIndex: pose.physicalIndex, id, painted, alpha, cheek, outside, changed, ...(outside ? { outsideAt, boxes } : {}), ...(id === "greeting" ? { contrastPixels } : {}) });
      }
    }
    setAudit(JSON.stringify({ registeredFrames: companionSpriteMetadata.frames.length, eligibleFrames: anchors.frames.length, results })); setAuditing(false);
  }
  return <main style={{ padding: 24, background: "#faf5e9", color: "#45392d", minHeight: "100vh", fontFamily: "system-ui" }}>
    <h1>36개 표정 · 동일 원화/눈 크기/몸 외곽</h1>
    <label>표정 진행 <input aria-label="표정 진행" type="range" min=".05" max=".95" step=".05" value={progress} onChange={e => setProgress(Number(e.target.value))} /></label>
    <select aria-label="원화 포즈" value={row} onChange={e => setRow(Number(e.target.value))}><option value="0">기본</option><option value="1">관찰</option><option value="9">행복</option></select>
    <button onClick={() => void auditAnchors()} disabled={auditing} type="button">전체 얼굴 위치 검사</button><output data-anchor-audit={Boolean(audit) || undefined} style={{ display: "none" }}>{audit}</output>
    <button onClick={() => setMotion(v => !v)} type="button">연속 프레임 재생</button>
    {motion && <ExpressionMotionAudit key={row} row={row} />}
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, minmax(0,1fr))", gap: 12, maxWidth: 1200 }}>
      {COMPANION_EXPRESSIONS.map(([id, label]) => <figure key={id} style={{ margin: 0, display: "grid", justifyItems: "center", padding: 12, border: "1px solid #d9ceb7", borderRadius: 14, background: "#fffdf7" }}><Portrait id={id} progress={progress} row={row} /><figcaption style={{ fontSize: 15 }}>{label}</figcaption></figure>)}
    </div>
  </main>;
}
