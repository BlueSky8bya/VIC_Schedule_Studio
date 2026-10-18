import { describe, expect, it, vi } from "vitest";
import { createCompanionInputFrame } from "@/lib/ui/viewer-companion/input-frame";

function clock() {
  let serial = 0; const frames = new Map<number, FrameRequestCallback>();
  const request = vi.fn((callback: FrameRequestCallback) => { const id = serial++; frames.set(id, callback); return id; });
  const cancel = vi.fn((id: number) => { frames.delete(id); });
  const step = () => { const due = [...frames.values()]; frames.clear(); due.forEach(callback => callback(100)); };
  return { frames, request, cancel, step };
}
describe("shared food/toy native input display batch", () => {
  it("paints only the latest native point once in the next frame, including a zero frame id", () => {
    const host = clock(), input = createCompanionInputFrame(host.request, host.cancel), paint = vi.fn();
    for (let x = 0; x < 100; x++) input.queue(() => paint({ x, y: 250 }));
    expect(host.request).toHaveBeenCalledTimes(1); expect(paint).not.toHaveBeenCalled(); host.step();
    expect(paint.mock.calls).toEqual([[{ x: 99, y: 250 }]]); expect(host.frames.size).toBe(0);
  });
  it("flushes a final release before the display frame and leaves no stale second paint", () => {
    const host = clock(), input = createCompanionInputFrame(host.request, host.cancel), paint = vi.fn();
    input.queue(() => paint("older move")); input.queue(() => paint("final release")); input.flush();
    expect(paint.mock.calls).toEqual([["final release"]]); expect(host.cancel).toHaveBeenCalledWith(0);
    host.step(); input.flush(); expect(paint).toHaveBeenCalledTimes(1); expect(host.frames.size).toBe(0);
  });
  it("cancels hidden/lost ownership without painting it on a later resumed frame", () => {
    const host = clock(), input = createCompanionInputFrame(host.request, host.cancel), paint = vi.fn();
    input.queue(() => paint("held before pause")); input.cancel(); host.step(); input.flush(); expect(paint).not.toHaveBeenCalled();
    input.queue(() => paint("new native input after resume")); host.step(); expect(paint.mock.calls).toEqual([["new native input after resume"]]);
  });
  it("preserves a newly queued frame from a callback while consuming the old batch", () => {
    const host = clock(), input = createCompanionInputFrame(host.request, host.cancel), paint = vi.fn();
    input.queue(() => { paint("first"); input.queue(() => paint("next")); }); input.flush();
    expect(host.frames.size).toBe(1); host.step(); expect(paint.mock.calls).toEqual([["first"], ["next"]]);
  });
});
