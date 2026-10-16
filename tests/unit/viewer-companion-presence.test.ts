import { describe, expect, it } from "vitest";
import { createCompanionPresence } from "@/lib/ui/viewer-companion/presence";
import { COMPANION_TIMING as T } from "@/lib/ui/viewer-companion/timing";

describe("companion passive presence", () => {
  it("lets direct focused input take over waking without overriding blur", () => {
    const p = createCompanionPresence(false, 0);
    p.step(0, false); p.step(T.presenceRest, false); p.step(T.presenceRest + T.presenceYawn, false);
    p.focus(true, 2000); expect(p.phase).toBe("waking");
    p.focus(true, 2100, true); expect(p.phase).toBe("active");
    p.focus(false, 2200, true); expect(p.phase).toBe("finishing");
  });
  it("finishes even a long meal before its rest beat and yawn", () => {
    const p = createCompanionPresence(true, 0);
    p.focus(false, 10);
    expect(p.step(5000, true)).toBe("finishing");
    expect(p.step(5100, false)).toBe("resting");
    expect(p.step(5100 + T.presenceRest - 1, false)).toBe("resting");
    expect(p.step(5100 + T.presenceRest, false)).toBe("yawning");
    expect(p.step(5100 + T.presenceRest + T.presenceYawn - 1, false)).toBe("yawning");
    expect(p.step(5100 + T.presenceRest + T.presenceYawn, false)).toBe("parked");
    expect(p.step(999999, false)).toBe("parked");
  });
  it("cancels a short absence without forcing a sleep or wake", () => {
    const p = createCompanionPresence(true, 0);
    p.focus(false, 100); p.step(100, false); p.focus(true, 500);
    expect(p.step(2000, false)).toBe("active");
  });
  it("initially unfocused browser sources reach sleep without a blur event", () => {
    const p = createCompanionPresence(false, 0);
    expect(p.step(0, false)).toBe("resting");
    expect(p.step(T.presenceRest, false)).toBe("yawning");
    expect(p.step(T.presenceRest + T.presenceYawn, false)).toBe("parked");
  });
  it("wakes once and repeated focus cannot reset the wake deadline", () => {
    const p = createCompanionPresence(false, 0);
    p.step(0, false); p.step(T.presenceRest, false); p.step(T.presenceRest + T.presenceYawn, false);
    p.focus(true, 2000); p.focus(true, 2500);
    expect(p.step(2000 + T.presenceWake - 1, false)).toBe("waking");
    expect(p.step(2000 + T.presenceWake, false)).toBe("active");
    p.focus(false, 3000);
    expect(p.step(3000, false)).toBe("resting");
  });
});
