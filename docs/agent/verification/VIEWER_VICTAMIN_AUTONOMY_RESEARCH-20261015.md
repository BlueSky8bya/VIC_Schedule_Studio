# 빅타민 환경 판단·목표와 짧은 감정 조사

2026-10-15 KST. [PLAN-052](../plans/PLAN-20261015-052-companion-unified-hd-and-living-world.md) 하위 조사/순수 뇌 구현. 실제 렌더·운영 검증은 최상위 검증 기록에서 구별한다.

## 선택

기존 `brain.ts`는 욕구·최근 행동·방문·쿨다운을 입력으로 유한 행동 하나를 utility 추첨했다. 먹이만 실제 발판 BFS 경로를 다시 계산하며 접근했다. 이번에는 이 물리·실행기를 보존하고 **환경 affordance → 유지되는 목표 → 실제 경로의 다음 단계 → 현재 환경 재검증 → 관찰/휴식/식사 완료**를 얹는다. 실행 가능한 새 목표/행동과 알고리즘은 여전히 개발자가 작성한다. LLM, 신경망 학습, 의식이나 무제한 자율 지능을 탑재했다는 뜻은 아니다.

## 확인한 원자료와 적용

| 원자료 | 확인한 내용 | 적용/보류 |
|---|---|---|
| Jeff Orkin, [Three States and a Plan: The AI of F.E.A.R.](https://www.gamedevs.org/uploads/three-states-plan-ai-of-fear.pdf), GDC2006, pp11–12 | 목표와 action의 precondition/effect를 연결하고, 비싼 실제 경로 가능성은 필요한 시점에 확인한다. | 목표를 단발 동작과 분리하고 현재 geometry로 다음 경로를 검증한다. 범용 STRIPS 탐색기/게임 전체 월드 모델은 작은 달력 동행에 불필요해 도입하지 않는다. |
| Yuka 공식 [Think](https://mugen87.github.io/yuka/docs/Think.html), [실제 JS 소스](https://github.com/mugen87/yuka/blob/master/src/goal/Think.js), [goal 예제](https://mugen87.github.io/yuka/examples/goal/) | 목표 evaluator 점수로 목표를 고르고 subgoal을 실행한다. 예제는 수집 후 짧게 쉰다. | 목표의 지속·완료·실패 재계획 구조를 참고한다. 기존 utility/BFS와 겹치는 엔진 의존성은 추가하지 않으며 소스를 복사하지 않는다. |
| Park et al., [Generative Agents](https://arxiv.org/abs/2304.03442),2023 | 관찰·계획·회상 구성요소를 결합한 LLM 에이전트 연구다. | 관찰/목표/기억을 분리하는 구조만 참고한다. 일정 본문 자연어 기록·전체 경험 보관·LLM reflection은 이 기능에 필요하지 않다. 논문의 인간 유사성 결과를 이 구현의 검증으로 주장하지 않는다. |
| Marsella/Gratch/Petta, 저자 제공 [Computational Models of Emotion](https://people.ict.usc.edu/~gratch/papers/MarGraPet_Review-old.pdf), pp8–9/14–15 | 사건 자체뿐 아니라 욕구·목표가 충족/방해됐는지에 대한 appraisal과 짧은 emotion/더 넓은 mood를 구별한다. | 추적 중 먹이 소실·하트 시도 막힘·반복 집기·손길/식사의 결과를 작은 상태값에 반영한다. 인간 심리의 충실한 재현·감정 인식·사용자 심리 추정은 하지 않는다. |
| Ruan et al., [WebLLM](https://arxiv.org/abs/2412.15803),2024, [실제 구현](https://github.com/mlc-ai/web-llm) | WebGPU/WASM으로 브라우저 내 언어모델 추론을 수행하는 실제 엔진이다. | 이 캐릭터에는 언어 과제가 없다. 모델 다운로드·메모리·GPU 추론을 늘리는 이득이 확인되지 않아 보류한다. OBS와의 실제 경합은 이번에 측정하지 않았으며, 논문 수치를 우리 장치 성능으로 대입하지 않는다. |

Google의 [Web LLM Inference 공식 안내](https://developers.google.com/edge/mediapipe/solutions/genai/llm_inference/web_js)는 확인 시점 기존 MediaPipe LLM Inference API가 maintenance-only이며 LiteRT-LM JS 이동을 안내했다. 이름이 익숙하다는 이유만으로 오래된 런타임을 새로 추가하지 않는다. 이번 선택은 외부 모델/생산 의존성0이다.

## 구현 계약

- `getAction`/`commitAction`/`recordCompanionEvent` 시그니처는 보존한다. action의 `intention`이 commit을 거쳐 세션의 `brain.intention`으로 이어진다. 목표는 탐험/실제 쿠션에서 휴식/실제 먹이 접근이다. 직접 한 번 이동하는 짧은 play는 기존 utility에 남긴다.
- 탐험은 서로 다른 발판을 최소 두 번 점프하는 경로를 유지한다. 중간 발판에서 새 기회가 생겨도 유효한 목표는 유지하고, 도착하면 관찰로 마친다. 먹이는 목표가 남아 있는 동안 새로 생긴 더 가까운 먹이 때문에 매 단계 방향을 바꾸지 않는다. 배고픔과 실제 먹이는 탐험보다 우선한다.
- 매 단계 현재 geometry·선호·도달 가능성을 확인한다. 목표 삭제/이동·불가능한 경로·행동 예산 소진은 재계획한다. 새 탐험은 최대200개 geometry, 후보 상위6개, 경로 증명 최대2회다. 유지 중 목표/낮은 기력의 실제 집 경로 검사는 별도 한 번씩일 수 있다. 무한 탐색은 없다.
- 목표 성공·실패는 anonymous geometry id별 최대12개, 방문15/실패3으로 제한한 세션 기억이다. 실패는8초 **활성 시간** 동안 해당 곳을 덜 고르게 한다. 일정 제목·태그·계정·실제 공개 event id·부재 시각을 읽거나 저장하지 않는다. 이 상태는 localStorage로 추가 저장하지 않는다. 기존 저장 욕구4개는 그대로다.
- `Platform.manualOnly`는 사람이 직접 놓은 카드 위 지원이다. 무목적 탐험/산책/hop/하트·경로 중간점으로 고르지 않는다. 사용자 음식이 실제 점유한 top만 명시적 먹이 목표로 허용한다. 실제 먹이 x로 탄도가 증명된 종단 점프 후 먹으며, 해당 top을 가로지르는 walk는 하지 않는다. 이미 같은 top에 있다면36px 이내 먹기만 허용한다. 먹은 뒤에는 현재 x에서 안전한 일반 발판으로 점프할 수 있을 때만 이탈한다. 불가능하면 제자리 행동을 유지한다.
- 작은 음식의 첫 충돌과 큰 캐릭터의 접근 가능성은 다르다. `accessibleCompanionFoods`는 별도32px 음식지원의 익명 card/home/floor family를 실제92px pet 지원으로 매핑한다. 같은 x를 덮고 top 차이가.5px 이내인 별도 pet 지원이 있을 때만 뇌에 노출한다. 음식의 실제 표시/위치/32px 충돌 ID를 바꾸거나, 다른 날짜/가까운 층으로 치환하지 않는다. 작은 음식만 놓을 수 있는 곳에서는 음식은 남고 자율 접근만 보류한다.
- `getCompanionMood(brain)`는 neutral/happy/disappointed/sulky다. `heart-blocked`와 실제 추적 먹이의 `food-lost`가 짧은 아쉬움을 만든다. 한 번 집기는 평상시 놀이, 별도 반복 집기는 짧은 삐침이다. 같은 held gesture의 매 프레임 이벤트로 축적되지 않도록650ms 활성 debounce를 둔다. `petted`/성공한 `ate`는 즉시 happy 우선·frustration 완화다.
- 반복 집기의 시각 mood 값.82는 기존650ms 놓기/착지 뒤 약1.15초 동안 삐침이 읽히게 한다. 원래.7은 착지 직후 표정이 한 프레임 정도만 보일 수 있었다. 이 변경은 저장 욕구/친밀도 벌점이 아닌 세션의 짧은 표현 값이다.
- 감정은 `advanceBrain`에 공급된 활성 시간으로만 감쇠하며 그 외 timer/worker/observer를 추가하지 않는다. 부재를 죄책감·친밀도 하락·보상 빚으로 만들지 않는다. 잠든 blur/hidden 상태에서 감정 때문에 깨어나지 않는다. 실제 일정·사람 하트·배경 선호·네트워크 요청은 변하지 않는다.

## 순수 검증

관련62개 통과: 기존 brain19/feeding24, 새 planner11/affect4/food-access4. 새 검사는 두 발판 이상 목표 경로의 유지·완료, 새로운 기회에도 목표 유지, 삭제/불가능한 간격 재계획, 설정/먹이 우선, 실제 레이아웃 이동·행동 예산 소진, bounded 결과 기억, 실제 집 경로, 선택한 먹이 유지, 불변성과 경로 증명 예산, manual 시작점의 제자리 jump 이탈과 실제 음식에 한정한 manual 종단 점프·먹기를 다룬다. 작은 음식의 실제 충돌과 큰 캐릭터의 별도 지원 검증·동일 익명 family·x/top 검증도 포함한다. 감정은 blocked/lost 반응·반복 집기·손길/식사 회복·활성 시간만의 감쇠를 확인한다.

이 기록은 순수 정책/알고리즘 검증이다. 원화 표정의 전달력, OBS 하드웨어, 물리 터치, 공개 페이지의 전체 중단/복귀 동작은 별도의 렌더·운영 검증이 필요하다.
