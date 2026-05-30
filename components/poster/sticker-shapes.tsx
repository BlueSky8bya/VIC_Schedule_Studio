import type { CSSProperties } from "react";

// 꾸미기 화려함 P2: 데코 도형 스티커 렌더(데이터·검증은 lib/domain/schedule-types).
// 재채색 가능한 인라인 SVG 프리셋 — 회전·리사이즈·투명도·레이어·움직임은 기존 스티커 엔진 그대로 씀.
// 대부분 fill만 쓰는 단순 도형이라 회전/리사이즈/캡쳐(정적)에 모두 안전하다.

// 정다각형/별은 좌표를 계산해 path로 만든다(손으로 그리다 어긋나는 일 없이 N종을 정확히 추가).
function regularPolygon(sides: number, r = 10.6, cx = 12, cy = 12, rotDeg = -90): string {
  const rot = (rotDeg * Math.PI) / 180;
  let d = "";
  for (let i = 0; i < sides; i += 1) {
    const a = rot + (i * 2 * Math.PI) / sides;
    d += `${i === 0 ? "M" : "L"}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
}
function starPolygon(points: number, outer = 10.8, inner = 4.6, cx = 12, cy = 12, rotDeg = -90): string {
  const rot = (rotDeg * Math.PI) / 180;
  let d = "";
  for (let i = 0; i < points * 2; i += 1) {
    const r = i % 2 === 0 ? outer : inner;
    const a = rot + (i * Math.PI) / points;
    d += `${i === 0 ? "M" : "L"}${(cx + r * Math.cos(a)).toFixed(2)} ${(cy + r * Math.sin(a)).toFixed(2)}`;
  }
  return `${d}Z`;
}

// 단일 <path fill> 으로 그리는 도형들(채움 규칙=기본 nonzero). 특수(원·테이프·구멍 뚫림·여러 요소)는
// 아래 switch에서 따로 그린다.
const PATHS: Record<string, string> = {
  heart:
    "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z",
  star: starPolygon(5, 10.8, 4.6),
  star4: starPolygon(4, 11, 3.6),
  star6: starPolygon(6, 11, 5),
  star8: starPolygon(8, 11, 5.4),
  star12: starPolygon(12, 11, 7.4),
  sparkle:
    "M12 1.5c.7 5.3 2.7 7.3 8 8-5.3.7-7.3 2.7-8 8-.7-5.3-2.7-7.3-8-8 5.3-.7 7.3-2.7 8-8z",
  burst:
    "M12 1l2.2 4.9L19 4l-1.9 5L22 11l-4.9 2.1L19 18l-5-1.1L12 22l-2-5.1L5 18l1.9-4.9L2 11l4.9-2L5 4l4.8 1.9z",
  triangle: regularPolygon(3),
  diamond: "M12 2l9 10-9 10-9-10z",
  pentagon: regularPolygon(5),
  hexagon: regularPolygon(6),
  heptagon: regularPolygon(7),
  octagon: regularPolygon(8),
  trapezoid: "M6.5 5.5h11l3 13H3.5z",
  parallelogram: "M7.5 5.5h13l-4 13H3.5z",
  semicircle: "M2.5 14.5a9.5 9.5 0 0 1 19 0z",
  arrow: "M2 9.2h11V4.5L22 12l-9 7.5V14.8H2z",
  arrowleft: "M2.5 12l9-8v4.5h10v7h-10V20z",
  arrowup: "M12 2.5l8 9h-4.5v10h-7v-10H4z",
  arrowdown: "M12 21.5l-8-9h4.5v-10h7v10H20z",
  chevron: "M7 3l9 9-9 9-3-3 6-6-6-6z",
  check: "M9.5 16.2L5.3 12l-2.1 2.1 6.3 6.3L21.3 8.6l-2.1-2.1z",
  xmark:
    "M6.4 4.3L4.3 6.4 9.9 12l-5.6 5.6 2.1 2.1L12 14.1l5.6 5.6 2.1-2.1L14.1 12l5.6-5.6-2.1-2.1L12 9.9z",
  cross: "M9.4 2.5h5.2v6.9h6.9v5.2h-6.9v6.9H9.4v-6.9H2.5V9.4h6.9z",
  crown: "M2.5 7l4.2 3.4L12 4l5.3 6.4L21.5 7l-1.7 12H4.2z",
  gem: "M7 3h10l4 5.5-9 12.5L3 8.5z",
  shield: "M12 2.2l8 2.8v6.4c0 5-3.4 8.8-8 10.6-4.6-1.8-8-5.6-8-10.6V5z",
  bell:
    "M12 2.3a1.7 1.7 0 0 1 1.7 1.7v.4c2.5.8 3.6 3.1 3.6 5.6 0 3.8 1 5.2 2.2 6.5H4.5c1.2-1.3 2.2-2.7 2.2-6.5 0-2.5 1.1-4.8 3.6-5.6V4a1.7 1.7 0 0 1 1.7-1.7zM9.8 18.5h4.4a2.2 2.2 0 0 1-4.4 0z",
  gift:
    "M4 12h16v8.5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM3 8.5h18v3.5H3zM11 8.5h2V21.5h-2zM11.8 8.3C11.8 5.8 10.8 4.1 9.2 4.1 8 4.1 7.4 5 7.4 5.9c0 1.4 1.6 2.4 4.4 2.4zM12.2 8.3C12.2 5.8 13.2 4.1 14.8 4.1 16 4.1 16.6 5 16.6 5.9c0 1.4-1.6 2.4-4.4 2.4z",
  balloon:
    "M12 2.2c-3.6 0-6.3 2.8-6.3 6.6 0 3.9 3.4 6.8 5.3 7.6l-.9 1.4h3.8l-.9-1.4c1.9-.8 5.3-3.7 5.3-7.6 0-3.8-2.7-6.6-6.3-6.6z",
  bulb:
    "M12 2.5a6.5 6.5 0 0 0-3.8 11.8c.5.4.8.9.8 1.5v.7h6v-.7c0-.6.3-1.1.8-1.5A6.5 6.5 0 0 0 12 2.5zM9 18h6v1.2a1 1 0 0 1-1 1h-.4l-.3.8h-2.6l-.3-.8H10a1 1 0 0 1-1-1z",
  bookmark: "M6 2.5h12v19l-6-4.2-6 4.2z",
  pin: "M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 4.5A2.5 2.5 0 1 1 12 11.5 2.5 2.5 0 0 1 12 6.5z",
  ribbon: "M3 4h13l5 8-5 8H3l3.5-8z",
  bubble:
    "M4 3h16c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2h-7l-5 4.2V16H4c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2z",
  flower:
    "M12 7.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0-6.5c1.66 0 2.9 1.62 2.5 3.3A4.5 4.5 0 0 1 20 7.5c1 1.45.5 3.43-1.1 4.5C20.5 13.07 21 15.05 20 16.5a4.5 4.5 0 0 1-5.5 3.2c.4 1.68-.84 3.3-2.5 3.3s-2.9-1.62-2.5-3.3A4.5 4.5 0 0 1 4 16.5c-1-1.45-.5-3.43 1.1-4.5C3.5 10.93 3 8.95 4 7.5a4.5 4.5 0 0 1 5.5-3.2C9.1 2.62 10.34 1 12 1z",
  leaf:
    "M4 20c-1-9 5-15 16-16 1 11-5 17-16 16zm3.2-2.2C13 17 17 13 18 7.6 12.6 8.6 8.6 12.6 7.2 17.8z",
  mushroom:
    "M3.5 11a8.5 6.5 0 0 1 17 0zM9.3 11h5.4v6.5a2.7 2.7 0 0 1-5.4 0z",
  cloud:
    "M6.5 19a4.5 4.5 0 0 1-.7-8.95 5.5 5.5 0 0 1 10.74-1.2A4.25 4.25 0 0 1 17 19z",
  moon: "M14.5 2a10 10 0 1 0 7.5 16.2A8 8 0 0 1 14.5 2z",
  lightning: "M13.5 2L4 13.5h6L9 22l10.5-12.5H13z",
  droplet:
    "M12 2.3c4.2 5.2 6.8 8.4 6.8 11.4a6.8 6.8 0 1 1-13.6 0c0-3 2.6-6.2 6.8-11.4z",
  flame:
    "M12 2.2c.4 2.8 2 4 3.2 5.4 1 1.2 1.8 2.6 1.8 4.6a5 5 0 0 1-10 0c0-1.3.5-2.5 1.3-3.4-.1 1.4.7 2.3 1.7 2.4 1.1.1 1.9-.8 1.6-2.2C12.9 6.6 12.3 4.3 12 2.2z",
  ghost:
    "M5 11.5a7 7 0 0 1 14 0V21l-2.3-1.7-2.3 1.7-2.4-1.8L9.6 21 7.3 19.3 5 21z"
};

export function ShapeSvg({
  shapeKey,
  color,
  className,
  style
}: {
  shapeKey: string;
  color: string;
  className?: string;
  style?: CSSProperties;
}) {
  const common = {
    className,
    style,
    viewBox: "0 0 24 24",
    "aria-hidden": true as const,
    focusable: false as const
  };

  // 특수 도형: 원/타원/사각/테이프(요소 사용), 구멍 뚫림(evenodd), 선·여러 요소.
  switch (shapeKey) {
    case "circle":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10.5" fill={color} />
        </svg>
      );
    case "oval":
      return (
        <svg {...common}>
          <ellipse cx="12" cy="12" rx="10.5" ry="7.5" fill={color} />
        </svg>
      );
    case "square":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="3.4" fill={color} />
        </svg>
      );
    case "tape":
      return (
        <svg {...common}>
          <rect x="0.5" y="7" width="23" height="10" rx="1.4" fill={color} />
        </svg>
      );
    case "ring":
      return (
        <svg {...common}>
          <path
            d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zm0 5.5a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9z"
            fill={color}
            fillRule="evenodd"
          />
        </svg>
      );
    case "tag":
      return (
        <svg {...common}>
          <path
            d="M3.2 10.6 10.6 3.2H20v9.4l-7.4 7.4zM16.3 6.2a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3z"
            fill={color}
            fillRule="evenodd"
          />
        </svg>
      );
    case "flag":
      return (
        <svg {...common}>
          <path d="M5 2.5v19" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
          <path d="M6.2 3.4h13l-3 4.3 3 4.3h-13z" fill={color} />
        </svg>
      );
    case "sun":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="5" fill={color} />
          <g stroke={color} strokeWidth="2.1" strokeLinecap="round">
            <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.4 4.4l2.1 2.1M17.5 17.5l2.1 2.1M19.6 4.4l-2.1 2.1M6.5 17.5l-2.1 2.1" />
          </g>
        </svg>
      );
    case "paw":
      return (
        <svg {...common}>
          <ellipse cx="6.2" cy="11" rx="2.1" ry="2.6" fill={color} />
          <ellipse cx="17.8" cy="11" rx="2.1" ry="2.6" fill={color} />
          <ellipse cx="9.6" cy="7.2" rx="2" ry="2.5" fill={color} />
          <ellipse cx="14.4" cy="7.2" rx="2" ry="2.5" fill={color} />
          <path
            d="M12 12.3c2.8 0 5 1.9 5 4.2 0 1.9-1.7 2.8-3.4 2.8-.7 0-1-.3-1.6-.3s-.9.3-1.6.3C8.7 19.3 7 18.4 7 16.5c0-2.3 2.2-4.2 5-4.2z"
            fill={color}
          />
        </svg>
      );
    default: {
      const d = PATHS[shapeKey] ?? PATHS.heart;
      return (
        <svg {...common}>
          <path d={d} fill={color} />
        </svg>
      );
    }
  }
}
