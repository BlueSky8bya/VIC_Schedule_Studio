import { describe, expect, it } from "vitest";
import { advanceCompanionPlayPresentation, COMPANION_PLAY_PRESENTATION_WAIT_MS } from "@/lib/ui/viewer-companion/play-presentation";
import { sampleCompanionPlay } from "@/lib/ui/viewer-companion/play";
import { companionPlayDuration } from "@/lib/ui/viewer-companion/timing";

describe("finite authored poses retain their actual visible onset", () => {
  it("does not spend the bow's onset while a cold packet retains the old body", () => {
    const duration = companionPlayDuration("bow");
    let began = 1000, presentation = { started: false, waited: 0 };
    for (const now of [1016, 1066, 1116, 1166, 1216, 1266, 1316]) {
      const result = advanceCompanionPlayPresentation({ now, began, delta: now - began, presentation, usable: false });
      began = result.began; presentation = result.presentation;
      expect(result.expired).toBe(false);
      expect((now - began) / duration).toBe(0);
    }
    const ready = advanceCompanionPlayPresentation({ now: 1350, began, delta: 34, presentation, usable: true });
    expect(ready.presentation).toEqual({ started: true, waited: 350 });
    expect(sampleCompanionPlay("bow", (1350 - ready.began) / duration).phase).toBe(0);
    expect(sampleCompanionPlay("bow", (1490 - ready.began) / duration).phase).toBeCloseTo(.5, 8);
    expect(sampleCompanionPlay("bow", (1630 - ready.began) / duration).phase).toBe(1);
    expect(sampleCompanionPlay("bow", (2409 - ready.began) / duration).row).toBe(29);
    expect(sampleCompanionPlay("bow", (2410 - ready.began) / duration).row).toBe(23);
    expect(advanceCompanionPlayPresentation({ now: 1650, began: ready.began, delta: 300, presentation: ready.presentation, usable: false }))
      .toEqual({ began: 1350, presentation: ready.presentation, expired: false });
  });

  it("bounds a genuinely unavailable first packet without claiming a completed pose", () => {
    let began = 0, presentation = { started: false, waited: 0 };
    for (let now = 100; now <= COMPANION_PLAY_PRESENTATION_WAIT_MS; now += 100) {
      const result = advanceCompanionPlayPresentation({ now, began, delta: 100, presentation, usable: false });
      began = result.began; presentation = result.presentation;
      expect(result.expired).toBe(now === COMPANION_PLAY_PRESENTATION_WAIT_MS);
      expect(presentation.started).toBe(false);
      expect(now - began).toBe(0);
    }
  });

  it("excludes time before launch and paused wall time from the finite packet budget", () => {
    const launched = advanceCompanionPlayPresentation({ now: 1500, began: 1500, delta: 1500, presentation: { started: false, waited: 0 }, usable: false });
    expect(launched).toEqual({ began: 1500, presentation: { started: false, waited: 0 }, expired: false });
    const foreground = advanceCompanionPlayPresentation({ now: 1516, began: launched.began, delta: 16, presentation: launched.presentation, usable: false });
    const paused = advanceCompanionPlayPresentation({ now: 11516, began: foreground.began, delta: 0, presentation: foreground.presentation, usable: false });
    expect(paused.presentation.waited).toBe(16);
    expect(paused.expired).toBe(false);
  });
});
