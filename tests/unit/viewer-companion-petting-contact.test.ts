import { describe, expect, it } from "vitest";
import { createCompanionPettingContact } from "@/lib/ui/viewer-companion/petting";

describe("input-owned petting contact", () => {
  it("responds to the first pass before a complete reward gesture", () => {
    const contact = createCompanionPettingContact();
    expect(contact.move(.2, 0)).toBe(false);
    expect(contact.move(.7, 80)).toBe(true);
    expect(contact.sample(80).pressure).toBeGreaterThan(0);
    expect(contact.sample(80).tilt).toBeGreaterThan(0);
  });
  it("reverses local lean immediately while bounding force", () => {
    const contact = createCompanionPettingContact();
    contact.move(.2, 0); contact.move(20, 1);
    const right = contact.sample(1);
    expect(right.pressure).toBe(1); expect(right.x).toBeLessThanOrEqual(.8);
    contact.move(-20, 2);
    const left = contact.sample(2);
    expect(left.tilt).toBe(-right.tilt); expect(left.y).toBe(right.y);
    expect(left.squash).toBeLessThanOrEqual(.035);
  });
  it("stationary jitter cannot keep a contact alive", () => {
    const contact = createCompanionPettingContact();
    contact.move(.2, 0); contact.move(.7, 80);
    for (let now = 90; now < 700; now += 10) contact.move(.7 + (now % 20 ? .001 : 0), now);
    expect(contact.sample(700)).toEqual({ x: 0, y: 0, tilt: 0, squash: 0, pressure: 0 });
  });
  it("releases continuously to exact neutral without a timer", () => {
    const contact = createCompanionPettingContact();
    contact.move(.2, 0); contact.move(.7, 80);
    expect(contact.sample(150).pressure).toBeLessThan(contact.sample(80).pressure);
    expect(contact.sample(629).pressure).toBeGreaterThan(0);
    expect(contact.sample(630).pressure).toBe(0);
    contact.reset(); expect(contact.sample(640).pressure).toBe(0);
  });
  it("reduced motion retains only a subtle press", () => {
    const contact = createCompanionPettingContact();
    contact.move(.2, 0); contact.move(.7, 80);
    const full = contact.sample(80), reduced = contact.sample(80, true);
    expect(reduced.x).toBe(0); expect(reduced.tilt).toBe(0);
    expect(reduced.squash).toBeCloseTo(full.squash * .2);
  });
  it("rejects bad clocks and idle gaps without carrying old force", () => {
    const contact = createCompanionPettingContact();
    contact.move(.2, 0); contact.move(.7, 80);
    expect(contact.move(.2, 70)).toBe(false); expect(contact.sample(80).pressure).toBe(0);
    contact.move(.2, 90); contact.move(.7, 100);
    expect(contact.move(NaN, 120)).toBe(false); expect(contact.sample(120).pressure).toBe(0);
    expect(contact.sample(Infinity).pressure).toBe(0);
    contact.move(.2, 130); expect(contact.move(.7, 900)).toBe(false);
    expect(contact.sample(900).pressure).toBe(0);
  });
});
