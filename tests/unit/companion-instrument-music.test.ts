import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { companionInstrumentPulse } from "@/lib/ui/viewer-companion/instrument-music";

const parameter = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, setTargetAtTime() {} });
const node = () => ({ gain: parameter(), frequency: parameter(), Q: parameter(), threshold: parameter(), knee: parameter(), ratio: parameter(), attack: parameter(), release: parameter(), type: "sine", connect(destination: unknown) { return destination; }, start() {}, stop() {} });
let contextState = "running", settings: Map<string, string>;
class AudioFixture {
  state = contextState; currentTime = 0; sampleRate = 8000; destination = node();
  resume = vi.fn(() => Promise.resolve());
  createGain = node; createBiquadFilter = node; createDynamicsCompressor = node; createConvolver = node; createOscillator = node;
  createBuffer(_channels: number, size: number) { return { getChannelData: () => new Float32Array(size) }; }
}
let sfx: typeof import("@/lib/ui/sfx");
beforeEach(async () => {
  vi.resetModules(); contextState = "running"; settings = new Map([["vic.sound", "on"], ["vic.soundVol", "60"]]);
  vi.stubGlobal("window", Object.assign(new EventTarget(), { AudioContext: AudioFixture, localStorage: { getItem: (key: string) => settings.get(key) ?? null } }));
  vi.stubGlobal("document", { hidden: false, documentElement: { dataset: {} } });
  sfx = await import("@/lib/ui/sfx");
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
it("sends only one actually admitted calendar onset with finite pacing and no date/title payload", () => {
  const pulses: unknown[] = []; window.addEventListener(sfx.COMPANION_INSTRUMENT_EVENT, event => pulses.push((event as CustomEvent).detail));
  sfx.playCelebrationTap("christmas", "bells");
  expect(pulses).toHaveLength(1);
  expect(Object.keys(pulses[0] as object).sort()).toEqual(["at", "bpm", "durationMs", "expectedGapMs", "mood"]);
  expect(pulses[0]).toMatchObject({ mood: "lively", bpm: 112, durationMs: 500, expectedGapMs: 60000 / 112 });
  sfx.playSfx("note", { force: true }); expect(pulses).toHaveLength(1);
});
it.each(["muted", "zero", "category", "suspended"])("does not publish %s audio as a heard calendar performance", reason => {
  if (reason === "muted") settings.set("vic.sound", "off");
  if (reason === "zero") settings.set("vic.soundVol", "0");
  if (reason === "category") settings.set("vic.soundCats", JSON.stringify({ celebrate: false }));
  if (reason === "suspended") contextState = "suspended";
  const heard = vi.fn(); window.addEventListener(sfx.COMPANION_INSTRUMENT_EVENT, heard);
  sfx.playCelebrationTap("christmas", "bells"); expect(heard).not.toHaveBeenCalled();
});
it("maps authored lullaby, formal melody and birthday beat without forwarding names", () => {
  expect(companionInstrumentPulse("브람스 자장가", 10)).toMatchObject({ mood: "calm", bpm: 72, expectedGapMs: 60000 / 72 });
  expect(companionInstrumentPulse("캐논", 10)).toMatchObject({ mood: "graceful", bpm: 80 });
  expect(companionInstrumentPulse("생일 축하합니다", 10).expectedGapMs).toBeCloseTo(270);
  expect(Object.values(companionInstrumentPulse("synthetic-private-title", 10))).not.toContain("synthetic-private-title");
});
