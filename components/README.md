# components/ — UI 컴포넌트 라우팅

> 폴더=기능 영역. 큰 파일(특히 `studio/studio-shell.tsx`, `poster/public-poster.tsx`)은
> 통째로 읽기 전에 **무엇이 어디 있는지** 아래로 먼저 가늠하라.

| 폴더 | 내용 | 핵심 파일 |
|---|---|---|
| `studio/` | ⭐ 편집실 전체 | `studio-shell.tsx`(메인·거대)+`.css`, `member-insights`, `security-panel`, `stack-trend-chart`, `highlight-cards`, `datetime-picker` |
| `poster/` | ⭐ 시청자 포스터·꾸미기·스티커 | `public-poster.tsx`(+`.css`), `decorate-palette`, `sticker-layer`, `sticker-shapes`, `soop-live-beacon`, `theme-switch` |
| `developer/` | 개발자 진단 | 인사이트 대시보드, 역할 미리보기, 방문 모달 |
| `tags/` | 태그 범례·편집기 | |
| `trusted-members/` | 신뢰 멤버 패널 | |
| `private-layer/` | 비공개 레이어 패널 | |
| `presence/` | 접속 비콘 | |
| `auth/` | 인앱 브라우저 안내 등 | |
| `notice/` | 공지/안내 | |
| `seasonal/` | 월드컵 공놀이 미니게임(시각 토이) | |
| `skeleton/` | 로딩 스켈레톤 | |
| `pwa/` | PWA 설치/서비스워커 | |
| `ui/` | 공용 소형 컴포넌트 | |

디자인 토큰은 `app/globals.css :root` 단일 출처. 새 UI는 그 토큰(`--space-*`/`--r-*`/`--shadow-*`)을 쓸 것.
