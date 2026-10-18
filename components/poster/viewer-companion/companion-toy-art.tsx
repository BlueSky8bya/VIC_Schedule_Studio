export type CompanionToyArtKind = "ball" | "blocks" | "paper-plane" | "spool";

/** Small source-native props, never a second mascot drawing. The real toy
 * owner supplies its single position/physics and transforms the outer layer. */
export function CompanionToyArt({ kind }: { kind: CompanionToyArtKind }) {
  const edge = "var(--vc-wood-edge, #9a8065)", cream = "var(--vc-container-light, #f0e4ce)", sage = "var(--vc-sage, #b4c2a1)", linen = "var(--vc-linen, #dbc7ad)";
  return <svg width="28" height="28" viewBox="0 0 48 48" fill="none" aria-hidden="true" focusable="false">
    <ellipse cx="24" cy="43" rx="17" ry="2.5" fill="var(--vc-soft-shadow, #795b3924)" />
    <g stroke={edge} strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
      {kind === "ball" && <>
        <circle cx="24" cy="24" r="17" fill={sage} />
        <path d="M12 12c15 3 24 14 20 27M9 30c12 1 25-5 30-16" stroke={cream} strokeWidth="2.3" />
        <path d="M15 13c3-2 6-3 10-3" stroke={cream} opacity=".6" />
      </>}
      {kind === "blocks" && <>
        <path d="m8 27 12-6 12 6-12 6Z" fill={cream} /><path d="M8 27v13l12 6V33Z" fill={sage} /><path d="M20 33v13l12-6V27Z" fill={linen} />
        <path d="m24 23 10-5 10 5-10 5Z" fill={cream} /><path d="M24 23v13l10 5V28Z" fill="#d8b4a1" /><path d="M34 28v13l10-5V23Z" fill={linen} />
        <path d="m11 10 11-6 11 6-11 6Z" fill={cream} /><path d="M11 10v13l11 6V16Z" fill="#dfcfa4" /><path d="M22 16v13l11-6V10Z" fill={sage} />
      </>}
      {kind === "paper-plane" && <>
        <path d="M4 21 44 6 31 42 23 28 13 34l1-10Z" fill={cream} />
        <path d="m14 24 30-18-21 22 8 14 3-21Z" fill={linen} />
        <path d="m23 28 21-22M13 34l10-6" />
        <path d="m8 21 9 2" stroke="var(--vc-wood-light, #dcc5a9)" />
      </>}
      {kind === "spool" && <>
        <ellipse cx="23" cy="35" rx="13" ry="5" fill={linen} />
        <path d="M13 14v20c0 5 20 5 20 0V14Z" fill={sage} />
        <path d="M14 19c4 3 14 3 18 0m-18 5c4 3 14 3 18 0m-18 5c4 3 14 3 18 0" stroke={cream} />
        <ellipse cx="23" cy="13" rx="13" ry="5" fill={cream} /><ellipse cx="23" cy="13" rx="4" ry="1.5" fill={linen} />
        <path d="M33 30c8 1 2 8 7 9 5 1 5-3 3-4" stroke={sage} strokeWidth="2" />
      </>}
    </g>
  </svg>;
}
