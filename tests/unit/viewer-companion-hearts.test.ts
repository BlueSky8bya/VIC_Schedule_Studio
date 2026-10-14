import { describe, expect, it } from "vitest";
import { MAX_COMPANION_HEARTS, readCompanionHeartIds } from "@/lib/ui/viewer-companion/hearts";

describe("companion heart public-id memory", () => {
  it("ignores malformed, unsupported and unstructured data", () => {
    for (const raw of [null, "{", "[]", '{"version":2,"ids":["public-event"]}', '{"version":1,"ids":"public-event"}']) expect(readCompanionHeartIds(raw)).toEqual([]);
  });
  it("allowlists bounded public ids without importing any associated fields", () => {
    const raw = JSON.stringify({ version: 1, title: "SYNTHETIC_TITLE_CANARY", email: "synthetic@example.invalid", ids: ["public-event", "00000000-0000-4000-8000-000000000001", "has spaces", "a@b.invalid", "x".repeat(97), 1, null, { title: "canary" }] });
    expect(readCompanionHeartIds(raw)).toEqual(["public-event", "00000000-0000-4000-8000-000000000001"]);
  });
  it("deduplicates in recent order and retains at most128 ids", () => {
    const ids = Array.from({ length: 300 }, (_, index) => `public-${index}`);
    const result = readCompanionHeartIds(JSON.stringify({ version: 1, ids: [...ids, "public-220"] }));
    expect(result).toHaveLength(MAX_COMPANION_HEARTS);
    expect(new Set(result).size).toBe(MAX_COMPANION_HEARTS);
    expect(result.at(-1)).toBe("public-220");
    expect(result).not.toContain("public-0");
  });
});
