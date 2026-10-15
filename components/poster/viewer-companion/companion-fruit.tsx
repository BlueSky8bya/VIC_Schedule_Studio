import type { CompanionFood } from "@/lib/ui/viewer-companion/brain";

/** Shared, deterministic paper-toy snacks, independent of the OS emoji font. */
export function CompanionFruit({ kind }: { kind: CompanionFood["kind"] }) {
  return <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" className="vc-fruit">
    <ellipse cx="20" cy="36" rx="11" ry="2" fill="#737b69" opacity=".16" />
    {kind === "apple" ? <>
      <path d="M21 13c-1-5 0-8 2-10" fill="none" stroke="#83745b" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 9c1-5 6-5 9-4-1 5-6 6-9 4Z" fill="#bdce9b" stroke="#7f9b78" />
      <path d="M20 13c-12-8-19 7-11 18 3 5 7 5 11 3 5 2 8 2 11-3 8-11 1-26-11-18Z" fill="#d99d91" stroke="#ad7e76" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12 16c-3 2-4 6-3 9" fill="none" stroke="#f8e2c9" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M26 30c-2 2-3 2-5 2" fill="none" stroke="#b78277" strokeLinecap="round" />
    </> : <>
      <path d="M28 10c0-4 4-6 7-5-1 4-4 6-7 5Z" fill="#bdce9b" stroke="#7f9b78" />
      <path d="M7 28C1 21 12 8 23 9c4-3 7-1 7 3 9 7-2 23-15 22-5 3-8 0-8-6Z" fill="#e9d589" stroke="#bba96b" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M11 20c3-5 7-7 11-7" fill="none" stroke="#fff5cf" strokeWidth="2.5" strokeLinecap="round" />
      <path d="m26 26-1 1m-7 3-1 .5m12-10-.5 1" fill="none" stroke="#c8b66f" strokeLinecap="round" />
    </>}
  </svg>;
}
