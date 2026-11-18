# 빅타민 현재 모습 계약

2026-11-18 직접 사용자 요청 기준. 최신 사용자 요청이 우선하며, 아래 표가 이 작업에서 폐기/대체한 항목을 명시한다. 과거 숫자 회차 문서와 원본·반려 기록은 증거로 보존한다. 일반 VIC 일러스트 규칙이나 서버/권한/KST 경계를 폐기하는 문서가 아니다. 후속 사용자 “좋아, 이대로 커밋하고 푸시해서 배포까지 해줘.”로 모든 실제 뜀의 폼폼 시안과 해당 출시를 승인했다. 실제 배포 여부는 별도 운영 증거로 확인한다.

2026-11-18 사용자 “좋아, 이 표정으로 하고 남아 있는 lint랑 문서 검사 문제도 고쳐줘.”로 둥근 ‘헤헤’ 쓰담 표정(.76)을 승인했다. 승인은 이 표정에 한정하며 왕관 등 다른 그림의 승인이나 커밋/push/배포 권한으로 확대하지 않는다.

## 고칠 곳은 세 군데

| 바꾸려는 것 | 편집 원본 | 실행 |
|---|---|---|
| 눈 크기/화풍·쓰담 선 | `lib/ui/viewer-companion/appearance-policy.json`, 공통 `expression-painter.ts` | `pipeline.mjs build --scope=eyes` |
| 귀 소유권·접힘·원래 입/눈 의미 | `scripts/companion-consistency/native-parts.json` | 먼저 `plan --scope=ears --native=62`, 수정 뒤 `build` |
| 모자 모양/착용 위치 | code-native SVG, accessory art/placement | `build --scope=headwear`는 몸 재생성 없음; `verify --scope=headwear` |

실행 경로는 `node scripts/companion-consistency/pipeline.mjs <plan|doctor|build|verify|report>` 한 개다. `build`는 필요한 세 단계를 순서대로 실행하고, 입력과33출력의 내용 SHA가 모두 같으면 렌더/패킹0회로 건너뛴다. QA는 자동 PASS로 재사용하지 않는다. native 목록은 검수 영향 범위를 좁히며, 현재 배포판 생성은 일관된 전체 묶음 단위다. 부분 패킷만 재생성하는 기능까지 구현됐다고 주장하지 않는다.

## 현행 수치/의미

