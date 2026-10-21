# 36표정 · 형태와 시간 일관성 연구 적용

2026-10-21 KST. 공개 1차 연구·제작자 자료와 커뮤니티의 관련 조언을 선정해 확인했다. 모든 연구의 전수 수집이나 특정 학습 모델의 실제 도입을 뜻하지 않는다.

| 자료 | 확인한 요점 | 프로젝트 적용과 한계 |
| --- | --- | --- |
| [Disney Research, SCA2022](https://studios.disneyresearch.com/2022/09/13/facial-animation-with-disentangled-identity-and-motion-using-transformers/) | 고정된 얼굴 identity와 시간에 따라 바뀌는 motion을 분리한다. | 동일 기준 눈 텍스처와 별도 연속 눈꺼풀 채널. 3D transformer를 설치/학습했다는 뜻은 아니다. |
| [Animate Anyone, CVPR2024](https://arxiv.org/abs/2311.17117) | 참조 외형 세부와 프레임 간 일관성은 별도 조건이 필요하다. | 원본 SHA/입력 고정과 단일 컷이 아닌 전체 전환 검사. ReferenceNet 자체 미도입. |
| [StableAnimator, CVPR2025](https://arxiv.org/abs/2411.17697) | 동작 시간층이 identity 보존을 방해할 수 있어 정렬을 별도로 다룬다. | 눈·몸·안경 보호와 동작 검사를 분리해 둘 다 요구한다. 사람 얼굴 모델을 빅타민에 그대로 적용하지 않는다. |
| [FlexiClip, ICML2025](https://proceedings.mlr.press/v267/khandelwal25a.html) | 클립아트의 국소 기하 보존과 시간 연속성은 함께 검증해야 한다. | 눈만 수정하는 마스크와 원몸/볼 alpha 보존, 연속 프레임 비교. diffusion/pfODE 학습은 미실행. |
| [SCAIL, 2026-03 개정](https://arxiv.org/abs/2512.05905) | 전체 동작 문맥, 구조 충실도, 시간 일관성, 품질·다양성 평가. | 생성 프롬프트에 전체 시퀀스·인접 프레임·부피/액세서리 조건을 넣는다. 발표된 결과를 이 게임의 성능 보증으로 쓰지 않는다. |
| [Animation Mentor, Facial Animation101](https://www.animationmentor.com/blog/facial-animation-101/) | 실제 카메라에서 눈의 초점을 확인하고 과한 eye dart를 줄이며, 표정의 생각·반응·hold를 계획한다. | 실제 게임 크기/속도 검토, 시선 이동 한도, 표정 진입→유지→복귀. 수치 한도는 프로젝트 판단이며 논문 수치가 아니다. |
| [Toon Boom 공식 multilayer eye](https://learn.toonboom.com/modules/using-multiple-layers1/topic/activity-1-creating-a-multi-layered-eye1) | 검색 가능한 공식 교육 자료는 눈과 눈꺼풀의 분리를 다룬다. | 검색 요약만 확인, 본문403. 본문을 읽었다고 주장하지 않으며 핵심 근거는 위 원문들과 실제 코드 재현이다. |
| [Harmony 커뮤니티 drawing swap 조언](https://www.reddit.com/r/ToonBoomHarmony/comments/kgaifr/hi_some_help_would_be_greatly_appreciated/) | 동일 눈 그림을 복제하고 그 위에 눈꺼풀을 그려 형상을 유지하라는 실무 조언. | 기본 눈 자체의 세로 축소를 피하고 눈꺼풀을 따로 움직인다. 개인 경험이며 검증된 연구와 구분한다. |

## 재현과 구현

기존 기본 포즈의 햇살 표정은 실제 어두운 눈 픽셀 높이가 기준 눈 box의 약0.357까지 줄었다. 기존 `left/right >= .55` 값만 검사하면, 아래 눈꺼풀 곡선과 시선 이동까지 합쳐진 실제 결과를 놓친다. 기상·웃음·안심의 boolean eye-shape 전환도 한 프레임 jump를 만든다.

166은 열린 눈 aperture의 원래 차이를 .78–1 범위로 압축하고, 위아래 lid의 중복 절삭·시선 범위를 줄인다. 의도된 happy/squeeze는 별도 closure 채널로 진입·복귀한다. 표정의 대상 선택/지속시간1450ms, 휴지기, 생활 움직임 및 실제 source 소유권은 유지한다. 비율은 이 프로젝트의 시각 기준이며 인간 눈의 생리적 규칙이라고 주장하지 않는다.

## 실제 생성 프롬프트에 반영

재사용 함수는 `scripts/companion-qa/expression-prompt.mjs`의 `companionExpressionPrompt({id,label,referenceSha256})`다. 실제36개 id/명칭과 열람한 원본 SHA를 전달해 원본 정체성, 두꺼운 열린 눈, 의도된 감김, 몸 부피·볼·안경 보호, 8단계 전환과 게임 크기 검사를 포함한 개별 프롬프트를 만든다. 원본이나 보호된 과거 생성기록은 덮어쓰지 않는다.

실제 새 raster 제작 시 VIC illustration constitution의 원본 열람·원문 기록·preflight·단발 생성 절차에 이 문자열을 실제 args.prompt로 사용한다. 현재 확인된 결함은 editable canvas rig에 있어 그 소스를 수정했다. 이번에 새 이미지 생성이나 모델 가중치 학습을 실행했다고 주장하지 않는다. 프롬프트 기록은 생성 영수증이나 사용자 시각 승인이 아니다.
