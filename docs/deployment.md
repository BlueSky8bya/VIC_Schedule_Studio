# VIC Schedule Studio 배포 가이드

작성: 2026-05-24 · 대상: 빅토리님 캘린더 정식 배포(공개 링크)

이 문서는 **PC를 항상 켜둘 필요 없는** 방식으로 배포하고, 소유자를 빅토리님으로
바꿔 누구나 구글 로그인으로 이용하게 하는 전체 절차입니다.

---

## 0. 요약 — 추천 아키텍처

**Vercel(앱 호스팅) + Supabase(DB·인증·스토리지)**. 둘 다 매니지드 서버라 **내 PC가
꺼져 있어도** 24시간 동작합니다.

왜 이 조합이 이 서비스에 최적인가:

- **수백 명 + 대부분 구경만(읽기 위주)** 트래픽에 강함. 공개 일정 데이터는
  서버에서 **30초 캐시**(Vercel Data Cache)되어, 몇 백 명이 동시에 봐도 DB 조회는
  주기당 1회로 수렴합니다. (이미 코드에 구현해 둠 — 4번 항목 참고)
- Vercel은 요청량에 따라 자동 확장(서버리스). 트래픽 몰려도 알아서 늘어남.
- Supabase 무료 등급으로도 이 규모는 충분. 더 키우면 Pro($25/월)로 무중단 확장.
- GitHub에 push하면 Vercel이 자동 빌드·배포(CI/CD)라 운영이 단순.

> 대안 비교: Netlify/Cloudflare Pages도 가능하지만, 이 앱은 Next.js App Router +
> 서버 액션 + 미들웨어를 쓰므로 **Vercel이 가장 마찰이 적습니다**. 직접 VPS(AWS EC2 등)는
> 항상 켜두고 관리해야 해서 "PC 안 켜도 되는" 목적과 운영 부담 면에서 비추천.

---

## 1. ⭐ 내가(빅토리님/운영자) 직접 해야 하는 것 — 체크리스트

코드·설정·문서는 다 준비됐습니다. 아래는 **내 계정/비밀값이 필요해 대신 못 하는** 부분입니다.

### A. 미리 모아둘 정보
- [ ] **빅토리님 구글 이메일** (소유자로 지정할 계정) → `OWNER_EMAIL`
- [ ] Supabase 키 3개: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
      `SUPABASE_SERVICE_ROLE_KEY` (Supabase 대시보드 → Project Settings → API)
      - 지금 로컬 `.env.local`에 있는 값과 동일(같은 Supabase 프로젝트 재사용 권장)
- [ ] `PRIVATE_LAYER_UNLOCK_SECRET`: **지금 `.env.local`에 있는 값 그대로** 쓰기
      (바꾸면 이미 설정한 비공개 레이어 비밀번호가 무효화됨)

### B. Vercel (앱 배포)
- [ ] vercel.com 가입(깃허브 계정으로 로그인 권장)
- [ ] **Add New → Project → `BlueSky8bya/VIC_Schedule_Studio` Import**
- [ ] **Environment Variables**에 아래를 모두 등록 (Production + Preview 둘 다 체크 권장)
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (비밀)
  - `OWNER_EMAIL` = `toryvac2@gmail.com` (빅토리/토리님 구글 계정)
  - `PRIVATE_LAYER_UNLOCK_SECRET` (비밀, 로컬 값 그대로)
  - `SUPABASE_STORAGE_BUCKET` = `vic-schedule-assets`
  - 💡 위 값들은 `.env.vercel.local`에 붙여넣기용으로 정리해 둠 → Vercel 입력칸에 통째로 붙여넣으면 됨
  - `NEXT_PUBLIC_SITE_URL` = 배포 도메인 (첫 배포 후 도메인 확정되면 채우고 재배포.
    비워둬도 Vercel 프로덕션 도메인으로 자동 폴백되게 코드에 처리해 둠)
- [ ] **Deploy** 클릭 → 빌드 성공 확인 → 도메인 확인
      (예: `https://vic-schedule-studio.vercel.app`)

### C. Supabase 인증 URL 설정 (로그인 리다이렉트)
Supabase 대시보드 → **Authentication → URL Configuration**
- [ ] **Site URL** = 배포 도메인 (예: `https://vic-schedule-studio.vercel.app`)
- [ ] **Redirect URLs**에 추가:
  - `https://<배포도메인>/auth/callback`
  - `https://<배포도메인>/**` (와일드카드, 권장)
  - (로컬 개발도 쓰면 `http://localhost:3000/**`도 함께 둬도 됨)

