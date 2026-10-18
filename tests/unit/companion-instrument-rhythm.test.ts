import { describe, expect, it } from "vitest";
import { companionInstrumentPulse, type CompanionInstrumentPulse } from "@/lib/ui/viewer-companion/instrument-music";
import { companionInstrumentScorePosition } from "@/lib/ui/viewer-companion/instrument-score";
import { COMPANION_INSTRUMENT_SCORES } from "@/lib/ui/viewer-companion/instrument-score-data";
import { createCompanionInstrumentInbox } from "@/lib/ui/viewer-companion/instrument-reaction";

function pulse(index: number, tapAt: number, options: { title?: string; sequence?: number; queue?: number; latency?: number } = {}): CompanionInstrumentPulse {
  const value = companionInstrumentPulse(options.title ?? "자크 형제", tapAt, 500, { sequence: options.sequence ?? 1, index });
  return { ...value, at: tapAt + (options.queue ?? 0), ...(value.rhythm ? { rhythm: { ...value.rhythm, audibleAt: tapAt + (options.queue ?? 0) + (options.latency ?? 25) } } : {}) };
}
function offer(times: number[], options: Parameters<typeof pulse>[2] = {}) {
  const inbox = createCompanionInstrumentInbox();
  times.forEach((at, index) => { const value = pulse(index, at, options); inbox.offer(value, value.at, true); });
  return inbox.take(times.at(-1)! + (options.queue ?? 0));
}

describe("actual notation phase, rests and tempo", () => {
  it("anchors to an arbitrary first tap and admits small human timing errors at the score tempo", () => {
    expect(offer([5000, 5515, 5988, 6510])?.quality).toBe("steady");
  });
  it.each([150, 250, 1000])("rejects mechanically regular %ims clicks against a500ms quarter score", gap => {
    expect(offer([100, 100 + gap, 100 + gap * 2, 100 + gap * 3])?.quality).toBe("uneven");
  });
  it("accepts the actual dotted-short birthday pickup instead of calling its unequal gaps irregular", () => {
    // Existing authored BIRTHDAY_NOTES: .75,.25,1,1,1 quarter beats at270ms.
    expect(offer([1000, 1202.5, 1270, 1540, 1810, 2080], { title: "생일 축하합니다" })?.quality).toBe("steady");
    expect(offer([1000, 1270, 1540, 1810, 2080, 2350], { title: "생일 축하합니다" })?.quality).toBe("uneven");
  });
  it("uses the melody's held notes and subdivisions, including a full long gap", () => {
    // Score-matched Amazing Grace100BPM starts 1,2,.5,.5,2 quarter beats.
    expect(offer([100, 700, 1900, 2200, 2500, 3700], { title: "어메이징 그레이스" })?.quality).toBe("steady");
    expect(offer([100, 700, 1300, 1900, 2500, 3100], { title: "어메이징 그레이스" })?.quality).toBe("uneven");
  });
  it("compensates constant output and small rendering delay without shifting the user's score phase", () => {
    expect(offer([100, 600, 1100, 1600], { queue: 65, latency: 120 })?.quality).toBe("steady");
    expect(offer([100, 600, 1100, 1600], { queue: 180, latency: 120 })?.quality).toBe("unknown");
  });
  it("resets confidence on audio-clock jumps, a new song, a missed admitted note or blocked listening", () => {
    const inbox = createCompanionInstrumentInbox();
    for (const [index, at] of [100, 600, 1100, 1600].entries()) inbox.offer(pulse(index, at), at, true);
    expect(inbox.take(1600)?.quality).toBe("steady");
    inbox.offer(pulse(4, 2100, { latency: 200 }), 2100, true); expect(inbox.take(2100)?.quality).toBe("unknown");
    inbox.offer(pulse(5, 2600, { sequence: 2 }), 2600, true); expect(inbox.take(2600)?.quality).toBe("unknown");
    inbox.offer(pulse(7, 3600, { sequence: 2 }), 3600, true); expect(inbox.take(3600)?.quality).toBe("unknown");
    inbox.offer(pulse(8, 4100, { sequence: 2 }), 4100, false); expect(inbox.take(4100)).toBeUndefined();
  });
  it("never grades automatic fanfares, unknown arrangements or unverified notation transitions", () => {
    const inbox = createCompanionInstrumentInbox();
    [100, 600, 1100, 1600].forEach(at => inbox.offer(companionInstrumentPulse("캐논", at), at, true));
    expect(inbox.take(1600)?.quality).toBe("unknown");
    expect(companionInstrumentPulse("unknown-private-title", 1, 500, { sequence: 1, index: 0 }).rhythm).toBeUndefined();
    expect(companionInstrumentScorePosition("반짝반짝 작은 별", 19)).toBeUndefined();
    const before = companionInstrumentScorePosition("반짝반짝 작은 별", 18)!;
    const after = companionInstrumentScorePosition("반짝반짝 작은 별", 20)!;
    expect(after.segment).not.toBe(before.segment); expect(after.onsetMs).toBe(0);
  });
  it("keeps edition-mismatched pitches unknown and preserves source rests in manual score excerpts", () => {
    expect(companionInstrumentScorePosition("애국가", 1)?.gapMs).toBeCloseTo(60000 / 112 * 1.5);
    expect(companionInstrumentScorePosition("애국가", 5)).toBeUndefined();
    expect(companionInstrumentScorePosition("나비야", 0)?.gapMs).toBeCloseTo(60000 / 112 * .5);
    expect(companionInstrumentScorePosition("젓가락 행진곡", 0)?.gapMs).toBeCloseTo(375);
    expect(companionInstrumentScorePosition("뻐꾸기", 0)).toBeUndefined();
    expect(companionInstrumentScorePosition("윌리엄 텔 서곡", 0)).toBeUndefined();
  });
  it("continues the verified complete verse across its repeat and exposes no names in the event data", () => {
    const end = companionInstrumentScorePosition("자크 형제", 31)!, repeated = companionInstrumentScorePosition("자크 형제", 32)!;
    expect(repeated.segment).toBe(end.segment); expect(repeated.onsetMs).toBe(end.onsetMs + end.gapMs);
    const value = companionInstrumentPulse("자크 형제", 100, 500, { sequence: 1, index: 0 });
    expect(JSON.stringify(value)).not.toContain("자크"); expect(Object.keys(value.rhythm!).sort()).toEqual(["audibleAt", "gapMs", "index", "onsetMs", "segment", "sequence", "tapAt"]);
  });
  it("keeps every authored score bounded with explicit uncertainty and distinct actual rhythmic values", () => {
    expect(Object.keys(COMPANION_INSTRUMENT_SCORES).length).toBeGreaterThanOrEqual(32);
    for (const score of Object.values(COMPANION_INSTRUMENT_SCORES)) {
      expect(score.bpm).toBeGreaterThan(35); expect(score.bpm).toBeLessThan(250);
      expect(score.gaps.length).toBeGreaterThan(10); expect(score.gaps.length).toBeLessThan(120);
      for (const gap of score.gaps) if (gap !== null) { expect(gap).toBeGreaterThan(0); expect(gap).toBeLessThanOrEqual(4); }
    }
  });
});
