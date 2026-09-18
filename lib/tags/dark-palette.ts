import { hexToOklch, oklchToHex } from "@/lib/tags/color-tone";

/** Versioned public visual metadata. DB generated columns use the same OKLCH
 * contract (0123); source colors remain editable and are never overwritten. */
export type DarkTagColors = {
  version: 3;
  source: string;
  bgColor: string;
  borderColor: string;
  textColor: string;
  accentColor: string;
};

const HEX = /^#[0-9a-f]{6}$/i;
const cache = new Map<string, DarkTagColors>();
export function deriveDarkTagColors(source: string): DarkTagColors {
  const hex = HEX.test(source) ? source.toLowerCase() : "#b8b3aa";
  const cached = cache.get(hex);
  if (cached) return cached;
  const { L, C, h } = hexToOklch(hex);
  const colors: DarkTagColors = {
    version: 3, source: hex,
    // Large card fills stay subdued against warm charcoal (#262420); small
    // accents carry more chroma. Keep source hues/neutrality, not an amber veil.
    // Research and application limits: docs/ux/dark-mode-palette.md (v3).
    bgColor: oklchToHex(0.38 + L * 0.08, Math.min(0.065, C * 0.60 + Math.min(C / 0.04, 1) * 0.012), h),
    borderColor: oklchToHex(0.55 + L * 0.06, Math.min(0.075, C * 0.65 + Math.min(C / 0.04, 1) * 0.012), h),
    textColor: "#f1ede6",
    accentColor: oklchToHex(0.72 + L * 0.06, Math.min(0.11, C * 0.8 + Math.min(C / 0.04, 1) * 0.018), h)
  };
  // Color-picker dragging can produce unlimited transient colors.
  if (cache.size >= 512) cache.clear();
  cache.set(hex, colors);
  return colors;
}

/** Explicit DTO construction; stale optimistic metadata must not survive a
 * source-color edit. No opaque database JSON crosses the public boundary. */
export function readDarkTagColors(value: unknown, source: string): DarkTagColors {
  if (value && typeof value === "object") {
    const v = value as Partial<DarkTagColors>;
    if (v.version === 3 && v.source === source.toLowerCase() &&
      [v.bgColor, v.borderColor, v.textColor, v.accentColor].every(c => typeof c === "string" && HEX.test(c))) {
      return { version: 3, source: v.source, bgColor: v.bgColor!, borderColor: v.borderColor!, textColor: v.textColor!, accentColor: v.accentColor! };
    }
  }
  return deriveDarkTagColors(source);
}

/** CSS resolves both colors before first paint and on the existing theme switch.
 * No per-component theme hooks, root filters or hydration color flashes. */
export function themeColor(light: string, dark: string): string {
  return `light-dark(${light}, ${dark})`;
}
export function tagColor(source: string, role: "bgColor" | "borderColor" | "accentColor" = "accentColor", stored?: DarkTagColors, light = source): string {
  return themeColor(light, readDarkTagColors(stored, source)[role]);
}
