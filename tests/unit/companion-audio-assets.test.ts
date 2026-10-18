import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { COMPANION_RADIO_TRACKS } from "@/lib/ui/viewer-companion/radio-catalog";
const provenance = JSON.parse(readFileSync("public/companion/audio/radio/provenance.json", "utf8")) as { tracks: Array<{ id: string; sha256: string; bytes: number; sourceUrl: string; sourceSha256: string }> };
describe("bounded, attributable local companion audio", () => {
  it("ships 32 different Opus recordings with matching immutable receipts under the asset budget", () => {
    expect(COMPANION_RADIO_TRACKS).toHaveLength(32); expect(provenance.tracks).toHaveLength(32);
    const hashes = new Set<string>(); let total = 0;
    for (const track of COMPANION_RADIO_TRACKS) {
      expect(track.license).toBe("CC0-1.0"); expect(track.src).toMatch(/^\/companion\/audio\/radio\/radio-\d{2}\.ogg$/);
      const bytes = readFileSync(`public${track.src}`), hash = createHash("sha256").update(bytes).digest("hex"); hashes.add(hash); total += bytes.length;
      const receipt = provenance.tracks.find(item => item.id === track.id)!;
      expect(receipt.sha256).toBe(hash); expect(receipt.sourceSha256).toMatch(/^[a-f0-9]{64}$/); expect(receipt.bytes).toBe(bytes.length); expect(receipt.sourceUrl).toBe(track.sourceUrl);
      expect(bytes.subarray(0, 4).toString()).toBe("OggS"); expect(bytes.includes(Buffer.from("OpusHead"))).toBe(true); expect(bytes.length).toBeLessThan(1600000);
    }
    expect(hashes.size).toBe(32); expect(total).toBeLessThan(25000000);
    expect(new Set(COMPANION_RADIO_TRACKS.map(track => track.mood)).size).toBe(3);
  });
  it("keeps the tiny tactile sample attributable and independently hashed", () => {
    const receipt = JSON.parse(readFileSync("public/companion/audio/cushion-provenance.json", "utf8"));
    const bytes = readFileSync("public/companion/audio/cushion.ogg");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(receipt.sha256); expect(bytes.length).toBeLessThan(20000); expect(receipt.license).toBe("CC0-1.0"); expect(receipt.sourceUrl).toBe("https://kenney.nl/assets/impact-sounds");
  });
});
