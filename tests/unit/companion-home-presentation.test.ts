import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CompanionHome } from "@/components/poster/viewer-companion/companion-home";
import { DEFAULT_COMPANION_CARE } from "@/lib/ui/viewer-companion/care";
import { DEFAULT_COMPANION_PREFERENCES } from "@/lib/ui/viewer-companion/preferences";

// The Node unit harness uses the classic JSX transform; the application build
// supplies the automatic runtime. Keep that harness detail out of the product.
beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

function room(compact: boolean, inactive = false, radioPlaying = false, enabled = true) {
  return renderToStaticMarkup(React.createElement(CompanionHome, {
    care: DEFAULT_COMPANION_CARE,
    preferences: { ...DEFAULT_COMPANION_PREFERENCES, enabled },
    onAction: () => undefined,
    onClose: compact ? () => undefined : undefined,
    inactive, radioPlaying
  }));
}

describe("shared companion room presentation", () => {
  it("has one close control and no disclosure in a launcher-opened room", () => {
    const html = room(true);
    expect(html).toContain('data-home-presentation="compact"');
    expect(html).toContain('aria-label="빅타민 집 닫기"');
    expect(html).not.toContain("data-panel-collapsible");
    expect(html).not.toContain("data-panel-section-toggle");
    expect(html).not.toContain('data-home-action="fold"');
    expect(html).toContain('class="vc-home-room"');
    expect(html).not.toContain('class="panel-section-body" hidden');
  });

  it("retains the shared saved-disclosure mechanism only in the rail", () => {
    const html = room(false);
    expect(html).toContain('data-home-presentation="panel"');
    expect(html).toContain("data-panel-collapsible");
    expect(html).toContain('data-panel-section-toggle="companion-home"');
    expect(html).toContain('data-home-action="fold"');
    expect(html).not.toContain('data-home-action="close"');
  });

  it("keeps overlay input ownership without folding or removing the room", () => {
    const html = room(true, true);
    expect(html).toContain('inert=""');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain('class="vc-home-room"');
    expect(html).not.toContain("data-panel-collapsible");
  });

  it("mounts three decorative notes only for actual playback in an active enabled room", () => {
    for (const compact of [false, true]) {
      expect(room(compact)).not.toContain('class="vc-radio-notes"');
      const playing = room(compact, false, true);
      expect(playing).toContain('class="vc-radio-notes" aria-hidden="true"');
      expect(playing.match(/class="vc-radio-note"/g)).toHaveLength(3);
      expect(playing).toContain('aria-label="라디오 끄기" aria-pressed="true"');
      expect(room(compact, true, true)).not.toContain('class="vc-radio-notes"');
      expect(room(compact, false, true, false)).not.toContain('class="vc-radio-notes"');
    }
  });

  it("makes the toy box a real callback-owned control without changing old home actions", () => {
    const pending = room(true).match(/<button[^>]*data-home-action="toys"[^>]*>/)?.[0];
    expect(pending).toContain('disabled=""');
    const html = renderToStaticMarkup(React.createElement(CompanionHome, {
      care: DEFAULT_COMPANION_CARE, preferences: DEFAULT_COMPANION_PREFERENCES,
      onAction: () => undefined, onToyBox: () => undefined, toyCount: 3,
    }));
    const ready = html.match(/<button[^>]*data-home-action="toys"[^>]*>/)?.[0];
    expect(ready).toContain('data-act="companion-home-toys"');
    expect(ready).toContain('data-toy-count="3"');
    expect(ready).not.toContain("disabled");
    for (const action of ["home", "feed", "clearFood", "radio", "book"]) expect(html).toContain(`data-home-action="${action}"`);
  });

  it("renders the supplied world weather and season without running its own environment", () => {
    const html = renderToStaticMarkup(React.createElement(CompanionHome, {
      care: DEFAULT_COMPANION_CARE, preferences: DEFAULT_COMPANION_PREFERENCES, onAction: () => undefined,
      environment: { date: { y: 2027, m: 1, d: 1 }, season: "winter", hour: 23, band: "night", night: true, weather: "snow" },
    }));
    expect(html).toContain('data-season="winter" data-weather="snow" data-band="night" data-phase="night" data-night="true"');
    expect(html).toContain('/companion/home/123/window-winter-night.webp');
    expect(html).toContain('/companion/home/122/window-snow-overlay.webp');
    expect(html).not.toContain('/companion/home/122/window-rain-overlay.webp');
    expect(html).not.toContain('class="vc-window-sun"');
    expect(html).toContain('class="vc-home-cushion"');
  });
});
