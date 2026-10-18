type Viewport = Readonly<{ width: number; height: number }>;
type Delivery = Readonly<{ validationOnly: boolean; hasSafePlatforms: boolean; inputOwned?: boolean }>;

const validViewport = (viewport: Viewport) => Number.isFinite(viewport.width) && viewport.width > 0
  && Number.isFinite(viewport.height) && viewport.height > 0;

/** One actual viewport change owns one recovery opportunity. A queued quiet
 * validation or an empty transitional scan cannot consume it before real safe
 * spans arrive. This grants no support, changes no coordinates, and starts no
 * clock: the existing renderer still chooses and animates a measured landing. */
export function createCompanionViewportRecovery(initialViewport: Viewport) {
  let previous = validViewport(initialViewport) ? { ...initialViewport } : undefined;
  let pending = false;
  return {
    observe(viewport: Viewport): void {
      if (!validViewport(viewport)) return;
      if (previous && (previous.width !== viewport.width || previous.height !== viewport.height)) pending = true;
      previous = { ...viewport };
    },
    take(delivery: Delivery): boolean {
      // Deliberate placement/drag owns the next contact. Keep the measured
      // viewport baseline so a later quiet scan cannot revive this permission.
      if (delivery.inputOwned) { pending = false; return false; }
      if (!pending || delivery.validationOnly || !delivery.hasSafePlatforms) return false;
      pending = false;
      return true;
    },
    revoke(): void { pending = false; },
  };
}
