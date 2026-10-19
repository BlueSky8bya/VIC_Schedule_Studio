import metadata from "./art-files.generated.json";
import { ART_SLOTS, slotFiles, type PresentArt } from "@/components/shared/ambient/art/manifest";

// The build/dev preparation step inventories the public PNGs. Reading that
// small snapshot here keeps those images on the CDN, outside Function bundles.
// Routes retain their developer/fixture guards before calling this function.
export function readPresentArt(): { present: PresentArt; stamp: number } {
  if (metadata.schemaVersion !== 1) throw new Error("Unsupported ambient art metadata");
  const info = new Map(metadata.files.map(file => [file.file, file]));
  const present: PresentArt = {};
  for (const slot of ART_SLOTS) {
    present[slot.id] = slotFiles(slot).flatMap(filename => {
      const file = info.get(filename);
      return file ? [{ ...file }] : [];
    });
  }
  return { present, stamp: metadata.stamp };
}
