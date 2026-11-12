import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { insightTabRows, insightTabStep } from "@/components/shared/insights-tabs";

describe("archived insights tab layout", () => {
  it("keeps the default rows for the live modal", () => {
    expect(insightTabRows(5)).toEqual([3, 2]);
    expect(insightTabStep(0, "ArrowDown", 5)).toBe(3);
  });

  it("moves through the 1 + 3 archive rows", () => {
    const rows = [1, 3];
    expect(insightTabStep(0, "ArrowDown", 4, rows)).toBe(2);
    expect(insightTabStep(1, "ArrowUp", 4, rows)).toBe(0);
    expect(insightTabStep(3, "ArrowUp", 4, rows)).toBe(0);
    expect(insightTabStep(1, "ArrowRight", 4, rows)).toBe(2);
    expect(insightTabStep(3, "End", 4, rows)).toBe(3);
  });

  it("drops the live panel only in the archive and lets settings scroll past it", () => {
    const dash = readFileSync("components/developer/insights-dashboard.tsx", "utf8");
    expect(dash).toContain('PANELS.filter((p) => p.key !== "live")');
    expect(dash).toContain("{archived ? null : (");
    const css = readFileSync("components/shared/settings-modal.css", "utf8");
    expect(css).toContain(".vic-settings .rhh-archive-view .insights-panel { overscroll-behavior: auto; }");
  });
});
