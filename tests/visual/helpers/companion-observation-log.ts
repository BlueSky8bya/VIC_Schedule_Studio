/** Browser-serializable factory. Only the sampler retains append capability;
 * exported observations never alias the private, immutable JSON history. */
export function createCompanionQaObservationLog(sessionId = `${performance.timeOrigin}:${performance.now()}`) {
  if (typeof sessionId !== "string" || !sessionId) throw Error("Observation session required");
  const snapshots: string[] = [];
  let lastAt = -Infinity;
  return Object.freeze({
    sessionId,
    append<T extends { at: number }>(frame: T) {
      const at = frame.at;
      const snapshot = JSON.stringify(frame);
      const captured = JSON.parse(snapshot) as { at?: unknown } | null;
      if (!captured || typeof captured !== "object" || !Number.isFinite(at) || at <= lastAt || captured.at !== at)
        throw Error("Observation capture chronology changed");
      snapshots.push(snapshot); lastAt = at;
    },
    readJson(from = 0) {
      if (!Number.isSafeInteger(from) || from < 0 || from > snapshots.length) throw Error("Observation offset outside history");
      return `{"version":1,"sessionId":${JSON.stringify(sessionId)},"from":${from},"total":${snapshots.length},"frames":[${snapshots.slice(from).join(",")}]}`;
    },
  });
}

export type CompanionQaObservationPacket<T> = { version: 1; sessionId: string; from: number; total: number; frames: T[] };

/** Reject replay, missing rows and time corruption rather than normalizing it. */
export function decodeCompanionQaObservationPacket<T extends { at: number }>(encoded: string,
  expected: { from: number; sessionId?: string; previousAt?: number }): CompanionQaObservationPacket<T> {
  const packet = JSON.parse(encoded) as CompanionQaObservationPacket<T>;
  if (!Number.isSafeInteger(expected.from) || expected.from < 0
    || expected.previousAt !== undefined && !Number.isFinite(expected.previousAt)
    || expected.from > 0 && (!expected.sessionId || expected.previousAt === undefined)
    || !packet || packet.version !== 1 || typeof packet.sessionId !== "string" || !packet.sessionId
    || expected.sessionId !== undefined && packet.sessionId !== expected.sessionId
    || packet.from !== expected.from || !Number.isSafeInteger(packet.total) || packet.total < packet.from
    || !Array.isArray(packet.frames) || packet.frames.length !== packet.total - packet.from)
    throw Error("Observation packet identity or length changed");
  let previous = expected.previousAt ?? -Infinity;
  for (const frame of packet.frames) {
    if (!frame || !Number.isFinite(frame.at) || frame.at <= previous) throw Error("Observation packet chronology changed");
    previous = frame.at;
  }
  return packet;
}
