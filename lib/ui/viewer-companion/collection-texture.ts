type Texture = Pick<HTMLImageElement, "src" | "complete" | "naturalWidth" | "naturalHeight" | "decode" | "removeAttribute" | "onload" | "onerror">;
type Entry = { image?: Texture; active: boolean; ready: boolean; failed: boolean };

/** Only the currently equipped atlas and pending gift atlas may own a decode.
 * No queue, library preload, timer, React state or body-decoder reset. */
export function createCompanionCollectionTextureReadiness(factory: () => Texture | undefined = () => typeof Image === "undefined" ? undefined : new Image()) {
  const entries = new Map<string, Entry>();
  const cancel = (entry: Entry) => {
    entry.active = false;
    if (entry.image) { entry.image.onload = entry.image.onerror = null; entry.image.removeAttribute("src"); }
  };
  return {
    use(sources: readonly string[]) {
      const wanted = new Set(sources.filter(Boolean).slice(0, 2));
      for (const [src, entry] of entries) if (!wanted.has(src)) { cancel(entry); entries.delete(src); }
      for (const src of wanted) {
        if (entries.has(src)) continue;
        const image = factory(), entry: Entry = { image, active: true, ready: false, failed: !image }; entries.set(src, entry);
        if (!image) continue;
        const owned = () => entry.active && entries.get(src) === entry;
        image.onerror = () => { if (owned()) { entry.ready = false; entry.failed = true; } };
        image.onload = () => {
          if (!owned() || !image.complete || image.naturalWidth <= 0 || image.naturalHeight <= 0) return;
          void image.decode().then(() => {
            if (owned() && image.complete && image.naturalWidth > 0 && image.naturalHeight > 0) entry.ready = true;
          }).catch(() => { if (owned()) { entry.ready = false; entry.failed = true; } });
        };
        image.src = src;
      }
    },
    ready(src: string | undefined) { return Boolean(src && entries.get(src)?.active && entries.get(src)?.ready && !entries.get(src)?.failed); },
    clear() { for (const entry of entries.values()) cancel(entry); entries.clear(); },
  };
}
