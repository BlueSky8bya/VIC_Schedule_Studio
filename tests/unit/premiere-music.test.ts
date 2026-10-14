import { describe, expect, it } from "vitest";
import { MUSIC_OPEN, MUSIC_QUIET, PREMIERE_TRACKS, musicStepTime, pickPremiereTrack, premiereMusicStep, premiereMusicWindow } from "@/lib/ui/premiere/music";

describe("original premiere music library", () => {
  it("reaches every score while excluding the last selection", () => {
    for (const previous of [undefined, ...PREMIERE_TRACKS.map(t => t.id)]) {
      const picks = new Set(Array.from({ length: 100 }, (_, i) => pickPremiereTrack(previous, () => i / 100).id));
      expect(picks.size).toBe(previous ? 3 : 4);
      if (previous) expect(picks.has(previous)).toBe(false);
    }
  });
  it("uses four distinct arrangements and builds density before tapering", () => {
    const signatures = new Set<string>();
    for (const track of PREMIERE_TRACKS) {
      const events = Array.from({ length: 500 }, (_, step) => ({ time: musicStepTime(track, step), notes: premiereMusicStep(track, step) }));
      signatures.add(JSON.stringify(events));
      const count = (from: number, to: number) => events.filter(e => e.time >= from && e.time < to).reduce((sum, e) => sum + e.notes.length, 0);
      expect(count(42, 50)).toBeGreaterThan(count(2, 10));
      for (const event of events) for (const note of event.notes) {
        expect(note.duration).toBeGreaterThan(0);
        expect(event.time + note.duration).toBeLessThanOrEqual(MUSIC_OPEN - MUSIC_QUIET + .000001);
        expect(note.level).toBeGreaterThanOrEqual(0); expect(note.level).toBeLessThanOrEqual(.22);
      }
      const activePeak = Math.max(...events.map(event => events.filter(other => other.time <= event.time).flatMap(other => other.notes.filter(note => other.time + note.duration > event.time)).length));
      expect(activePeak).toBeLessThanOrEqual(24);
    }
    expect(signatures.size).toBe(4);
  });
  it("schedules each step once, skips sleep gaps and stays silent at the boundary", () => {
    for (const track of PREMIERE_TRACKS) {
      let last = -1;
      const seen = new Set<number>();
      for (let ms = 68000; ms > 10500; ms -= 100) {
        for (const event of premiereMusicWindow(track, ms, last)) {
          expect(seen.has(event.step)).toBe(false); seen.add(event.step); last = event.step;
          expect(event.delay).toBeGreaterThanOrEqual(0); expect(event.delay).toBeLessThanOrEqual(.150001);
        }
      }
      expect(seen.size).toBeGreaterThan(200);
      const jumped = premiereMusicWindow(track, 22000, 3);
      expect(jumped.length).toBeLessThanOrEqual(3);
      for (const event of jumped) expect(musicStepTime(track, event.step)).toBeGreaterThanOrEqual(45.985);
      // A syncopated score may have a rest inside one lookahead window.
      expect([40000, 39900, 39800].flatMap(ms => premiereMusicWindow(track, ms, 490)).length).toBeGreaterThan(0);
      for (const ms of [10500, 10000, 0, -1, 68001, NaN, Infinity]) expect(premiereMusicWindow(track, ms, -1)).toEqual([]);
    }
  });
});
