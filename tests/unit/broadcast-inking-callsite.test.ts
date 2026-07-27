import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");
const panelSource = readFileSync(
  join(repoRoot, "components/studio/broadcast-panel.tsx"),
  "utf8"
);

function between(start: string, end: string) {
  const startIndex = panelSource.indexOf(start);
  const endIndex = panelSource.indexOf(end, startIndex + start.length);
  expect(startIndex, `missing ${start}`).toBeGreaterThanOrEqual(0);
  expect(endIndex, `missing ${end}`).toBeGreaterThan(startIndex);
  return panelSource.slice(startIndex, endIndex);
}

describe("broadcast inking callsite contracts", () => {
  it("lets pen contact preempt a live touch stroke before starting pen capture", () => {
    const pointerDown = between(
      "function onDrawDown",
      "function onDrawMove"
    );

    const preemption = pointerDown.indexOf(
      'penContact && activePointerTypeRef.current === "touch"'
    );
    const discard = pointerDown.indexOf("discardLiveStroke()", preemption);
    const capture = pointerDown.indexOf(
      "e.currentTarget.setPointerCapture(e.pointerId)"
    );

    expect(preemption).toBeGreaterThanOrEqual(0);
    expect(discard).toBeGreaterThan(preemption);
    expect(capture).toBeGreaterThan(discard);
    expect(pointerDown).toContain("shouldIgnoreTouchAfterPen(");
    expect(pointerDown).toContain(
      'e.pointerType === "pen" ? mapPenPressure(e.pressure) : 0.8'
    );
  });

  it("keeps predicted points ephemeral and separate from committed stroke storage", () => {
    const flushDraw = between("const flushDraw", "const scheduleFlush");
    const finishLiveStroke = between(
      "const finishLiveStroke",
      "const flushDraw"
    );
    const pointerMove = between("function onDrawMove", "function endDraw");

    expect(panelSource).toContain(
      "const predictionCanvasRef = useRef<HTMLCanvasElement | null>(null)"
    );
    expect(panelSource).toMatch(/ref=\{predictionCanvasRef\}/);
    expect(flushDraw).toContain("clearCanvas(predictionCanvasRef.current)");
    expect(flushDraw).toContain("drawPenPrediction(previewCtx, live, predicted)");
    expect(pointerMove.match(/native\.getPredictedEvents\(\)/g)).toHaveLength(1);
    expect(pointerMove).not.toContain("store.push");
    expect(finishLiveStroke).toContain("store.push(live)");
    expect(finishLiveStroke).not.toContain("store.push(predicted");
  });

  it("discards cancelled input while pointerup remains the only event that commits it", () => {
    const endDraw = between("function endDraw", "function cancelDraw");
    const cancelDraw = between("function cancelDraw", "const doUndo");
    const drawSurface = between('className="bp-draw-surface"', "marquee ?");

    expect(endDraw).toContain('activePointerTypeRef.current === "pen"');
    expect(endDraw).toContain("lastPenContactTsRef.current = e.timeStamp");
    expect(cancelDraw).toContain("discardLiveStroke()");
    expect(cancelDraw).not.toContain("finishLiveStroke()");
    expect(drawSurface).toContain("onPointerUp={endDraw}");
    expect(drawSurface).toContain("onPointerCancel={cancelDraw}");
    expect(drawSurface).toContain("onLostPointerCapture={cancelDraw}");
  });

  it("consumes coalesced samples once and falls back to the parent event", () => {
    const pointerMove = between("function onDrawMove", "function endDraw");

    expect(pointerMove.match(/native\.getCoalescedEvents\(\)/g)).toHaveLength(1);
    expect(pointerMove).toContain(
      "const samples = coalesced.length > 0 ? coalesced : [native]"
    );
  });

  it("refreshes today at KST midnight and exposes current-date semantics", () => {
    const todayRefresh = between(
      "const [todayIso",
      "const activeInkStyle"
    );

    expect(todayRefresh).toContain("now + KST_OFFSET_MS");
    expect(todayRefresh).toContain("- KST_OFFSET_MS");
    expect(todayRefresh).toContain("setTodayIso(getTodayKst())");
    expect(todayRefresh).toContain("armKstMidnight()");
    expect(panelSource).toContain(
      'aria-current={isToday ? "date" : undefined}'
    );
    expect(panelSource).toContain('${isToday ? ", 오늘" : ""}');
  });

  it("enters schedule arrange mode only through the first non-duplicate direct send", () => {
    const handleSend = between("function handleSend", "function removeDay");

    expect(handleSend).toContain(
      "const newKeys = selectedKeys.filter((key) => !beforeSet.has(key))"
    );
    expect(handleSend).toContain("if (newKeys.length === 0) return");
    expect(handleSend).toContain(
      "shouldEnterScheduleArrangeMode("
    );
    expect(handleSend).toContain("hasSentOnceRef.current");
    expect(handleSend).toContain("hasSentOnceRef.current = true");
    expect(handleSend).toContain("setBgVis(true)");
    expect(handleSend).toContain("setActiveLayerId(BG_LAYER_ID)");
    expect(handleSend).toContain('setTool("select")');
    expect(handleSend).toContain("onSend(newKeys)");
  });

  it("routes drawing tools and committed colors through writable-layer workflow", () => {
    expect(panelSource.match(/activateDrawingTool\(key\)/g)).toHaveLength(2);
    expect(panelSource).toContain("applyInkColor(c)");
    expect(panelSource).toContain("onChange={applyInkColor}");
    expect(panelSource).toContain("toolAfterEmptyLayerAdded(tool)");
    expect(panelSource).toContain(
      "activateDrawingTool(toolAfterInkWidthPick(tool))"
    );
    expect(panelSource.match(/resolveDrawingLayerAfterRemoval\(/g)).toHaveLength(3);
  });

  it("opens custom color without changing context and restores preview context on cancel", () => {
    const customColorTrigger = between(
      'className={`bp-color bp-color-custom',
      "</button>"
    );

    expect(customColorTrigger).toContain("openedWithTool: tool");
    expect(customColorTrigger).toContain("openedWithLayerId: activeLayerId");
    expect(customColorTrigger).toContain("restoreColorPickerContext(colorPop)");
    expect(customColorTrigger).not.toContain("setTool(");
    expect(panelSource).toContain(
      "onCancel={() => restoreColorPickerContext(colorPop)}"
    );
  });
});
