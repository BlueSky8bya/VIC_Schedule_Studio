import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { ContactButton } from "./legal-interactive";

// 일정표 맨 아래 한 줄 — 개인정보처리방침·이용약관·사이트 제보. 공개 포스터(PC 달력·폰 목록) 공용.
// 내보내기 표면(data-export-surface) 밖에 두어 캡처에는 들어가지 않는다.
// end: 같은 줄 오른쪽 끝에 붙일 도구(개발자의 무대 리허설) — 링크와 높이를 맞춘 한 줄로 보이게.
export function SiteLegalFooter({ end }: { end?: ReactNode }) {
  return (
    <footer className="site-legal-footer">
      {/* 왼쪽 끝 — 사이트 제보(둥근 로고 + 두 줄). 오른쪽 끝의 무대 리허설과 같은 높이(2026-11-13 소유자). */}
      <div className="site-legal-start">
        <ContactButton variant="pill" />
      </div>
      <nav aria-label="약관 및 정책" className="site-legal-links">
        <Link data-act="footer-privacy" href={"/privacy" as Route}>
          개인정보처리방침
        </Link>
        <span aria-hidden="true">·</span>
        <Link data-act="footer-terms" href={"/terms" as Route}>
          이용약관
        </Link>
        <span aria-hidden="true" className="site-legal-mobile">·</span>
        {/* 폰에서는 왼쪽 알약 대신 글자 단추 — 같은 제보 창 */}
        <span className="site-legal-mobile">
          <ContactButton variant="link" />
        </span>
      </nav>
      {end ? <div className="site-legal-end">{end}</div> : null}
    </footer>
  );
}
