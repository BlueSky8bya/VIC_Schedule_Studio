import { describe, expect, it, vi } from "vitest";
import { readScheduleEventPages } from "@/lib/schedules/read-event-pages";

describe("schedule event page completeness", () => {
  it("reads a terminal empty page for exactly1000 rows", async () => {
    const first = Array.from({ length: 1000 }, (_, id) => ({ id: String(id) }));
    const read = vi.fn(async (from: number) => ({ data: from === 0 ? first : [], error: null }));
    expect(await readScheduleEventPages(read)).toEqual(first); expect(read).toHaveBeenCalledTimes(2);
  });
  it("rejects duplicate rows caused by an offset shift instead of accepting a partial cache value", async () => {
    const first = Array.from({ length: 1000 }, (_, id) => ({ id: String(id) }));
    await expect(readScheduleEventPages(async from => ({ data: from === 0 ? first : [{ id: "999" }], error: null }))).rejects.toThrow("changed during read");
  });
  it("does not treat null data without an error as verified empty rows", async () => {
    await expect(readScheduleEventPages(async () => ({ data: null, error: null }))).rejects.toThrow("unavailable");
  });
});
