import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { COMPANION_FOOD_KINDS } from "@/lib/ui/viewer-companion/snacks";

const directory = join(process.cwd(), "public/companion/food");
const manifest = JSON.parse(readFileSync(join(directory, "sources.json"), "utf8")) as {
  upstreamCommit: string; license: string;
  files: { kind: string; url: string; sha256: string }[];
  derivatives: Record<string, { basedOn: string; changes: string }>;
  delivered: { kind: string; sha256: string }[];
};

describe("local companion food vectors", () => {
  it("covers thirteen fruits with checked local SVG bytes and no external executable content", () => {
    expect(manifest.delivered.map(item => item.kind).sort()).toEqual([...COMPANION_FOOD_KINDS].sort());
    for (const item of manifest.delivered) {
      const svg = readFileSync(join(directory, `${item.kind}.svg`), "utf8");
      expect(createHash("sha256").update(svg).digest("hex")).toBe(item.sha256);
      expect(svg).toMatch(/viewBox="0 0 128 128"/);
      expect(svg).not.toMatch(/<script|<image|(?:xlink:)?href\s*=\s*["']https?:|\son\w+\s*=/i);
    }
  });
  it("distinguishes eight unchanged originals from five clearly marked derivatives", () => {
    expect(manifest.files).toHaveLength(8); expect(Object.keys(manifest.derivatives)).toHaveLength(5);
    for (const item of manifest.files) {
      expect(item.url).toContain(`/googlefonts/noto-emoji/${manifest.upstreamCommit}/2D/svg/`);
      expect(manifest.delivered.find(delivered => delivered.kind === item.kind)?.sha256).toBe(item.sha256);
    }
    for (const kind of Object.keys(manifest.derivatives)) expect(readFileSync(join(directory, `${kind}.svg`), "utf8")).toContain("Modified for VIC Schedule Studio");
  });
  it("redistributes the graphics license, upstream copyright and modification record", () => {
    expect(manifest.license).toBe("Apache-2.0");
    expect(readFileSync(join(directory, "LICENSE.txt"), "utf8")).toContain("Version 2.0, January 2004");
    expect(readFileSync(join(directory, "UPSTREAM_NOTICE.txt"), "utf8")).toContain("Copyright 2013 Google, Inc.");
    expect(readFileSync(join(directory, "SOURCES.md"), "utf8")).toContain("Five files are VIC Schedule Studio derivatives");
  });
});
