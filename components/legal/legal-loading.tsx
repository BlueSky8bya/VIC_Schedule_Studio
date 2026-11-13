import { ToriHopLoading } from "@/components/shared/tori-hop";
import styles from "./legal-doc.module.css";

/** 문서로 가는 동안 — 문서 바탕 위에 뛰는 토리 + "{label} 불러오는 중…"(편집실·일정표 로딩과 같은 한 벌).
 *  문서 본문(legal-doc.tsx)과 따로 둔 까닭: 루트 로딩의 클라이언트 조각(route-loading.tsx)도 이걸 쓰는데, 본문 파일은 문의 창 등
 *  움직이는 조각을 끌고 와 첫 화면 묶음이 커진다. */
export function LegalLoading({ label }: { label: string }) {
  return (
    <main className={styles.page}>
      <ToriHopLoading className={styles.loading} label={label} />
    </main>
  );
}
