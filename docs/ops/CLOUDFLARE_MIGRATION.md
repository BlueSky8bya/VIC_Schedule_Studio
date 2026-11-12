# Vercel → Cloudflare Workers 이전 (2026-11-13)

계기: Vercel Hobby가 Fluid Active CPU 4h 초과로 팀 전체 배포를 2026-12-13까지 정지. 개발자(blackspace) 결정: Pro 대신 Cloudflare Workers Paid(월 5달러) + 새 도메인 `victory-broadcast.com`, 앞으로 Vercel 미사용.

## 구성

- 어댑터: `@opennextjs/cloudflare` (`open-next.config.ts`), 진입점 `cloudflare/worker.ts`(Next 핸들러 + Cron Trigger), 설정 `wrangler.jsonc`.
- 캐시: R2 `vic-schedule-studio-cache`(incremental), D1 `vic-schedule-studio-tags`(revalidatePath/Tag, 즉시 일관), Durable Object 큐.
- 예약: Workers Cron `0 18 * * *` → `/api/cron/broadcast-poll`(옛 vercel.json과 같음). GitHub Actions 5분 방송 확인과 pg_cron 채팅 큐는 그대로, 주소만 새 도메인(`0158`).
- 비용 가늠: Vercel 30일 CPU 4h4m ≈ 1,460만 CPU-ms < Workers Paid 포함분 3,000만. 묶음 gzip 2.2MB.

## 주의

- **로컬에서 `npm run cf:deploy` 금지.** OpenNext가 `.env.local`(DB 비밀번호·테스트 비밀번호·localhost 주소)을 Worker 묶음에 넣는다. 배포는 Workers Builds(GitHub 연결)로만 한다.
- `NEXT_PUBLIC_*`은 빌드 때 박힌다 → Workers Builds의 **Build variables**에 넣는다. 나머지 비밀은 Worker **Secrets**(`wrangler secret`).
- 로컬 확인은 `npm run cf:preview`(포트 8787)까지만.

## 절차

| # | 누가 | 할 일 |
|---|---|---|
| 1 | 개발자 | Cloudflare 가입 → Workers Paid 구독 → Registrar에서 `victory-broadcast.com` 구매 |
| 2 | 개발자 | 터미널에서 `npx wrangler login` |
| 3 | 에이전트 | D1 `vic-schedule-studio-tags` 생성 완료(2026-11-13, APAC). R2는 대시보드에서 R2 활성화 후 `wrangler r2 bucket create vic-schedule-studio-cache` |
| 4 | 개발자 | 비밀 옮기기: `node scripts/cloudflare/push-secrets.mjs`(.env.local 정본 → wrangler stdin, CRON_SECRET 새로 생성) → 출력된 CRON_SECRET을 GitHub Actions secret에도 넣기. **`vercel env pull` 금지**: Sensitive 값은 "[SENSITIVE]" 자리표시로 와서 2026-11-13에 가짜값 8개와 Vercel 시스템 변수 21개가 올라갔다(시스템 변수는 삭제함). `NEXT_PUBLIC_SITE_URL`은 wrangler.jsonc `vars` |
| 5 | 개발자 | 대시보드 Workers → vic-schedule-studio → Settings → Builds → GitHub 저장소 연결. Build command `npx opennextjs-cloudflare build`, Deploy command `npx opennextjs-cloudflare deploy`, Build variables에 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`·`NEXT_PUBLIC_SITE_URL` |
| 6 | 개발자 | Supabase → Authentication → URL Configuration: Site URL `https://victory-broadcast.com`, Redirect URLs에 `https://victory-broadcast.com/**` 추가(옛 주소는 이전 끝날 때까지 유지) |
| 7 | 에이전트 | 새 주소 실화면 확인(익명 포스터·로그인·비공개 해제·저장) → `0158` DB 적용 → cron-job.org 워밍 핑 끄기(Workers는 콜드 스타트 없음) |
| 8 | 개발자 | 토리님께 안내문 전달 |
| 9 | 에이전트 | 2026-12-13 Vercel 정지 해제 뒤 옛 주소 → 새 주소 리다이렉트만 하는 배포, 그 뒤 Vercel 프로젝트 정리(soccer-tactics·wak-schedule 포함, 삭제는 확인 후) |

## 정리(2026-11-13)

이전 뒤 쓸모없어진 것을 걷어냈다(브랜치 `cleanup/post-cloudflare`).

- **Vercel 잔재:** `@vercel/analytics`·`@vercel/speed-insights`, `vercel.json`, `.vercelignore`, ignore-build 게이트, `VERCEL_*` 환경값 읽기(커밋은 `WORKERS_CI_COMMIT_SHA`→`APP_COMMIT`), `maxDuration` 선언. 9번의 옛 주소 리다이렉트는 이 저장소가 아니라 별도 최소 프로젝트로 해야 한다(`vercel.json` 없음).
- **배포 묶음:** 퇴역 공개 자산 186개(약 49MiB)를 Workers Builds(`WORKERS_CI=1`)에서도 묶음 밖으로 옮긴다.
- **`/api/warm` 삭제:** cron-job.org의 워밍 핑 작업을 끈다(그 전까지는 404, 무해).
- **안 쓰는 파일:** `revealTeaserAction`, `PublicEventShare`, `WaterTide` 컴포넌트, rail lab 스크립트.
- **비공개 일정 레이어(코드):** 공개 일정만 읽고 쓴다. 최초공개 게이트 비밀번호(확인·변경)만 남김. `PRIVATE_DATA_ENC_KEY`는 더 쓰지 않는다 → Worker Secret에서 `wrangler secret delete PRIVATE_DATA_ENC_KEY`, `SUPABASE_STORAGE_BUCKET`도 같이.
- **DB `0159_retire_private_layer.sql`:** 작성만 함, **미적용**. 위 코드가 배포·확인된 뒤 소유자 승인 받고 적용(되돌릴 수 없는 삭제).
- 자체 성능 측정(`perf_samples`·인사이트 '서버 성능')은 유지.
