import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildDayVodWatchUrl, DayVodWindow, type DayVod } from "@/components/poster/day-vod-window";

const chapters = vi.hoisted(() => ({ onJump: undefined as undefined | ((sec: number) => void) }));
vi.mock("@/components/poster/vod-chapters", () => ({ VodChapters: (props: { onJump: (sec: number) => void }) => {
  chapters.onJump = props.onJump;
  return null;
} }));
vi.mock("@/lib/activity/client", () => ({ logActivity: vi.fn() }));
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

const vods: DayVod[] = [
  { titleNo: 900000001, title: "Public synthetic replay", durationMs: 120000 },
  { titleNo: 900000002, title: "Subscriber synthetic upload", durationMs: 120000, access: "sub" },
  { titleNo: 900000003, title: "Subscriber synthetic replay", durationMs: 120000, access: "plus" }
];
function render(initialPart: number, initialSec?: number) {
  return renderToStaticMarkup(React.createElement(DayVodWindow, {
    dateKey: "2026-06-18", slug: "vic", side: "right", variant: "page", vods,
    initialPart, initialSec, onClose: () => {}
  }));
}
function subscriberLink(html: string) {
  return /class="dvm-locked-go"[^>]*href="([^"]+)"/.exec(html)?.[1];
}

describe("subscriber replay search and URL entry", () => {
  it.each([2, 3])("retains the requested chapter second in the visible SOOP action for part %s", part => {
    const html = render(part, 88.9);
    expect(subscriberLink(html)).toBe(`https://vod.sooplive.co.kr/player/${vods[part - 1].titleNo}?change_second=88`);
    expect(html).not.toContain("<iframe");
  });
  it("uses the existing duration guard for an out-of-range chapter", () => {
    expect(subscriberLink(render(2, 999))).toContain("?change_second=115");
  });
  it.each([undefined, 0, -3, Number.NaN, Number.POSITIVE_INFINITY])("keeps an unusable initial second %s out of the external URL", sec => {
    expect(subscriberLink(render(2, sec))).toBe("https://vod.sooplive.co.kr/player/900000002");
  });
  it("preserves the public embed and does not attach another part's initial second to its link", () => {
    const html = render(1, 88);
    expect(html).toContain('src="https://vod.sooplive.co.kr/player/900000001/embed?fromApi=1"');
    expect(subscriberLink(html)).toBeUndefined();
  });
  it.each([2, 3])("opens an explicit chapter from part %s at its guarded second without boot timers", part => {
    const open = vi.fn(), setTimeout = vi.fn();
    vi.stubGlobal("window", { open, setTimeout });
    render(part, 88);
    expect(open).not.toHaveBeenCalled();
    chapters.onJump!(999);
    expect(open).toHaveBeenCalledExactlyOnceWith(`https://vod.sooplive.co.kr/player/${vods[part - 1].titleNo}?change_second=115`, "_blank", "noopener,noreferrer");
    expect(setTimeout).not.toHaveBeenCalled();
  });
  it("keeps early chapter seconds and rejects non-finite URL offsets", () => {
    expect(buildDayVodWatchUrl(42, 1.9)).toBe("https://vod.sooplive.co.kr/player/42?change_second=1");
    for (const sec of [Number.NaN, Number.POSITIVE_INFINITY, -1]) {
      expect(buildDayVodWatchUrl(42, sec)).toBe("https://vod.sooplive.co.kr/player/42");
    }
  });
});
