# 의존성 advisory 조건부 영향 — 2026-10-17

Plan: [PLAN-079](../plans/PLAN-20261017-079-platform-audit.md)
Status: Investigation complete; no dependency changes installed.

2026-10-17 확인. root가 수집한 `platform-079-npm-audit-production.json`/`platform-079-dependency-tree.json`, 설치된 코드, 저장소 라우트와 **유지관리자 공식 advisory/릴리스**만 대조. 설치·manifest/lockfile 수정·공격 재현·운영 요청 없음.

## 개수와 버전

- audit는 **high로 분류된 패키지 3개**(`next`, `sharp`, `source-map-js`)를 보고. **고유 advisory는 4개**: Next 직접2개 + sharp1개 + source-map-js1개. Next의 high는 sharp 의존 영향도 포함하며 Next 직접2개 자체는 moderate다. 취약점4개와 high3개를 합산해7개로 세지 않는다.
- 설치 트리: Next15.5.24 → PostCSS8.5.28 → source-map-js1.2.1, Next → sharp0.35.4(override). 별도로 dev Vite도 PostCSS8.5.15 → 동일 source-map-js1.2.1을 사용. production audit라고 source-map의 실제 공격 가능성이 곧 사용자 HTTP 경로에 있다는 뜻은 아니다.

| advisory | 공식 조건·patch | 이 프로젝트 연결과 판단 |
|---|---|---|
| GHSA-4jqv-mc3x-m676 | self-host + **Pages Router SSG/ISR** 조건. 유지관리자는 Vercel 배포 무영향을 명시. 15.5.27 보안 릴리스에 수정 포함. [공식 advisory](https://github.com/vercel/next.js/security/advisories/GHSA-4jqv-mc3x-m676), [15.5.27 릴리스](https://github.com/vercel/next.js/releases/tag/v15.5.27) | 현재 app/ App Router이며 pages/·src/pages/ 없음. root 운영 호스트는 Vercel. 따라서 현재 조사된 구조/호스팅에는 해당 조건이 맞지 않음. 패키지 범위 경고는 남아 있고 다른 호스팅/Pages 도입 때 재평가. |
| GHSA-mcj8-r9mp-w47p | root-level catch-all 페이지 + SSG/ISR가 함께 있을 때 shared response cache 오염. 15.5.27 수정. [공식 advisory](https://github.com/vercel/next.js/security/advisories/GHSA-mcj8-r9mp-w47p), [공식 릴리스](https://github.com/vercel/next.js/releases/tag/v15.5.27) | app/ 경로 인벤토리에 root `[...x]`/`[[...x]]` 없음. `app/replay/[date]`는 단일 매개변수이며 root catch-all이 아님. 저장소에 getStaticProps/getStaticPaths/generateStaticParams도 없음. `unstable_cache`나 API CDN TTL이 있다는 사실만으로 이 SSG/ISR 조건을 충족한다고 할 수 없음. 현재 공격 경로 확인되지 않음. |
| GHSA-wq5f-xc86-pv6w | librsvg 취약점. 특정 runtime 조건의 **glibc Linux SVG decode**에서 RCE 가능. sharp≥0.35.5(librsvg2.63.2) 권고, 전역 설치 librsvg도 별도 확인 필요. [공식 advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w), [0.35.5 릴리스](https://github.com/lovell/sharp/releases/tag/v0.35.5) | 앱/컴포넌트/lib에서 sharp 직접 import 없음. next/image는 premiere-scene.tsx:28,47, ambient-art-board.tsx:169,202,270, ambient-art-slot.tsx:82,138의7개 Image에서 쓰며 모두 unoptimized다. next.config.ts는 SVG 허용 옵션 없음. 설치된 Next `image-config.js:62` default false, `image-optimizer.js:981–985`는 SVG를400으로 거부. 반면 scripts/ 아트 파이프라인에는 sharp 직접 사용 존재(`ambient-art-normalize.mjs:20,109–142`, `ambient-ref-fetch-all.mjs:24,125–127`). 도구 입력 MIME 제한이 native decoder의 모든 형식 우회를 증명하지는 않음. 실제 Linux/Vercel Node PIE·librsvg binary·공격자 제공 SVG decode 여부 미검증. package override0.35.4는 patch를 막으므로 계획된 수정 필요. |
| GHSA-68fv-2mgg-jv7q | 악의적인 indexed source map을 처리할 때 offset/중첩 map의 증폭으로 CPU/메모리 DoS. 1.2.2 수정. [유지관리자 릴리스](https://github.com/7rulnik/source-map-js/releases/tag/v1.2.2), [유지관리자 수정 PR79](https://github.com/7rulnik/source-map-js/pull/79) | 설치 PostCSS의 `lib/previous-map.js:42–44`, `map-generator.js:47–58,110`에서 실제 SourceMapConsumer/Generator 사용. 앱/lib/scripts에 사용자가 보낸 `.map`을 이 API로 넘기는 endpoint는 찾지 못함. 주로 빌드·도구의 map 입력 신뢰 경계 후보. 원격 runtime 무영향을 증명한 것은 아님. lock의1.2.1을 patch하여 production/dev 중복 경로를 함께 확인할 것. |

## 권장 최소 수정 계획

1. 현 15.x를 유지하면서 Next **15.5.27 이상 같은 유지보수 계열 patch**, eslint-config-next도 맞춰 검사. major16 전환까지 필요한 증거 없음.
2. sharp override **0.35.5 이상**으로 바꾸고 실제 optional binary/libvips/librsvg를 lock·배포 설치 결과에서 확인. 임시 SVG 차단만으로 향후 전체 의존성 경고를 완료 처리하지 말 것.
3. source-map-js **1.2.2 이상**으로 실제 resolution 갱신. 기존 PostCSS8.5.28 override를 되돌릴 이유 없음. Next/PostCSS와 dev Vite/PostCSS 두 경로에서1.2.1이 남지 않는지 확인.
4. 변경 후 새 `npm audit --omit=dev`, `npm ls next sharp postcss source-map-js`, typecheck/lint/build + 해당 UI/아트 pipeline smoke. audit0은 알려진 advisory 범위 검사이며 무취약/과거 침해 없음 증명은 아님.

이 lane은 변경하지 않았다. 현재 설치 패키지 취약 범위는 확인됐지만 **네 advisory 모두 현 운영에서 악용 가능하다고 확인한 것은 아니다.** 조건부 영향과 별개로 작은 유지보수 patch를 우선 검토하는 것이 타당하다.
