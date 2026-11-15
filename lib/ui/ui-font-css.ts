// 설정 '글꼴'의 구글 글꼴 — 고른 사람만 그 글꼴의 선언 CSS를 받는다(2026-11-16).
// 전에는 루트 레이아웃이 next/font로 15종을 다 불러, 고르지도 않은 글꼴의 @font-face 선언(압축 후 약 360KB)이
// 모든 화면의 첫 그리기를 막았다(KT 회선이 미국 엣지를 타 초당 0.1MB일 때 수 초). next/font는 동적 import로 옮겨도
// Next가 그 CSS를 첫 화면에 끌어올려 쓸 수 없었다 → 같은 글꼴의 Fontsource 묶음(구글 글꼴과 같은 파일·글자 범위 쪼갬)을
// app/fonts.css의 눈누 글꼴처럼 jsDelivr에서 받는다. 버전은 고정(바뀌지 않는 주소 = 1년 캐시).
// 글꼴 이름(family)은 font-prefs.ts FONT_OPTIONS의 목록 첫 이름과 같아야 한다.

const CDN = "https://cdn.jsdelivr.net/npm/";

export const UI_FONT_CSS: Record<string, readonly string[]> = {
  noto: ["@fontsource-variable/noto-sans-kr@5.3.1/index.css"],
  nanumgothic: ["400", "700", "800"].map((w) => `@fontsource/nanum-gothic@5.3.0/${w}.css`),
  plex: ["400", "500", "600", "700"].map((w) => `@fontsource/ibm-plex-sans-kr@5.3.0/${w}.css`),
  gowun: ["@fontsource/gowun-dodum@5.3.0/400.css"],
  sunflower: ["300", "500", "700"].map((w) => `@fontsource/sunflower@5.3.1/${w}.css`),
  myeongjo: ["400", "700", "800"].map((w) => `@fontsource/nanum-myeongjo@5.3.0/${w}.css`),
  gowunbatang: ["400", "700"].map((w) => `@fontsource/gowun-batang@5.3.0/${w}.css`),
  gamja: ["@fontsource/gamja-flower@5.3.0/400.css"]
};

const attached = new Map<string, Promise<void>>();

/** 이 글꼴이 따로 받는 선언 CSS를 쓰는지(구글 글꼴). */
export function needsUiFontCss(id: string): boolean {
  return Object.prototype.hasOwnProperty.call(UI_FONT_CSS, id);
}

function linkSheet(href: string): Promise<void> {
  const existing = document.head.querySelector<HTMLLinkElement>(`link[data-ui-font="${href}"]`);
  if (existing?.sheet) return Promise.resolve();
  existing?.remove(); // 지난번에 실패한 것 — 새로 단다.
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    // 선언을 읽어 실패한 글꼴만 다시 받는 재시도(lib/ui/font-loading)가 cssRules를 읽을 수 있게.
    link.crossOrigin = "anonymous";
    link.dataset.uiFont = href;
    link.onload = () => resolve();
    link.onerror = () => {
      link.remove();
      reject(Error("font-css-unavailable"));
    };
    document.head.appendChild(link);
  });
}

/** 고른 글꼴의 선언 CSS를 단다. 실패하면 다음 호출에서 다시 받는다. */
export function attachUiFontCss(id: string): Promise<void> {
  const files = UI_FONT_CSS[id];
  if (!files) return Promise.resolve();
  const running = attached.get(id);
  if (running) return running;
  const work = Promise.all(files.map((f) => linkSheet(CDN + f))).then(
    () => undefined,
    (error: unknown) => {
      attached.delete(id);
      throw error;
    }
  );
  attached.set(id, work);
  return work;
}
