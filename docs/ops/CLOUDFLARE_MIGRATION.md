# Vercel → Cloudflare Workers 이전 (2026-11-13)

계기: Vercel Hobby가 Fluid Active CPU 4h 초과로 팀 전체 배포를 2026-12-13까지 정지. 개발자(blackspace) 결정: Pro 대신 Cloudflare Workers Paid(월 5달러) + 새 도메인 `victory-live.com`, 앞으로 Vercel 미사용.

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
| 1 | 개발자 | Cloudflare 가입 → Workers Paid 구독 → Registrar에서 `victory-live.com` 구매 |
| 2 | 개발자 | 터미널에서 `npx wrangler login` |
| 3 | 에이전트 | `wrangler r2 bucket create vic-schedule-studio-cache`, `wrangler d1 create vic-schedule-studio-tags` → `wrangler.jsonc`의 database_id 채움 |
| 4 | 개발자 | 비밀 옮기기: `npx vercel env pull .env.cf-prod --environment=production --yes` → `NEXT_PUBLIC_SITE_URL=https://victory-live.com`으로 고침 → `npx wrangler secret bulk .env.cf-prod` → 파일 삭제 |
| 5 | 개발자 | 대시보드 Workers → vic-schedule-studio → Settings → Builds → GitHub 저장소 연결. Build command `npx opennextjs-cloudflare build`, Deploy command `npx opennextjs-cloudflare deploy`, Build variables에 `NEXT_PUBLIC_SUPABASE_URL`·`NEXT_PUBLIC_SUPABASE_ANON_KEY`·`NEXT_PUBLIC_SITE_URL` |
| 6 | 개발자 | Supabase → Authentication → URL Configuration: Site URL `https://victory-live.com`, Redirect URLs에 `https://victory-live.com/**` 추가(옛 주소는 이전 끝날 때까지 유지) |
| 7 | 에이전트 | 새 주소 실화면 확인(익명 포스터·로그인·비공개 해제·저장) → `0158` DB 적용 → cron-job.org 워밍 핑 끄기(Workers는 콜드 스타트 없음) |
| 8 | 개발자 | 토리님께 안내문 전달 |
| 9 | 에이전트 | 2026-12-13 Vercel 정지 해제 뒤 옛 주소 → 새 주소 리다이렉트만 하는 배포, 그 뒤 Vercel 프로젝트 정리(soccer-tactics·wak-schedule 포함, 삭제는 확인 후) |