- 눈의 실제 기준은 **변경 전 달리기 physical304**의 고정 원본 path/SHA다. 정면은 가까운 눈의 폭·높이, 사선은 그 원본의 양눈 폭과 공통 높이. 사선에.83을 다시 곱하지 않는다. 눈동자의 갈색 질감/하이라이트만 투명 glyph로 가져오며 다른 자세의 배경·볼은 붙이지 않는다.
- 쓰담 감은 눈 선은 기본 눈웃음의 **1.15배**. 한쪽만 허용된 덧그리기는 금지한다. 의도된 윙크/감은 눈/울음/시무룩/나선은 독립 상태다. 회전 자세6셀도 명시적 보정으로 포함해515보이는 얼굴,5뒤통수로 구분한다.
- 쓰담 ‘헤헤’ 곡률은 `eye.pettingArchControl=.76`. 양끝 높이.08h·폭.98w 유지, 실제 아치 솟음.42h. native source9와 runtime melt에서 공통 사용하고 weight로 진입/복귀를 보간한다. 기존 낮은.22h의 온화한 쓰담 곡선만 대체하며, 다른 표정에 일괄 적용하지 않는다. 인간 표정 연구는 방향 참고이며 수치 근거/시각 승인이 아니다.
- 2026-11-19 헤롱눈 재교정: native43/44의16셀은 작은 열린 C형 procedural spiral을 폐기하고 같은 포즈 원본의 동그란 빙글눈을 native Canvas RGBA로 보존한다. 바깥 고리+AA2px의 양눈 영역을 입 제거 뒤 복원해 안쪽 고리만 잡힌 오른눈과 겹친 입 corridor의 잘림을 막는다. 눈 밖/전체alpha/나머지504셀과 기존 쓰담·입·귀·모자는 유지한다. 새 원화/AI 생성 없음. 사용자가 실제 전후 시안을 승인하고 commit/main push/Cloudflare 출시를 요청했다. 실제 배포 증거는 로컬 출시 기록으로 확인한다. [계획·증거](../plans/PLAN-20261119-companion-dizzy-eyes.md).
- 원화의 ω(3을 오른쪽90도 돌린 두 곡선) 입은 **native27/28**의 `mouthState=cat`으로 보존한다. 기본 U미소나 붉은 입을 임의로ω로 바꾸지 않는다. `M.cat`도 실제 두 곡선 한 contour로 그리며 표정 전환에서 옛 입과 새 입을 겹쳐 놓지 않는다.
- 같은 native 원화의 반복에만 몸통 alpha 기준 면적을 맞춘다. 귀4조각과 분리 감정 기호는 면적 측정에서 제외한다. 원본의 rig/fit으로 생긴 차이는 wholeRGBA에 한 번 균일 보정하고 같은 역변환으로 ownership을 나눈다. 얼굴/입/모자/운반/접촉 좌표도 같은 affine, clip은새 alpha를 포함하도록 확장한다. 다른 포즈의 원근/접힘을 같은 외곽으로 강제 정규화하지 않는다.
- 실행 중 높이가 늘면 너비를 줄이고, 낮아지면 너비를 늘리는 reciprocal 면적 보존과 전체strain 예산을 공유한다. **깊이를 고정한2D 겉보기 면적 모델**이다. 실제3D부피를 측정하거나 완전한 물리 시뮬레이션으로 인증하지 않는다. 최종 encoded alpha의 목표 면적 오차1% 정책으로 래스터 오차도 검사한다.
- 2026-11-18 후속 “재롱 동작 짧은 뜀 등 다 적용해”로 폼폼 변형을 실제 공중 이동 전체에 확장한다. 공통 `pompom.ts`가 이동/재롱/모자/음악·장난감의 뜀/하트/최초공개/던져짐·낙하와 초원·옷장 재생의 실제 발 높이·속도를 사용한다. 뜀 높이에 맞춘 속도 문턱으로 작은 뜀도 반응하고, 정점/접지에서 풀린다. 초기 일반 점프 한정·던지기 제외를 대체한다. 접지한 호흡·기울임/잡기와 reduced/off/soft는 제외한다. 입/눈 아래 보호 경계와 역수 세로 적분으로 얼굴·귀·모자/2D면적을 보존한다. 원화 변경은 없다. [계획/검증·출시 승인](../plans/PLAN-20261118-companion-jump-pompom.md).
- 귀·몸·현재얼굴·모자를 native-scale 한canvas에서 합성하고한번 축소한다. 같은 crop은 SHA+크기가 일치할 때만 한 번 포장한다. 런타임 decoder retained3/inflight2는 유지한다. alpha0 RGB의WebP정규화와 가시RGBA 일치를 구분한다.

## 충돌 정리

| 역사 규칙/동작 | 현재 처리 |
|---|---|
| idle0 눈을 평균내고quarter눈을.83축소 | 이번 사용자 지적으로 반려. running304 기준으로 대체 |
| `sample.left/right<=1`이므로 canonical 눈도 키우면 안 됨 | 값은 감김 비율0..1이다. 실제 눈 크기의 기준을 제한하지 않는다 |
| .83을 전부 삭제 | 금지. 안경의 카메라 투영.83은 별도 기하이므로 유지 |
| body runtime determinant1이면 원화 부피도 PASS | 금지. baked rig/fit과 최종 encoded 몸 alpha도 검사 |
|520등록/clip까지 절대 동일 | x/y/index/행은 유지. 새 이미지의 clip/landmark는 같은 affine으로 재등록 |
|58불명확 눈은 원화 유지·귀는두 포즈 연구 | 명시적 native tag/회전6등록/전체520귀4슬롯으로 대체 |
| 모든 native 입을M.smile로 통일 | ω의 고유 의미가 사라지는 결함. 해당 source는cat으로 보존 |
| 옛131/133/143 생성기를 다시 실행해현재판 복원 | 역사 재현/`--check` 증거만. 현재 빌드는 새pipeline만 사용 |
| 지난 PASS가 이번 사용자 시각 승인 | 금지. 작은눈판은 반려본이며 검수·자동검사와 승인을 구분 |

## 작업·검증 순서

`plan → 기준/해시 doctor → build → verify → production fixture → 같은화면 전/후 report`. 새 원본/부위를 추가하면 origin path/SHA, native key/semantic tag, 필요한 landmark를 함께 등록한다. 숫자·캐시·후보 개수 때문에 승인/검수 범위를 부풀리지 않는다. 원본은 수정하지 않고 현재판의 과거 반려본은scratch보존 정책에 따라 남긴다. 커밋/push/배포는 기존 권한 규칙을 따른다.

[도구 상세](../../../scripts/companion-consistency/README.md), [조사와 채택 근거](../research/COMPANION_APPEARANCE_PIPELINE-20261118.md), [이번 작업 기록](../plans/PLAN-20261118-companion-consistency.md).
