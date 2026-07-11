# Local Agent Instructions — `tests/`

## Role
`unit/`(vitest) · `e2e/`(playwright) · `visual/`(playwright, 공식 포스터 PNG 내보내기 포함).

## Invariants
- 공개 경계 테스트(`unit/public-dto.test.ts`)는 **삭제·약화 금지**. 새 공개 필드를 추가하면 여기에 검사를 늘린다.
- 실물 검증은 **프로덕션 빌드**(`npm run build && npm run start`)로 한다 — `next dev`는 HMR 상태로
  거짓 결과(스케일 미적용·리스너 미부착)를 낸 전적이 있다.

## Verification
```bash
npm run test          # vitest
npm run test:e2e      # playwright e2e
npm run test:visual   # 시각 회귀 + 포스터 PNG
```
