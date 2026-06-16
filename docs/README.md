# docs/ — 문서 라우팅 인덱스

> **코딩 에이전트에게**: 이 폴더는 43개 문서가 섞여 있다. **전부 읽지 마라(토큰 낭비).**
> 아래 순서/표로 *필요한 것만* 골라 읽어라.
>
> **읽기 순서**: ① 루트 `CLAUDE.md`(항상-온 규칙) → ② `sop.md`(전체 SOP) →
> ③ 작업 영역에 맞는 표준 문서(architecture/security-boundary) → ④ 특정 기능 작업 시에만
> 해당 plan/report 1개. **리포트·체크리스트는 역사 기록**이라 대개 안 읽어도 된다.

상태 표기: ✅ 표준(현행 진실) · 📋 계획(의도; 일부/전부 구현됐을 수 있음) ·
📊 리포트(분석·역사 기록, 무거움) · ✓ QA(특정 시점 체크리스트, 보통 낡음) · 🔴 폐기/대체됨

---

## ✅ 표준 — 현행 진실 (먼저 이것부터)

| 파일 | 내용 | 언제 읽나 |
|---|---|---|
| `sop.md` | 전체 한국어 제품 SOP·운영 규칙 | 제품 규칙·역할·정책 확인 시 **항상** |
| `architecture.md` | 아키텍처·데이터 경계 | 데이터 흐름/로더/DTO 작업 시 |
| `security-boundary.md` | 공개/비공개·RLS 기대치 | 공개 API·권한·노출 경계 작업 시 |
| `harness.md` | LLM 하네스(플래너/빌더/평가자) | 에이전트 작업 흐름 참고 |
| `deployment.md` | 배포 가이드(Vercel·Supabase) | 배포/환경/오너 핸드오프 시 |

## 📋 계획 (forward-looking)

| 파일 | 내용 | 상태 |
|---|---|---|
| `plans/mvp-roadmap.md` | MVP 로드맵 | |
| `bigtory-brand-ux-overhaul-plan.ko.md` | 브랜드 UX 전면 개편 계획 | |
| `developer-role-preview-plan.md` | 개발자 역할 미리보기 | 구현됨 |
| `responsive-execution-plan.md` | 반응형 실행 계획(audit 적용판) | |
| `role-based-ux-implementation-plan.md` | 역할 기반 UI/UX 개선 계획 | |
| `role-button-grouping-plan.md` | 역할별 스튜디오 버튼 그룹핑 | |
| `tag-hierarchy-plan.md` | 2계층 태그+다중태그+계층필터 계획 | ✅ 구현됨(현행) |
| `ux-audit-implementation-plan.md` | UX 감사 적용 계획 | |
| `viewer-checkin-attendance-plan.md` | 시청자 출석도장·개근배지 | 미구현 |
| `진동기능-구현계획.md` | 햅틱(진동) 단계별 구현 | 1단계 구현됨 |
| `tag-tier-plan.md` | 🔴 태그 2-tier(테두리/채움) 계획 | **폐기** → `tag-hierarchy-plan.md`로 대체 |

## 📊 리포트·감사 (역사 기록 — 보통 통독 불필요)

| 파일 | 내용 |
|---|---|
| `design-overhaul-report.md` | 디자인 전면 개편 보고서 |
| `feature-proposals.md` | 기능·디자인 개선 제안 |
| `hci-wide-benchmark-improvement-report.ko.md` | 경험·커뮤니티·운영신뢰 개선 조사 |
| `motion-haptics-immersion-report.md` | 모션·햅틱·몰입 강화 제안 |
| `responsive-design-audit-report.md` | 화면비율·모바일/웹 디자인 평가 |
| `role-based-ui-ux-audit-report.ko.md` | 권한별 UI/UX 감사·벤치마크 (KO) |
| `role-based-ui-ux-audit-report.en.md` | ↑ 영문판 (동일 내용) |
| `server-optimization-audit-report.md` | 서버 통신·최적화 재평가 |
| `session-improvements-2026-06-08.md` | 야간 자동 세션 개선 리포트 |
| `tag-color-palette-improvement-report.md` | 태그 색 팔레트 개선 |
| `tag-taxonomy-classification.md` | 태그 분류 체계(대분류/세부, content/modifier) |
| `tag-tier-report.md` | 🔴 태그 2-tier 설계 명세 v3 — **폐기**(위 plan과 함께) |
| `ux-audit-benchmark-report.ko.md` | UX 감사·벤치마크 (KO) |
| `ux-audit-benchmark-report.en.md` | ↑ 영문판 (동일 내용) |
| `visit-insights-improvement-report.md` | 방문/체류 인사이트 개선 |
| `기능-확장-조사보고서.md` | 기능 확장 조사 |
| `개선-쉬운정리.md` | 개선 아이디어 쉬운 정리판 |
| `현황보고서.md` | 제품 현황 보고서 |
| `배치6-9-진행상황.md` | 배치 6~9 자동 작업 진행 상황 |

### 축구/월드컵 미니게임 시뮬 도메인 (별도 영역)
| 파일 | 내용 |
|---|---|
| `football-knowledge-inventory.ko.md` | 축구 규칙·지식 인벤토리 |
| `football-rl-training-benchmark-report.ko.md` | 멀티에이전트 RL 학습 전략 벤치마킹 |
| `worldcup-rl-foundation-report.ko.md` | 월드컵 미니게임 RL 기반 |
| `worldcup-minigame-hci-proposal.md` | 월드컵 웹 미니게임 HCI 제안 |

## ✓ QA 체크리스트 (특정 시점 — 보통 낡음, 회귀확인용 참고만)

| 파일 | 대상 |
|---|---|
| `decorate-qa-checklist.md` | 꾸미기 "화려함" P1–P4 |
| `qa-batch1-2-체크리스트.md` | Batch 1(저장칩)·2(미정) |
| `tag-hierarchy-qa-checklist.md` | 2계층 태그 리팩토링 |
| `visit-insights-qa-checklist.md` | 방문 인사이트 개선 |

---

**언어**: `.ko`/`.en` 접미사는 같은 문서의 한/영판. 접미사 없으면 대개 한국어.
**우선순위 충돌 시**(루트 `CLAUDE.md` 기준): 보안·정보경계 > KST > 오너전용 편집 >
역할별 UX > 포스터/export 품질 > 유지보수성.
