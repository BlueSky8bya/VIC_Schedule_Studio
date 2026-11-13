import type { Route } from "next";
import Link from "next/link";

// 일정표 맨 아래 한 줄 — 개인정보처리방침·이용약관. 공개 포스터(PC 달력·폰 목록) 공용.
// 내보내기 표면(data-export-surface) 밖에 두어 캡처에는 들어가지 않는다.
export function SiteLegalFooter() {
  return (
    <footer className="site-legal-footer">
      <Link data-act="footer-privacy" href={"/privacy" as Route}>
        개인정보처리방침
      </Link>
      <span aria-hidden="true">·</span>
      <Link data-act="footer-terms" href={"/terms" as Route}>
        이용약관
      </Link>
    </footer>
  );
}
