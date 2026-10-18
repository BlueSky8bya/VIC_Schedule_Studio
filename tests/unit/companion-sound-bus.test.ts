import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const parameter = () => ({ value: 0, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), setTargetAtTime: vi.fn() });
const node = () => ({ connect: vi.fn(function (this: unknown, destination: unknown) { return destination; }), disconnect: vi.fn() });
class FakeAudioContext {
  static instances: FakeAudioContext[] = [];
  state = "running";
  currentTime = 12;
  sampleRate = 100;
  destination = node();
  gains: Array<ReturnType<typeof node> & { gain: ReturnType<typeof parameter> }> = [];
  oscillators: Array<ReturnType<typeof node> & { frequency: ReturnType<typeof parameter>; start: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> }> = [];
  resume = vi.fn(async () => {});
  constructor() { FakeAudioContext.instances.push(this); }
  createGain() { const gain = { ...node(), gain: parameter() }; this.gains.push(gain); return gain; }
  createBiquadFilter() { return { ...node(), frequency: parameter(), Q: parameter() }; }
  createDynamicsCompressor() { return { ...node(), threshold: parameter(), knee: parameter(), ratio: parameter(), attack: parameter(), release: parameter() }; }
  createBuffer(_channels: number, length: number) { return { getChannelData: () => new Float32Array(length) }; }
  createConvolver() { return node(); }
  createBufferSource() { return { ...node(), start: vi.fn(), stop: vi.fn() }; }
  createOscillator() { const oscillator = { ...node(), frequency: parameter(), start: vi.fn(), stop: vi.fn() }; this.oscillators.push(oscillator); return oscillator; }
}

let entries: Map<string, string>, activation: { hasBeenActive: boolean; isActive: boolean }, page: { hidden: boolean; documentElement: { dataset: Record<string, string> } };
beforeEach(() => {
  vi.resetModules(); FakeAudioContext.instances = []; entries = new Map();
  activation = { hasBeenActive: false, isActive: false };
  page = { hidden: false, documentElement: { dataset: {} } };
  vi.stubGlobal("document", page);
  vi.stubGlobal("navigator", { userActivation: activation });
  vi.stubGlobal("window", Object.assign(new EventTarget(), { AudioContext: FakeAudioContext, localStorage: { getItem: (key: string) => entries.get(key) ?? null }, clearTimeout: vi.fn() }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("companion on the shared audio bus", () => {
  it("allocates no context before native activation, while muted, hidden or either volume is zero", async () => {
    const { playCompanionVoice } = await import("@/lib/ui/sfx");
    const notes = [{ f: 330, tau: .025 }];
    expect(playCompanionVoice(notes, 60)).toBe(false);
    activation.hasBeenActive = true; activation.isActive = true;
    entries.set("vic.sound", "off"); expect(playCompanionVoice(notes, 60)).toBe(false);
    entries.set("vic.sound", "on"); entries.set("vic.soundVol", "0"); expect(playCompanionVoice(notes, 60)).toBe(false);
    entries.set("vic.soundVol", "60"); expect(playCompanionVoice(notes, 0)).toBe(false);
    page.hidden = true; expect(playCompanionVoice(notes, 60)).toBe(false);
    expect(FakeAudioContext.instances).toHaveLength(0);
  });
  it("reuses one context, combines both volumes, ignores legacy categories and schedules finite voices", async () => {
    const { playCompanionVoice } = await import("@/lib/ui/sfx");
    activation.hasBeenActive = true; activation.isActive = true;
    entries.set("vic.soundVol", "50"); entries.set("vic.soundCats", JSON.stringify({ tap: false, ui: false, celebrate: false, edit: false, alert: false }));
    expect(playCompanionVoice([{ f: 330, tau: .025 }], 40)).toBe(true);
    const ac = FakeAudioContext.instances[0];
    expect(ac.gains[0].gain.value).toBeCloseTo(Math.pow(.5, 1.6) * Math.pow(.4, 1.6) * .9);
    activation.isActive = false;
    expect(playCompanionVoice([{ f: 440, at: .075, tau: .03 }], 40)).toBe(true);
    expect(FakeAudioContext.instances).toHaveLength(1);
    expect(ac.oscillators).toHaveLength(2);
    for (const oscillator of ac.oscillators) { expect(oscillator.start).toHaveBeenCalledOnce(); expect(oscillator.stop).toHaveBeenCalledOnce(); expect(oscillator.stop.mock.calls[0][0]).toBeLessThan(ac.currentTime + .5); }
  });
  it("drops autonomous work while suspended without resuming or replaying it", async () => {
    const { playCompanionVoice } = await import("@/lib/ui/sfx");
    activation.hasBeenActive = true; activation.isActive = true;
    expect(playCompanionVoice([{ f: 330 }], 60)).toBe(true);
    const ac = FakeAudioContext.instances[0]; ac.state = "suspended"; activation.isActive = false;
    expect(playCompanionVoice([{ f: 440 }], 60)).toBe(false);
    expect(ac.resume).not.toHaveBeenCalled(); expect(ac.oscillators).toHaveLength(1);
    ac.state = "running";
    expect(ac.oscillators).toHaveLength(1);
  });
  it("leaves an unrelated active UI gesture's result sound eligible", async () => {
    const { playCompanionVoice, playSfx } = await import("@/lib/ui/sfx");
    activation.hasBeenActive = true; activation.isActive = true;
    vi.spyOn(performance, "now").mockReturnValue(1000);
    window.dispatchEvent(Object.assign(new Event("keydown"), { key: "Enter" }));
    expect(playCompanionVoice([{ f: 330, tau: .025 }], 60)).toBe(true);
    const ac = FakeAudioContext.instances[0], before = ac.oscillators.length;
    playSfx("open");
    expect(ac.oscillators.length).toBeGreaterThan(before);
    expect(page.documentElement.dataset.sfxLast).toBe("open");
  });
});
