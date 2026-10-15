import type { CompanionFoodKind } from "@/lib/ui/viewer-companion/snacks";

const leaf = <path d="M22 9c1-5 6-5 9-4-1 5-6 6-9 4Z" fill="#bdce9b" stroke="#7f9b78" />;
const stem = <path d="M20 13c-1-5 0-8 2-10" fill="none" stroke="#83745b" strokeWidth="2" strokeLinecap="round" />;
const shine = <path d="M12 16c-3 2-4 6-3 9" fill="none" stroke="#f8e2c9" strokeWidth="2.5" strokeLinecap="round" />;

function ExtraFruit({ kind }: { kind: Exclude<CompanionFoodKind, "apple" | "lemon"> }) {
  switch (kind) {
    case "strawberry": return <>
      <path d="M20 12C4 5 3 21 12 31c5 6 11 6 16 0 9-10 8-26-8-19Z" fill="#d9918f" stroke="#ad7677" strokeWidth="1.4" />
      <path d="m20 5 3 6 8-1-6 5-5-2-5 2-6-5 8 1Z" fill="#b1c69b" stroke="#7e9d78" strokeLinejoin="round" />
      {[[-6, 1], [3, 0], [-3, 7], [6, 7], [1, 14]].map(([x, y], i) => <ellipse key={i} cx={20 + x} cy={16 + y} rx=".9" ry="1.3" fill="#f9e2b3" transform={`rotate(-14 ${20 + x} ${16 + y})`} />)}
      <path d="M11 17c-1 2-1 4 0 6" fill="none" stroke="#f4d6c7" strokeWidth="2" strokeLinecap="round" />
    </>;
    case "raspberry": return <>
      <path d="m20 6 3 5 6-1-4 5H15l-4-5 6 1Z" fill="#b1c69b" stroke="#7e9d78" />
      {[[13, 16], [20, 14], [27, 16], [10, 23], [17, 22], [24, 22], [30, 23], [14, 29], [22, 29], [26, 29], [20, 34]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="4.7" fill={i % 3 ? "#c98b98" : "#da9ca4"} stroke="#a96f83" strokeWidth="1.1" />)}
      <path d="M10 16h2m6-3h2" stroke="#efd5d1" strokeWidth="1.7" strokeLinecap="round" />
    </>;
    case "watermelon": return <>
      <path d="M4 13Q20 51 36 13Z" fill="#a9c59a" stroke="#77986f" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M7 13Q20 43 33 13Z" fill="#f4e7c6" stroke="#d4d8ad" />
      <path d="M9 13Q20 37 31 13Z" fill="#de9a96" stroke="#bd817e" />
      <path d="m15 16 1 2m8-2-.5 2m-4 3 .5 2" stroke="#92766d" strokeWidth="1.5" strokeLinecap="round" />
      <path d="m10 14 6 1" stroke="#f4d4bf" strokeWidth="1.7" strokeLinecap="round" />
    </>;
    case "tomato": return <>
      <path d="M20 11C3 8 1 29 12 34c6 3 18 2 21-6 4-12-4-21-13-17Z" fill="#dc9b88" stroke="#b37c70" strokeWidth="1.4" />
      <path d="m20 7 3 5 7-1-4 4 1 4-7-3-7 3 1-4-4-4 7 1Z" fill="#a9c28c" stroke="#7e9c73" strokeLinejoin="round" />
      <path d="M11 19c-2 2-2 5-1 7" fill="none" stroke="#f6d5b9" strokeWidth="2.5" strokeLinecap="round" />
    </>;
    case "grapefruit": return <>
      <circle cx="20" cy="22" r="15" fill="#e6b997" stroke="#bd967c" strokeWidth="1.4" />
      <circle cx="20" cy="22" r="12.4" fill="#f8e5c8" />
      <circle cx="20" cy="22" r="10.6" fill="#da9a98" stroke="#c58c89" />
      {Array.from({ length: 8 }, (_, i) => <path key={i} d="M20 22v-10" transform={`rotate(${i * 45} 20 22)`} stroke="#fae5c9" strokeWidth="1.6" strokeLinecap="round" />)}
      <circle cx="20" cy="22" r="2" fill="#fae5c9" />
    </>;
    case "peach": return <>{stem}{leaf}
      <path d="M20 12C4 4 0 25 11 33c5 4 9 3 10 1 3 3 8 0 11-5 9-14-2-26-12-17Z" fill="#e7b2a1" stroke="#bd9288" strokeWidth="1.4" />
      <path d="M21 14c-3 7-4 15-1 20" fill="none" stroke="#cf9c93" strokeWidth="1.3" strokeLinecap="round" />{shine}
    </>;
    case "plum": return <>{stem}{leaf}
      <path d="M20 11C4 6 2 27 12 34c5 4 11 3 15-2 12-12 5-26-7-21Z" fill="#afa0bf" stroke="#897d9c" strokeWidth="1.4" />
      <path d="M24 13c-5 6-6 14-4 21" fill="none" stroke="#9786ac" strokeWidth="1.2" />
      <path d="M11 17c-2 3-2 6-1 9" fill="none" stroke="#ded7df" strokeWidth="2.5" strokeLinecap="round" />
    </>;
    case "orange": return <>{stem}{leaf}
      <circle cx="20" cy="23" r="13" fill="#e6ba86" stroke="#b9956f" strokeWidth="1.4" />
      <path d="M12 16c-3 3-4 6-3 9" fill="none" stroke="#fae4b8" strokeWidth="2.5" strokeLinecap="round" />
      <path d="m27 23 .1.1m-3 7 .1.1m5-2 .1.1" stroke="#caa06e" strokeWidth="1.5" strokeLinecap="round" />
    </>;
    case "persimmon": return <>
      <path d="M20 13C4 7 1 21 8 31c4 5 20 6 24-2 7-14 1-21-12-16Z" fill="#deb083" stroke="#b28b6d" strokeWidth="1.4" />
      <path d="m20 7 4 5 7-1-4 6-7-2-7 2-4-6 7 1Z" fill="#b2bf91" stroke="#82996e" strokeLinejoin="round" />
      <path d="M10 20c-1 3 0 6 1 8" fill="none" stroke="#f6d5ac" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M21 18v14" stroke="#cb9c77" strokeWidth="1" opacity=".6" />
    </>;
    case "apricot": return <>{stem}{leaf}
      <path d="M20 12C5 9 2 27 12 34c8 6 22-1 21-12 0-8-5-13-13-10Z" fill="#e6bea1" stroke="#b99a82" strokeWidth="1.4" />
      <path d="M21 14c-4 6-5 14-2 20" fill="none" stroke="#d0a68c" strokeWidth="1.2" />{shine}
    </>;
    case "pear": return <>{stem}{leaf}
      <path d="M20 10c-7 0-5 8-9 13C-1 38 36 42 32 27c-2-7-6-8-6-12 0-3-2-5-6-5Z" fill="#d8d2a4" stroke="#aaa883" strokeWidth="1.4" />
      <path d="M14 22c-3 3-4 6-2 9" fill="none" stroke="#f5edcf" strokeWidth="2.5" strokeLinecap="round" />
      <path d="m24 25 .1.1m3 5 .1.1m-8 2 .1.1" stroke="#b6b08b" strokeWidth="1.5" strokeLinecap="round" />
    </>;
  }
}

