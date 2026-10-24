import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const hooks = vi.hoisted(() => ({ cells: [] as { value: unknown }[] }));
vi.mock("react", async (original) => ({
  ...await original<typeof import("react")>(),
  useRef: <T,>(current: T) => ({ current }),
  useState: <T,>(initial: T) => {
    const cell = { value: initial as unknown }; hooks.cells.push(cell);
    return [initial, (value: T) => { cell.value = value; }];
  }
}));
vi.mock("@/lib/studio/editor-model", () => ({ postStudioWrite: vi.fn() }));
import { useStudioWriteQueue } from "@/lib/studio/use-write-queue";

// Actual queue, fake hook state sink and clock; no React DOM or server writes.
beforeEach(() => {
  hooks.cells.length = 0;
  vi.useFakeTimers();
  vi.stubGlobal("window", { setTimeout, clearTimeout });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });
const status = () => hooks.cells[0].value;
const success = async () => ({ ok: true as const, id: "synthetic" });
const failure = async () => ({ ok: false as const, error: "synthetic failure" });

describe("serialized studio save batches", () => {
  it("does not invent a save or timestamp for a shortcut without a write", async () => {
    const queue = useStudioWriteQueue({ current: Promise.resolve() });
    expect(status()).toBe("idle");
    expect(hooks.cells[1].value).toBeNull();
    queue.flashSavedChip();
    await vi.runAllTimersAsync();
    expect(status()).toBe("idle");
    expect(hooks.cells[1].value).toBeNull();
    await queue.enqueueWrite(success);
    await vi.runAllTimersAsync();
    const savedAt = hooks.cells[1].value;
    vi.advanceTimersByTime(120000);
    queue.flashSavedChip();
    await vi.runAllTimersAsync();
    expect(status()).toBe("saved");
    expect(hooks.cells[1].value).toBe(savedAt);
  });
  it.each([false, true])("keeps a same-batch failure after later success (throws=%s)", async throws => {
    const queue = useStudioWriteQueue({ current: Promise.resolve() });
    const order: string[] = [];
    const a = queue.enqueueWrite(async () => {
      order.push("A");
      if (throws) throw new Error("synthetic failure");
      return failure();
    }).catch(() => null);
    const b = queue.enqueueWrite(async () => { order.push("B"); return success(); });
    await Promise.all([a, b]);
    await vi.runAllTimersAsync();
    expect(order).toEqual(["A", "B"]);
    expect(status()).toBe("failed");
    expect(queue.inflightWritesRef.current.size).toBe(0);
    queue.flashSavedChip();
    await vi.runAllTimersAsync();
    expect(status()).toBe("failed");
  });
  it("also preserves a failure after a preceding success", async () => {
    const queue = useStudioWriteQueue({ current: Promise.resolve() });
    await Promise.all([queue.enqueueWrite(success), queue.enqueueWrite(failure)]);
    await vi.runAllTimersAsync();
    expect(status()).toBe("failed");
  });
  it("only a new actual write batch can report successful recovery", async () => {
    const queue = useStudioWriteQueue({ current: Promise.resolve() });
    await queue.enqueueWrite(failure);
    await queue.flushPendingWrites();
    await vi.runAllTimersAsync();
    expect(status()).toBe("failed");
    await queue.enqueueWrite(success);
    await vi.runAllTimersAsync();
    expect(status()).toBe("saved");
  });
  it("does not let the previous saved timer cover a newly failing batch", async () => {
    const queue = useStudioWriteQueue({ current: Promise.resolve() });
    await queue.enqueueWrite(success);
    await queue.flushPendingWrites();
    await queue.enqueueWrite(failure);
    await vi.runAllTimersAsync();
    expect(status()).toBe("failed");
  });
});