### D. Google OAuth 동의화면 — ⚠️ 수백 명 쓰려면 필수
Google Cloud Console → 해당 프로젝트 → **APIs & Services → OAuth consent screen**
- [ ] **Publishing status를 "Testing" → "Production(게시)"으로 변경**
      - Testing 상태면 **수동 등록한 100명만** 로그인 가능 → 일반 시청자가 막힘
      - 사용 scope가 이메일/프로필(기본)뿐이라 보통 **구글 보안 심사 없이** 게시 가능
- [ ] **Authorized redirect URIs**(OAuth 클라이언트)에 Supabase 콜백이 있는지 확인:
      `https://<project-ref>.supabase.co/auth/v1/callback`
      (보통 로컬 설정 때 이미 등록돼 있음)

### E. Supabase Storage (스티커 이미지)
Supabase 대시보드 → **Storage**
- [ ] `vic-schedule-assets` 버킷이 있는지 확인(같은 프로젝트 재사용이면 이미 있음)
- [ ] 공개 읽기 가능해야 시청자에게 스티커 이미지가 보임

### F. (선택) 커스텀 도메인
- [ ] Vercel → 프로젝트 → Settings → Domains 에서 원하는 도메인 연결
- [ ] 도메인 바꾸면 위 **C(Supabase URL)** 와 `NEXT_PUBLIC_SITE_URL`도 그 도메인으로 갱신 후 재배포

---

## 2. 소유자 = 빅토리님, 개발자 = 나 (이미 설계됨)

- **소유자(owner)** 는 코드가 아니라 **`OWNER_EMAIL` 환경변수**로 정해집니다.
  Vercel에 `OWNER_EMAIL = 빅토리님 이메일`만 넣으면 빅토리님이 전체 편집 권한을 가집니다.
- ⚠️ **중요(기존 DB 재사용 시)**: 앱 권한은 `OWNER_EMAIL`로 결정되지만, **DB의 RLS는
  `calendars.owner_id`** 로 소유자를 판별합니다(일정 저장은 사용자 세션으로 실행 →
  RLS 적용). 기존 DB의 `owner_id`가 예전(테스트) 계정을 가리키고 있으면, `OWNER_EMAIL`만
  바꿔도 빅토리님 화면엔 편집 UI가 보이지만 **저장이 RLS에 막힙니다.** 그래서 소유자
  이전은 아래 두 가지를 **둘 다** 맞춰야 합니다:
  1. Vercel `OWNER_EMAIL = toryvac2@gmail.com` (앱 권한)
  2. `calendars.owner_id`를 토리님 계정으로 이전 (DB/RLS) — **순서 주의**:
     - (1) 위 환경변수 설정 후 배포 → (2) **토리님이 한 번 구글 로그인**(auth.users에 행 생성)
       → (3) Supabase SQL 에디터에서 아래 실행:
       ```sql
       set app.owner_email = 'toryvac2@gmail.com';
       -- 그리고 db/seeds/0003_transfer_owner.sql 내용을 이어서 실행
       ```
     - 로컬에서 한다면(권장, 더 간단): `.env.local`의 `OWNER_EMAIL`을 `toryvac2@gmail.com`으로
       둔 뒤 `node scripts/apply-db.mjs db/seeds/0003_transfer_owner.sql` — apply-db가
       `.env.local`의 `OWNER_EMAIL`을 `app.owner_email` GUC로 자동 주입한다.
     - 샘플 일정은 그대로 유지됩니다(데이터는 건드리지 않고 owner_id만 바꿈).
- **한 사람이 계정 2개로 동일한 소유자 권한**을 원하면: `OWNER_EMAIL`에 콤마로
  여러 계정을 넣는다(예: `toryvac@gmail.com,toryvac2@gmail.com`). 첫 번째가 주 소유자
  (`calendars.owner_id`)이고, 나머지는 `calendar_co_owners`에 등록돼 동일한 owner 권한을
  갖는다("나만"/owner_private까지 공유). 적용 순서:
  1. 각 계정이 앱에 **구글 로그인 1회**(auth.users에 행 생성)
  2. Vercel·`.env.local`의 `OWNER_EMAIL`을 콤마 목록으로 설정(+Vercel은 재배포)
  3. `node scripts/apply-db.mjs db/seeds/0013_sync_co_owners.sql` — apply-db가 목록을
     `app.owner_emails` GUC로 주입해 `calendar_co_owners`를 동기화한다(멱등; 목록에서
     빠진 계정은 공동 소유자에서 자동 제거됨).
