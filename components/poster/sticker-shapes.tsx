import type { CSSProperties } from "react";

// 꾸미기 화려함 P2: 데코 도형 스티커 렌더(데이터·검증은 lib/domain/schedule-types).
// 재채색 가능한 인라인 SVG 프리셋 — 회전·리사이즈·투명도·레이어·움직임은 기존 스티커 엔진 그대로 씀.
// fill만 쓰는 단순 도형이라 회전/리사이즈/캡쳐(정적)에 모두 안전하다.
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
  switch (shapeKey) {
    case "circle":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10.5" fill={color} />
        </svg>
      );
    case "tape":
      return (
        <svg {...common}>
          <rect x="0.5" y="7" width="23" height="10" rx="1.4" fill={color} />
        </svg>
      );
    case "star":
      return (
        <svg {...common}>
          <path
            d="M12 2l2.92 6.26 6.88.99-4.98 4.85 1.18 6.86L12 17.77l-6.18 3.25 1.18-6.86L2.02 9.25l6.88-.99z"
            fill={color}
          />
        </svg>
      );
    case "sparkle":
      return (
        <svg {...common}>
          <path
            d="M12 1.5c.7 5.3 2.7 7.3 8 8-5.3.7-7.3 2.7-8 8-.7-5.3-2.7-7.3-8-8 5.3-.7 7.3-2.7 8-8z"
            fill={color}
          />
        </svg>
      );
    case "bubble":
      return (
        <svg {...common}>
          <path
            d="M4 3h16c1.1 0 2 .9 2 2v9c0 1.1-.9 2-2 2h-7l-5 4.2V16H4c-1.1 0-2-.9-2-2V5c0-1.1.9-2 2-2z"
            fill={color}
          />
        </svg>
      );
    case "ribbon":
      return (
        <svg {...common}>
          <path d="M3 4h13l5 8-5 8H3l3.5-8z" fill={color} />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M2 9.2h11V4.5L22 12l-9 7.5V14.8H2z" fill={color} />
        </svg>
      );
    case "heart":
    default:
      return (
        <svg {...common}>
          <path
            d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54z"
            fill={color}
          />
        </svg>
      );
  }
}
