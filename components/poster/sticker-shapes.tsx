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
    case "diamond":
      return (
        <svg {...common}>
          <path d="M12 2l9 10-9 10-9-10z" fill={color} />
        </svg>
      );
    case "flower":
      return (
        <svg {...common}>
          <path
            d="M12 8.2a3.8 3.8 0 1 0 0 7.6 3.8 3.8 0 0 0 0-7.6zm0-7.2c1.5 0 2.6 1.45 2.27 2.96A3.8 3.8 0 0 1 19.5 7c.95 1.32.5 3.1-1 3.96C20.05 11.9 20.5 13.68 19.5 15a3.8 3.8 0 0 1-5.23 3.04C14.6 19.55 13.5 21 12 21s-2.6-1.45-2.27-2.96A3.8 3.8 0 0 1 4.5 15c-1-1.32-.55-3.1 1-3.96C3.95 10.1 3.5 8.32 4.5 7a3.8 3.8 0 0 1 5.23-3.04C9.4 2.45 10.5 1 12 1z"
            fill={color}
          />
        </svg>
      );
    case "cloud":
      return (
        <svg {...common}>
          <path
            d="M6.5 19a4.5 4.5 0 0 1-.7-8.95 5.5 5.5 0 0 1 10.74-1.2A4.25 4.25 0 0 1 17 19z"
            fill={color}
          />
        </svg>
      );
    case "moon":
      return (
        <svg {...common}>
          <path d="M14.5 2a10 10 0 1 0 7.5 16.2A8 8 0 0 1 14.5 2z" fill={color} />
        </svg>
      );
    case "lightning":
      return (
        <svg {...common}>
          <path d="M13.5 2L4 13.5h6L9 22l10.5-12.5H13z" fill={color} />
        </svg>
      );
    case "droplet":
      return (
        <svg {...common}>
          <path
            d="M12 2.3c4.2 5.2 6.8 8.4 6.8 11.4a6.8 6.8 0 1 1-13.6 0c0-3 2.6-6.2 6.8-11.4z"
            fill={color}
          />
        </svg>
      );
    case "burst":
      return (
        <svg {...common}>
          <path
            d="M12 1l2.2 4.9L19 4l-1.9 5L22 11l-4.9 2.1L19 18l-5-1.1L12 22l-2-5.1L5 18l1.9-4.9L2 11l4.9-2L5 4l4.8 1.9z"
            fill={color}
          />
        </svg>
      );
    case "pin":
      return (
        <svg {...common}>
          <path
            d="M12 2a7 7 0 0 0-7 7c0 5 7 13 7 13s7-8 7-13a7 7 0 0 0-7-7zm0 4.5A2.5 2.5 0 1 1 12 11.5 2.5 2.5 0 0 1 12 6.5z"
            fill={color}
          />
        </svg>
      );
    case "triangle":
      return (
        <svg {...common}>
          <path d="M12 3l9.5 16.5h-19z" fill={color} />
        </svg>
      );
    case "square":
      return (
        <svg {...common}>
          <rect x="3.5" y="3.5" width="17" height="17" rx="3.2" fill={color} />
        </svg>
      );
    case "hexagon":
      return (
        <svg {...common}>
          <path d="M12 2.5l8.5 4.75v9.5L12 21.5l-8.5-4.75v-9.5z" fill={color} />
        </svg>
      );
    case "pentagon":
      return (
        <svg {...common}>
          <path d="M12 2.5l9.5 6.9-3.63 11.1H6.13L2.5 9.4z" fill={color} />
        </svg>
      );
    case "crown":
      return (
        <svg {...common}>
          <path d="M2.5 7l4.2 3.4L12 4l5.3 6.4L21.5 7l-1.7 12H4.2z" fill={color} />
        </svg>
      );
    case "leaf":
      return (
        <svg {...common}>
          <path
            d="M4 20c-1-9 5-15 16-16 1 11-5 17-16 16zm3.2-2.2C13 17 17 13 18 7.6 12.6 8.6 8.6 12.6 7.2 17.8z"
            fill={color}
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
    case "cross":
      return (
        <svg {...common}>
          <path d="M9.4 2.5h5.2v6.9h6.9v5.2h-6.9v6.9H9.4v-6.9H2.5V9.4h6.9z" fill={color} />
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
