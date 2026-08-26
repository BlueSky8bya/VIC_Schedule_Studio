# ADR-0015 — 달력 꾸미기(스티커)·작업자 역할 철수 (테이블·컬럼 drop)

Status: Accepted
- Date: 2026-08-27
- Supersedes(부분): ADR-0004(스티커 비율 좌표 지오메트리 게이트)의 스티커 부분 — 지오메트리 게이트 자체
  (표면 폭 1840·칸 높이 baseline)는 캡쳐·꾸미기와 무관하게 시청자 화면 안정성 게이트로 계속 쓴다.
  ADR-0012 capability matrix의 worker 행은 폐기.
- 관련: ADR-0014(비공개 UI 철수), 0065 마이그레이션, `docs/agent/backups/2026-08-27_stickers.json`

## 맥락

관리자(빅토리)가 "달력 꾸미기 기능을 아예 없애도 된다"고 밝혔다(2026-08-27, 사용자 전달). 데이터도 같은
말을 한다 — 프로덕션 `sticker_instances` **2행**(2026-04, 2026-07 각 1), `sticker_assets` 12행, 신뢰 멤버
(매니저·작업자) **0명**. 작업자(worker)는 "스티커 + 비공개(work) 보기"만 있던 역할이라 ADR-0014에 이어
꾸미기까지 빠지면 권한이 0개 → 역할 존재 이유가 없다.

## 결정 (사용자: "깔끔하게 drop")

1. **코드 제거**: 꾸미기 라우트(`studio/decorate`), 팔레트·스티커 레이어/도형·테마 스위치 컴포넌트,
   `api/sticker-write`, 스티커/테마 서버 액션, `public-poster.tsx`의 스티커 상태·좌표 매핑·probe·툴바
   (약 2,800줄), CSS ~30KB, 공개 로더의 스티커 조회(공개 API DTO에서 `stickers`/`stickerAssets` 제거 —
   **공개 경계 변경**, CHANGELOG_AGENT), 편집실의 '달력 꾸미기' 진입 2곳, 시청자 `?mode=decorate` fixture.
2. **작업자 역할 제거**: `MembershipRole`에서 `worker` 삭제, 권한 함수의 worker/isWorker 인자 삭제,
   신뢰 멤버 = **매니저 한 종류**(패널은 이메일 추가·삭제만, 역할 표는 관리자/개발자/매니저 3열),
   `actor.isWorker`·이중 역할 미리보기 삭제. 인사이트/활동 라벨의 `worker` 문자열은 **과거 행 판독용으로
   남긴다**(kinds INTERNAL_ROLES, ROLE_META 등).
3. **DB(0065)**: `sticker_instances`·`sticker_assets` **drop**(cascade), 스토리지 정책·`can_decorate_vic()`
   drop, 빈 버킷 행 삭제, `is_active_worker()`는 항상 false(정책 본문 유지 → work 범위는 관리자+잠금해제만),
   `trusted_members.is_worker` 컬럼 drop. enum `trusted_role`의 `'worker'` 값은 PG 제약으로 남김.
4. **백업**: 행 JSON + 원본 이미지 12개(2.9MB)를 `docs/agent/backups/2026-08-27_*`에 커밋. 스토리지 객체는
   `scripts/cleanup-sticker-storage.mjs --delete`로 비운 뒤 0065 적용.
5. **레거시 정리 동반**: `api/trusted-members`(호출자 0, service-role 쓰기 표면), `api/private-layer` 스텁,
   `studio/private-layer` 페이지, `trusted-members/loading.tsx`, `relockPrivateLayerAction` 삭제.

## 배포 순서 (중요)

코드가 먼저 나가야 한다 — 옛 코드의 공개 로더가 `sticker_instances`를 읽으므로 테이블을 먼저 지우면
`/`가 깨진다. **push → Vercel 배포 확인 → 스토리지 비우기 → 0065 적용** 순.

## 되돌릴 조건

관리자가 다시 꾸미기를 원할 때. 코드는 git 이력(이 ADR 날짜 커밋), 데이터는 백업 JSON·이미지에서 복원.
스키마는 0001·0008~0048의 스티커 부분을 새 마이그레이션으로 재생성해야 한다(되돌리기 비쌈 — 결정 시점에
데이터 2행이라 감수).
