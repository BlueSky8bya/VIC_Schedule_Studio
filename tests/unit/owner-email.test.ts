import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getOwnerEmail, getOwnerEmails, isOwnerEmail } from "@/lib/auth/config";

describe("owner email resolution", () => {
  const original = process.env.OWNER_EMAIL;

  beforeEach(() => {
    delete process.env.OWNER_EMAIL;
  });

  afterEach(() => {
    if (original === undefined) {
      delete process.env.OWNER_EMAIL;
    } else {
      process.env.OWNER_EMAIL = original;
    }
  });

  it("parses a single owner email", () => {
    process.env.OWNER_EMAIL = "Tory@Gmail.com";
    expect(getOwnerEmails()).toEqual(["tory@gmail.com"]);
    expect(getOwnerEmail()).toBe("tory@gmail.com");
  });

  it("parses a comma-separated list of co-owner emails (normalized)", () => {
    process.env.OWNER_EMAIL = " tory@gmail.com , Tory2@gmail.com ";
    expect(getOwnerEmails()).toEqual(["tory@gmail.com", "tory2@gmail.com"]);
    // 주 소유자는 목록의 첫 번째
    expect(getOwnerEmail()).toBe("tory@gmail.com");
  });

  it("matches any account in the list as owner", () => {
    process.env.OWNER_EMAIL = "tory@gmail.com,tory2@gmail.com";
    expect(isOwnerEmail("tory@gmail.com")).toBe(true);
    expect(isOwnerEmail("tory2@gmail.com")).toBe(true);
    expect(isOwnerEmail("someone@gmail.com")).toBe(false);
    expect(isOwnerEmail(null)).toBe(false);
  });

  it("returns empty when OWNER_EMAIL is unset", () => {
    expect(getOwnerEmails()).toEqual([]);
    expect(getOwnerEmail()).toBeNull();
    expect(isOwnerEmail("tory@gmail.com")).toBe(false);
  });
});