- **개발자(developer/슈퍼관리자)** 는 `platform_admins` 테이블로 관리되며,
  현재 `blackspace665@gmail.com`(나)이 등록돼 있어 유지보수 권한을 계속 가집니다.
  - 개발자도 공개 API에는 비공개 데이터가 안 나오고, 비공개 레이어 열람은 잠금해제가 필요(설계 규칙).
- 빅토리님 외 다른 운영자를 개발자로 추가하려면:
  `db/seeds/platform_admins.sql`에 이메일을 추가하고 `node scripts/apply-db.mjs db/seeds/platform_admins.sql` 실행.
- 매니저/작업자는 스튜디오의 **신뢰 멤버** 화면에서 빅토리님이 직접 추가.

---

## 3. DB 상태 (이미 준비됨)

같은 Supabase 프로젝트를 재사용하면 마이그레이션/시드가 이미 적용돼 있습니다.
관심 하트 기능의 `0016_event_hearts.sql`도 이미 적용 완료.

새 Supabase 프로젝트로 옮기는 경우에만 아래를 순서대로 실행:

```bash
# .env.local에 새 프로젝트의 URL/키/DB비밀번호를 넣은 뒤
node scripts/apply-db.mjs db/migrations/0001_initial_schema.sql \
  db/migrations/0002_event_category.sql \
  ... (0003 ~ 0016 까지 순서대로) ...
node scripts/apply-db.mjs db/policies/0001_rls.sql db/policies/0002_grants.sql ...
node scripts/apply-db.mjs db/seeds/0002_calendar_and_defaults.sql ... db/seeds/platform_admins.sql
node scripts/verify-db.mjs   # 적용 상태 확인
```
> 기존 프로젝트 재사용이면 이 절은 건너뜀.

---

## 4. 성능 — 읽기 위주 트래픽 최적화 (이미 구현)

- 공개 일정 데이터(`getPublicSchedule`)의 **익명 공통 부분**을 쿠키 없는 anon 클라이언트로
  읽고 **`unstable_cache`(30초 TTL)** 로 캐시 → 수백 명이 봐도 DB는 30초당 1회만 조회.
- 사용자별 데이터(내가 하트 누른 일정 `myHeartIds`)만 비캐시로 덧붙여 **공개/개인 경계 유지**.
- 소유자가 일정/태그/스티커/메모/테마를 편집하면 `revalidatePublicSchedule()`로
  캐시를 **즉시 무효화** → 시청자 화면에 바로 반영(라이브 공동 편집 대응).
- **하트 토글은 일부러 캐시를 무효화하지 않음**(빈번한 이벤트라 캐시 효과 보존).
  다른 사람이 누른 하트 수/"관심 높음" 배지는 **최대 30초 내** 다른 시청자 화면에 반영됨.
  본인이 누른 하트는 즉시(낙관적) 반영.
- 조절: 전파 속도를 더 빠르게/느리게 하려면 `lib/schedules/public-loader.ts`의
  `PUBLIC_SCHEDULE_REVALIDATE_SECONDS` 값을 조정.

---

## 5. 배포 후 동작 확인 (스모크 테스트)

- [ ] 배포 도메인 접속 → 구글 로그인 버튼 표시
- [ ] **빅토리님 계정**으로 로그인 → 편집실(스튜디오)로 진입(소유자 권한)
- [ ] **아무 일반 구글 계정**으로 로그인 → 공개 캘린더(포스터)만 보임, 편집 UI 없음
- [ ] 일반 계정에서 일정 ♥ 눌러보기 → 하트 떠오르는 효과, 새로고침해도 유지
- [ ] 비공개 레이어 토글이 일반 시청자에겐 안 보이는지 확인
- [ ] 스튜디오에서 일정 추가 → 시청자 화면에 곧 반영되는지 확인
- [ ] (보안) `https://<도메인>/api/public/vic/events` 응답에 비공개 필드 없음 확인

---

## 6. 코드 쪽으로 이미 끝낸 것 (참고)

- `getSiteUrl()`에 Vercel 프로덕션 도메인 자동 폴백 추가(OAuth 리다이렉트 안전).
- 읽기 캐싱 + 소유자 편집 시 캐시 무효화 배선(섹션 4).
- `.env.example`에 필요한 모든 환경변수 문서화.
- `typecheck` / `lint` / `test` / `build`(15라우트) 전부 통과.
- 코드 GitHub `main`에 push 완료(아래 7번).

---

## 7. 재배포 방법 (운영)

- 코드 수정 후 `git push`(main) → Vercel이 자동 재빌드·배포.
- 환경변수만 바꾸면 Vercel → Deployments → 최신 빌드 **Redeploy** 필요(빌드 시 주입되므로).
