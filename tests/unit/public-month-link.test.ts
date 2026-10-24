import { describe, expect, it } from "vitest";
import { isPublicMonth, parsePublicMonth, publicMonthHref, readPublicMonth } from "@/lib/ui/public-month-link";

describe("public month address", () => {
  it.each(["2026-01", "2026-12", "1000-01", "9999-12"])("accepts exact supported month %s", value => {
    expect(parsePublicMonth(value)).toEqual({ year: Number(value.slice(0,4)), month: Number(value.slice(5)) });
  });
  it.each([undefined, null, [], ["2026-09"], ["2026-09","2026-10"], "2026-9", "2026-00", "2026-13", "0999-12", "10000-01", " 2026-09", "2026-09-01", "NaN", "2026-09\n", "２０２６-０９"])("rejects malformed or duplicate input %j", value => {
    expect(parsePublicMonth(value)).toBeNull();
  });
  it("rejects duplicate URL values rather than choosing a convenient first value", () => {
    expect(readPublicMonth(new URL("https://example.com/?month=2026-09&month=2026-10"))).toBeNull();
    expect(readPublicMonth(new URL("https://example.com/?month=2026-09"))).toEqual({ year: 2026, month: 9 });
  });
  it("preserves path, other query values and fragment when replacing all month values", () => {
    const href = publicMonthHref(new URL("https://example.com/?month=2026-09&month=2026-10&mode=a&mode=b#calendar"), { year: 2027, month: 1 });
    expect(href).toBe("/?month=2027-01&mode=a&mode=b#calendar");
  });
  it.each([{year: Infinity, month: 1}, {year: 2026, month: 0}, {year: 2026.5, month: 1}, {year: "2026", month: 1}, {year: 999, month: 1}])("does not serialize invalid remembered month %j", value => {
    expect(isPublicMonth(value)).toBe(false);
    expect(publicMonthHref(new URL("https://example.com/"), value as {year:number;month:number})).toBeNull();
  });
});
