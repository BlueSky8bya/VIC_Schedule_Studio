import { artSlot, CATEGORY_KO, type ArtCategory } from "./manifest";

// Only fresh clipboard output uses current folder labels. Frozen manifest/request bytes stay intact.
// Match known workspace path forms, never runtime URLs, filenames, arbitrary prose or external URLs.
const DISPLAY_PATH = /(^|[\s`(<])art-src\/(?:reference\/([a-z]+|<범주>)\/|incoming-\*\/|<범주>\/<family>\/runs\/<run>\/raw(?=$|[\s`)>]))/g;

export function localizeArtPromptPaths(prompt: string): string {
  return prompt.replace(DISPLAY_PATH, (matched, prefix: string, category: string | undefined) => {
    if (category !== undefined) {
      const name = category === "<범주>" ? "<범주명>" : Object.hasOwn(CATEGORY_KO, category) ? CATEGORY_KO[category as ArtCategory] : null;
      return name ? `${prefix}art-src/공통화풍참고/` : matched;
    }
    if (matched.endsWith("incoming-*/")) {
      return `${prefix}art-src/${CATEGORY_KO.tree}/${artSlot("tree-pine")!.nameKo}/반려본/`;
    }
    return `${prefix}art-src/<범주명>/<엔티티명>/작업회차/<회차>/원본`;
  })
    .replaceAll("취향 참고(발상만)", "공통 분위기 참고(색감·구도만)")
    .replaceAll("취향 참고 폴더", "공통 분위기 참고 폴더")
    .replaceAll("소유자가 골라 둔 CC0 픽셀아트", "소유자가 모아 둔 분위기 이미지")
    .replaceAll("형태 발상 `art-src/공통화풍참고/`(발상만)", "공통 분위기 `art-src/공통화풍참고/`(색감·구도만)")
    .replaceAll("= **발상만.** 생김새·실루엣의\n     아이디어·부위가 앉은 모양 같은 **형태의 힌트**로만 쓴다.", "= **색감·구도 참고만.** 전체 분위기·색 조화·카메라·배치 감각만 본다. 대상의 생김새와 구조는 엔티티 레퍼런스에서 확인한다.");
}
