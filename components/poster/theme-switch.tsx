import { POSTER_THEMES, type PosterThemeKey } from "@/lib/domain/schedule-types";

// 꾸미기 툴바의 '달력 테마' 스위치 — 시청자(공개 포스터)는 안 보는 꾸미기 전용 조각.
// 모놀리식 public-poster에서 떼어내 점진적으로 꾸미기 UI를 분리(추후 툴바 통째 지연 로드 대비).
export function ThemeSwitch({
  posterTheme,
  onChange
}: {
  posterTheme: PosterThemeKey;
  onChange: (theme: string) => void;
}) {
  return (
    <div className="theme-switch" role="group" aria-label="달력 테마">
      {POSTER_THEMES.map((theme) => (
        <button
          aria-pressed={posterTheme === theme.key}
          className={posterTheme === theme.key ? "active" : ""}
          key={theme.key}
          onClick={() => onChange(theme.key)}
          type="button"
        >
          {theme.label}
        </button>
      ))}
    </div>
  );
}
