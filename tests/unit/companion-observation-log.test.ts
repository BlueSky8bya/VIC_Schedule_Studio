import { describe, expect, it } from "vitest";
import { createCompanionQaObservationLog, decodeCompanionQaObservationPacket } from "../visual/helpers/companion-observation-log";

describe("immutable companion observation history", () => {
  it("retains original timing, position and nested paint when caller aliases change later", () => {
    const log = createCompanionQaObservationLog("native-1");
    const row = { at: 40, x: 83, wash: { body: { x: 37 } }, poses: [26, 27] };
    log.append(row); const original = log.readJson();
    row.at = 200; row.x = 191; row.wash.body.x = 145; row.poses.push(28);
    expect(log.readJson()).toBe(original);
    expect(JSON.parse(original).frames[0]).toEqual({ at: 40, x: 83, wash: { body: { x: 37 } }, poses: [26, 27] });
  });
  it("exported objects cannot replace or rewrite historical observations", () => {
    const log = createCompanionQaObservationLog("native-2"); log.append({ at: 40 });
    const original = log.readJson(), exported = JSON.parse(original);
    exported.frames[0].at = 900; exported.frames.push({ at: 1000 }); exported.total = 2;
    expect(log.readJson()).toBe(original);
    expect(Object.isFrozen(log)).toBe(true);
  });
  it.each([40, 39, NaN, Infinity, -Infinity])("rejects invalid or replayed capture %s without changing retained history", at => {
    const log = createCompanionQaObservationLog("native-3"); log.append({ at: 40 }); const before = log.readJson();
    expect(() => log.append({ at })).toThrow(); expect(log.readJson()).toBe(before);
    log.append({ at: 80 }); expect(JSON.parse(log.readJson(1)).frames).toEqual([{ at: 80 }]);
  });
  it("rejects a serialized timestamp replacement rather than crediting it", () => {
    const log = createCompanionQaObservationLog("native-4");
    expect(() => log.append({ at: 40, toJSON: () => ({ at: 99 }) })).toThrow();
    expect(JSON.parse(log.readJson()).total).toBe(0);
  });
  it.each([-1, .5, NaN, 2])("rejects invalid cursor %s", from => {
    const log = createCompanionQaObservationLog("native-5"); log.append({ at: 40 });
    expect(() => log.readJson(from)).toThrow();
  });
  it("joins only the same session's exact next canonical delta", () => {
    const log = createCompanionQaObservationLog("native-6"); log.append({ at: -1 }); log.append({ at: 40 });
    const first = decodeCompanionQaObservationPacket(log.readJson(), { from: 0 });
    log.append({ at: 80 });
    const next = decodeCompanionQaObservationPacket(log.readJson(2), { from: 2, sessionId: first.sessionId, previousAt: 40 });
    expect([...first.frames, ...next.frames]).toEqual([{ at: -1 }, { at: 40 }, { at: 80 }]);
    expect(decodeCompanionQaObservationPacket(log.readJson(3), { from: 3, sessionId: first.sessionId, previousAt: 80 }).frames).toEqual([]);
  });
  it.each([
    { sessionId: "foreign" }, { from: 1 }, { total: 3 }, { total: .5 },
    { frames: [{ at: 80 }, { at: 40 }] }, { frames: [{ at: 40 }, { at: 40 }] },
    { frames: [{ at: null }, { at: 80 }] }, { frames: [{ at: 80 }] },
  ])("rejects replaced, reordered or truncated packet %j", replacement => {
    const packet = { version: 1, sessionId: "native-7", from: 0, total: 2, frames: [{ at: 40 }, { at: 80 }], ...replacement };
    expect(() => decodeCompanionQaObservationPacket(JSON.stringify(packet), { from: 0, sessionId: "native-7" })).toThrow();
  });
  it("rejects duplicate boundary time and nonfinite expected state", () => {
    const log = createCompanionQaObservationLog("native-8"); log.append({ at: 40 }); log.append({ at: 80 });
    expect(() => decodeCompanionQaObservationPacket(log.readJson(1), { from: 1, sessionId: "native-8", previousAt: 80 })).toThrow();
    expect(() => decodeCompanionQaObservationPacket(log.readJson(1), { from: 1, sessionId: "native-8", previousAt: NaN })).toThrow();
  });
  it("requires a prior session and observed last time for nonempty cursors", () => {
    const log = createCompanionQaObservationLog("native-9"); log.append({ at: 40 }); log.append({ at: 80 });
    expect(() => decodeCompanionQaObservationPacket(log.readJson(1), { from: 1, sessionId: "native-9" })).toThrow();
    expect(() => decodeCompanionQaObservationPacket(log.readJson(1), { from: 1, previousAt: 40 })).toThrow();
    expect(decodeCompanionQaObservationPacket(log.readJson(1), { from: 1, sessionId: "native-9", previousAt: 40 }).frames).toEqual([{ at: 80 }]);
  });
});
