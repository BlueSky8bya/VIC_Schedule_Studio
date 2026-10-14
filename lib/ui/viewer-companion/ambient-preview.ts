import { MOBILE_QUERY } from "@/lib/ui/breakpoints";

/** A visual lease only: never modify vic.ambient or its data-ambient preference. */
export const COMPANION_AMBIENT_PREVIEW_MS = 20_000;
let activeRelease: (() => void) | undefined;
let sequence = 0;

export function acquireCompanionAmbientPreview(): () => void {
  activeRelease?.();
  if (typeof window === "undefined" || typeof document === "undefined") return () => {};
  const root = document.documentElement;
  const mobile = window.matchMedia(MOBILE_QUERY);
  const unavailable = () => document.hidden || mobile.matches || root.dataset.gfx === "off" || root.dataset.gfx === "soft" || root.hasAttribute("data-ambient-pause") || root.hasAttribute("data-showcase");
  if (unavailable()) return () => {};

  const token = String(++sequence);
  let released = false;
  const release = () => {
    if (released) return;
    released = true;
    clearTimeout(expiry);
    observer.disconnect();
    document.removeEventListener("visibilitychange", check);
    mobile.removeEventListener("change", check);
    if (root.getAttribute("data-ambient-pet") === token) root.removeAttribute("data-ambient-pet");
    if (activeRelease === release) activeRelease = undefined;
  };
  const check = () => { if (unavailable()) release(); };
  const observer = new MutationObserver(records => {
    // User preference wins, including two changes that return to the old value
    // in the same batch. Repeating the same attribute value is not a change.
    if (records.some(record => record.attributeName === "data-ambient" && record.oldValue !== root.getAttribute("data-ambient")) || root.getAttribute("data-ambient-pet") !== token) release();
    else check();
  });
  root.setAttribute("data-ambient-pet", token);
  observer.observe(root, { attributes: true, attributeOldValue: true, attributeFilter: ["data-ambient", "data-ambient-pet", "data-gfx", "data-ambient-pause", "data-showcase"] });
  document.addEventListener("visibilitychange", check);
  mobile.addEventListener("change", check);
  const expiry = setTimeout(release, COMPANION_AMBIENT_PREVIEW_MS);
  activeRelease = release;
  return release;
}
