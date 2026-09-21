import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DeveloperPanel } from "@/components/developer/developer-panel";
import { detectDevice } from "@/lib/presence/presence-client";

describe("retired public realtime presence", () => {
  it("renders unavailable status instead of fabricated zero counts or connecting status", () => {
    const html = renderToStaticMarkup(React.createElement(DeveloperPanel));
    expect(html).toContain('role="status"');
    expect(html).toContain("제공을 중단");
    expect(html).toContain("기간별 기록");
    expect(html).not.toMatch(/dp-count|dp-live-tile|subscribePresence|>0</);
  });
  it("retains local device classification without starting a connection", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone)" });
    try { expect(detectDevice()).toBe("ios"); }
    finally { vi.unstubAllGlobals(); }
  });
});
