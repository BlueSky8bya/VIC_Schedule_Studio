# docs/ — 문서 트리 라우팅

> **코딩 에이전트에게**: 문서가 토픽별 하위 폴더로 갈라져 있다. **전부 읽지 마라(토큰 낭비).**
> 아래에서 작업 토픽의 폴더로 내려가면, 그 폴더 `README.md`가 다시 안내한다(트리).
>
> **읽기 순서**: ① 루트 `CLAUDE.md` → ② `sop.md`(전체 SOP) → ③ 작업 토픽 폴더의 README →
> ④ 그 안에서 필요한 1개. 리포트·QA는 역사 기록이라 대개 안 읽어도 된다.

## 루트 — 표준(현행 진실, 항상-온)
이 5개는 자주 참조돼 루트에 둔다. 토픽 폴더로 내리지 않음.

| 파일 | 내용 |
|---|---|
| [`agent/`](agent/) | **에이전트 하네스** — CURRENT_STATE(지금 상태) · decisions(ADR) · PROJECT_MAP · RISK_PROFILE · DEFINITION_OF_DONE · plans · handoffs · domain-rules. **작업 시작 시 여기부터** |
| `sop.md` | 전체 한국어 제품 SOP·운영 규칙 (**최우선**) |
| `architecture.md` | 아키텍처·데이터 경계 |
| `security-boundary.md` | 공개/비공개·RLS 기대치 |
| `harness.md` | LLM 하네스(플래너/빌더/평가자) |
| `deployment.md` | 배포 가이드(Vercel·Supabase) |

## 토픽 폴더 (각 폴더에 자체 README)

| 폴더 | 내용 | 가지 |
|---|---|---|
| [`tags/`](tags/) | 태그 체계·색·계층·tier | — |
| [`ux/`](ux/) | UI/UX·역할·반응형·모션 감사·계획 | `role/` `audit/` `responsive/` `motion/` |
| [`insights/`](insights/) | 방문/체류 인사이트·출석 | — |
| [`sim/`](sim/) | 축구·월드컵 미니게임 RL 시뮬 | — |
| [`product/`](product/) | 기능 제안·현황·세션 로그·서버 감사 | — |
| [`plans/`](plans/) | 범용 로드맵 | — |

상태 표기(하위 README 공통): ✅ 표준 · 📋 계획 · 📊 리포트(역사) · ✓ QA(낡음) · 🔴 폐기/대체

**언어**: `.ko`/`.en`은 같은 문서의 한/영판(접미사 없으면 대개 한국어).
**우선순위 충돌 시**: 보안·정보경계 > KST > 오너전용 편집 > 역할별 UX > 포스터/export 품질 > 유지보수성.
