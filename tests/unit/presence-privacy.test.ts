import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DeveloperPanel } from "@/components/developer/developer-panel";
import { detectDevice } from "@/lib/presence/presence-client";

describe("private aggregate presence", () => {
  it("renders loading rather than fabricated zero counts and explains session semantics", () => {
    const html = renderToStaticMarkup(React.createElement(DeveloperPanel));
    expect(html).toContain('role="status"');
    expect(html).toContain("불러오는 중");
    expect(html).toContain("숨겨진 탭은 집계하지 않습니다");
    expect(html).not.toMatch(/subscribePresence|>0</);
  });
  it("retains local device classification without starting a connection", () => {
    vi.stubGlobal("navigator", { userAgent: "Mozilla/5.0 (iPhone)" });
    try { expect(detectDevice()).toBe("ios"); }
    finally { vi.unstubAllGlobals(); }
  });
});