/** Shared, deterministic paper-toy snacks, independent of the OS emoji font. */
export function CompanionFruit({ kind }: { kind: CompanionFoodKind }) {
  return <svg viewBox="0 0 40 40" aria-hidden="true" focusable="false" className="vc-fruit">
    <ellipse cx="20" cy="36" rx="11" ry="2" fill="#737b69" opacity=".16" />
    {kind === "apple" ? <>
      <path d="M21 13c-1-5 0-8 2-10" fill="none" stroke="#83745b" strokeWidth="2" strokeLinecap="round" />
      <path d="M22 9c1-5 6-5 9-4-1 5-6 6-9 4Z" fill="#bdce9b" stroke="#7f9b78" />
      <path d="M20 13c-12-8-19 7-11 18 3 5 7 5 11 3 5 2 8 2 11-3 8-11 1-26-11-18Z" fill="#d99d91" stroke="#ad7e76" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12 16c-3 2-4 6-3 9" fill="none" stroke="#f8e2c9" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M26 30c-2 2-3 2-5 2" fill="none" stroke="#b78277" strokeLinecap="round" />
    </> : kind === "lemon" ? <>
      <path d="M28 10c0-4 4-6 7-5-1 4-4 6-7 5Z" fill="#bdce9b" stroke="#7f9b78" />
      <path d="M7 28C1 21 12 8 23 9c4-3 7-1 7 3 9 7-2 23-15 22-5 3-8 0-8-6Z" fill="#e9d589" stroke="#bba96b" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M11 20c3-5 7-7 11-7" fill="none" stroke="#fff5cf" strokeWidth="2.5" strokeLinecap="round" />
      <path d="m26 26-1 1m-7 3-1 .5m12-10-.5 1" fill="none" stroke="#c8b66f" strokeLinecap="round" />
    </> : <ExtraFruit kind={kind} />}
  </svg>;
}
