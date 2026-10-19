import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { existsSync, readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanionHome } from "@/components/poster/viewer-companion/companion-home";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";
import { companionHomeTvControl, type CompanionHomeTvState } from "@/lib/ui/viewer-companion/home-room-media";

beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

describe("135 room decoration and manual state", () => {
  it("makes one finite OFF, five-channel, OFF circuit with pre-click activity options", () => {
    let state: CompanionHomeTvState = "off";
    const seen: CompanionHomeTvState[] = [state], options: string[] = [];
    for (let step = 0; step < 6; step++) {
      const control = companionHomeTvControl(state);
      options.push(control.option); state = control.next; seen.push(state);
    }
    expect(seen).toEqual(["off", "nature", "music", "cooking", "toys", "moon", "off"]);
    expect(options).toEqual(["on", "next", "next", "next", "next", "off"]);
  });

  it("names the current picture and the next click without making music playback", () => {
    expect(companionHomeTvControl("off").label).toBe("TV 꺼짐 · 누르면 자연 채널 켜기");
    expect(companionHomeTvControl("nature").label).toBe("TV 자연 · 누르면 음악 채널");
    expect(companionHomeTvControl("moon").label).toBe("TV 달과 별 · 누르면 끄기");
    for (const value of ["off", "nature", "music", "cooking", "toys", "moon"] as const)
      expect(["on", "next", "off"]).toContain(companionHomeTvControl(value).option);
  });

  it("starts both manual appliances OFF and preserves every established real home control", () => {
    const html = renderToStaticMarkup(React.createElement(CompanionHome, {
      care: DEFAULT_COMPANION_CARE, preferences: DEFAULT_COMPANION_PREFERENCES,
      onAction: () => undefined, onToyBox: () => undefined,
    }));
    for (const action of ["home", "feed", "clearFood", "radio", "book", "toys", "light", "tv"])
      expect(html).toContain(`data-home-action="${action}"`);
    expect(html).toContain('data-tv="off"');
    expect(html).not.toContain("data-lamp-lit=");
    expect(html.match(/data-home-decoration-control=""/g)).toHaveLength(2);
    expect(html).toContain('data-act="companion-home-tv" data-act-opt="on"');
    expect(html).toContain('data-act="companion-home-light" data-act-opt="on"');
    expect(html).toContain('class="vc-home-cushion"');
    expect(html).toContain('class="vc-dispenser-slot"');
    expect(html).toContain('class="vc-toy-box-opening"');
    expect(html).not.toContain("<audio"); expect(html).not.toContain("<iframe");
  });

  it("keeps manual appliances inside the same inactive ownership boundary", () => {
    const html = renderToStaticMarkup(React.createElement(CompanionHome, {
      care: DEFAULT_COMPANION_CARE, preferences: DEFAULT_COMPANION_PREFERENCES,
      onAction: () => undefined, inactive: true,
    }));
    expect(html).toContain('inert=""'); expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('data-tv="off"');
    expect(html).toContain('data-home-decoration-control=""');
  });

  it("references bounded local pictures and uses one body across screen changes", () => {
    for (const asset of ["room-wall", "room-baseboard", "room-floor", "tv-body", "lamp-body", "wash-pad-135", "tv-screen-nature", "tv-screen-music", "tv-screen-cooking", "tv-screen-toys", "tv-screen-moon"])
      expect(existsSync(`public/companion/home/135/${asset}.webp`), asset).toBe(true);
    const source = readFileSync("components/poster/viewer-companion/companion-home.tsx", "utf8");
    expect(source.match(/135\/tv-body\.webp/g)).toHaveLength(1);
    expect(source).toContain("tv-screen-${tv}.webp");
    expect(source).not.toMatch(/setInterval|requestAnimationFrame|new Date\(|fetch\(/);
  });
});
