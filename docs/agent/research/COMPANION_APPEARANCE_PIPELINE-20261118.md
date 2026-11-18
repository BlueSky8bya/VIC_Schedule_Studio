# 빅타민 모습 파이프라인 조사 — 2026-11-18

사용자 요청: 과거 규칙/설정과 현재 요구의 충돌을 정리하고 효율적으로 수정할 수 있는 프로세스를 실제 적용. 조사 자료는 설계 참고이며 사용자 스타일 승인이나 이 프로젝트의 성능 보증이 아니다.

| 근거 | 확인 내용 | 이 프로젝트 적용 |
|---|---|---|
| [Spine 슬롯 공식 문서](https://en.esotericsoftware.com/spine-slots?lang=en) | 부착물과 draw order를 분리하고 애니메이션에서 순서를 바꾼다 | 주황/노랑×뿌리/끝의 의미를 고정, 접힘 앞뒤만 교체. 현재 단일canvas 합성 유지 |
| [Spine 제작자 포럼: Draw order](https://en.esotericsoftware.com/forum/d/17221-spine-pro-draw-order-question) | Misaki/Erika 답변: 한 부위만 앞뒤가 달라지면 별도slot이 필요. 스킨 교체만으로 자동 해결되지 않는다 | ‘모자그림을 앞에 한 장’ 같은 임시처리 대신 ear-tip/front와root/back 계약. 이름·semantic을 분리해야 교체가 안전하다는 실무 팁 |
| [Spine Texture packing 공식 문서](https://en.esotericsoftware.com/spine-texture-packer) | Alias는 픽셀 동일 이미지를한번만 저장. whitespace제거시복원offset을메타데이터로유지. padding/alpha는렌더조건과맞춰야함 | 크기+RGBA SHA가완전히같은crop만alias, sourcecrop좌표공유. whole몸한번변환뒤분할, RGBA복원검사로확인. 기존1px gutter/실제Canvas경로검증유지. 엔진이정해지지않은PMA설정을맹목적으로복사하지않음 |
| [Godot Import process 공식 문서](https://docs.godotengine.org/en/stable/tutorials/assets_pipeline/import_process.html) | 원본과import설정/파생물을분리하고checksum변경시재import. 여러파일에는바뀐설정만적용 | current policy한곳, immutable 원본과파생JSON/WebP분리, 모든입출력hash검증후unchanged build건너뛰기. headwear-only에서몸생성0회 |
| [Gu/Vining/Sheffer, TABI, 2026 연구](https://arxiv.org/abs/2602.07782) | atlas의공간효율·downscale·대화형속도의tradeoff를다루는GPU기법 | 지금은도입하지않음. 고정33패킷의오프라인MaxRects+동일crop alias로충분하며GPU런타임/새외부의존성추가는이득이입증되지않음 |

## 실제 바꾼 프로세스

1. `appearance-policy.json`이달리기304의원본path/SHA·쓰담strokeGain·몸계량허용치를소유한다. 현재계약문서에과거충돌/대체항목을한표로모았다. 오래된문서를전부다시읽어서현재설정을추정하지않는다.
2. `pipeline.mjs` 한명령에서계획·doctor·세단계build·범위별verify·전후report를연결한다. 같은입력이라도출력하나의hash가다르면cache hit를주지않는다. 빌드중입력이바뀌어도cache를확정하지않는다. cache hit는QA PASS가아니다.
3. 모자-only는몸/눈을재생성하지않는다. 눈/몸정책변경은전체의존포즈를보수적으로갱신한다. 특정native목록은검수영향을명시하지만현재부분패킷만publish하는기능은아니다.
4. 귀/몸의동일crop alias를실제적용. 도입전후동일v3내용의encoded합계19,659,932→17,840,892bytes(약9.25%감소)를관측했다. 이후눈의투명matting/ω보존수정을더한최종크기는현재edition/pipeline증거를따른다. 범용최적화효과나실기기FPS향상으로확대해석하지않는다.
5. 정지·달리기·윙크·접힘·회전·쓰담·모자12종을분리해서확인한다. 뜬눈648개픽셀검사, native별몸alpha, 모든part복원, 늦은hat/LRU/clear회귀, production실제입력은서로대체할수없는검사다.

## 의도적으로 하지 않은 것

Spine/Live2D/Godot런타임전환, 모든원화를자동모양평준화, 과거원본/거절기록삭제, QA snapshot자동승격, 출처없는커뮤니티수치복사, production규칙/활동수집변경은범위밖이다. 차후부분재생성은per-cell내용cache와staging출력분리가검증된뒤도입할수있다. 지금구현하지않은최적화를완료로보고하지않는다.

## 쓰담 ‘헤헤’ 눈웃음 — 후속 직접 요청

사용자: “지금 눈웃음은 약간 온화함에 어울리는 표정인데, 히히 나 헤헤 느낌의 눈웃음으로 더 굴곡있게 곡률 줄 수 있나? 나도 잘 모르겠는데 지금은 쓰담받는 표정이라기엔 너무 온화하며 뿌듯한 표정이야. 관련해서 찾아서 수정해줘”

- [Perron & Roy-Charland, 2013](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2013.00659/full): 통제된 인간 얼굴 실험에서 양쪽 볼 상승과 입꼬리 당김을 함께 둔 웃음이 비Duchenne 대조보다 더 행복하게 평가됐다. 볼 상승은 눈 주변을 좁히는 단서다. 빅타민에서는 양눈의 둥근 아치를 함께 강화하는 참고로만 쓴다. 인간의 주름을 추가하거나 표정의 진위를 판정하지 않는다.
- [Scherer et al., 2019](https://www.frontiersin.org/journals/psychology/articles/10.3389/fpsyg.2019.00508/full): pride/happiness/enjoyment 표현·관찰에는 겹치는 단서와 혼동이 있다. ‘뿌듯함’과 ‘헤헤’를 곡률 하나로 객관적으로 분류했다는 근거로 쓰지 않는다.
- 채택한 제작값: `appearance-policy.json`의 `eye.pettingArchControl=.76`. 같은 끝점 y=.08h에서 quadratic control을 −.36h→−.76h로 바꿔 실제 아치 솟음을 .22h→.42h로 높인다. 논문이 정한 마스코트 수치가 아니라 이번 사용자 지적에 대한 시각 조정값이다.
- native 쓰담 source9와 runtime `melt`가 같은 정책을 쓴다. 표정 진입/복귀는 기존 weight로 곡률도 보간한다. 일반 온화한 눈웃음·찡그림·울음·윙크·나선은 의미를 유지한다. 달리기304 눈 폭/높이, 쓰담 선1.15배, ω 입·귀·모자·몸 계약은 유지한다.
- 비교는 사용자 반려 직전 온화한 판과 origin/main을 별도로 보존한다. 같은 자세·.5진행·밝은 테마·크기의 실제 공통 painter 그림과 92px 모습을 함께 남긴다. 자동검사는 사용자 시각 승인이 아니다.
