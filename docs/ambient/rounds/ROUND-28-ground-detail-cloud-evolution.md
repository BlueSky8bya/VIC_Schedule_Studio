# ROUND-28 — 거리별 지면 화질과 변화하는 구름

상태: 로컬 구현·검증, 소유자 감상 확인 대기. 소유자 승인 범위(2026-09-11): 가까운 땅일수록 연속적으로 세밀한 화질을 실제 화면에 적용하고, 단일 구름도 이동 중 변형/분산/합침이 보이도록 구현. 지상과 상공 바람은 일대일 연동하지 않는다.

두 수정 묶음: 사계절 초원 ground cache의 거리별 정렬된 해상도 혼합; 공용 구름의 독립 상공풍·높이별 완만한 변형. 향후 바이옴은 공통 helper를 재사용하되 표면 거리부터 확인한다. 현재 다른 바이옴 지면·심해/모바일/공개DTO/권한/DB/원본 이미지 변경 없음. 커밋/푸시 없음.

## 근거와 표현 범위

- [NWS wind shear](https://www.weather.gov/spotterguide/supercell1): 높이에 따라 풍속/방향이 달라지는 현상. [Met Office cloud factsheets](https://www.metoffice.gov.uk/research/library-and-archive/publications/factsheets): 지상 위 여러 높이의 온도·습도·풍속·방향이 구름 자료의 일부다.
- [Met Office clouds](https://weather.metoffice.gov.uk/learn-about/weather/types-of-weather/clouds): 수증기의 응결, 상승/난류 등 구름 형성 과정. 바람 자체를 구름을 태우거나 무조건 지우는 원인으로 설명하지 않는다.
- 실제 서울 실시간 바람/습도 예측이나 유체 시뮬레이션이 아닌 결정적인 감상용 근사. 지상 바람은 작은 편향만 주고 상공풍의 범위를 겹치게 해 맑은 날에도 위 구름은 빠르고 바람 날에도 상대적으로 느릴 수 있다.

## 구현

- 원경0.4→중경0.7→근경1.0 smoothstep. 동일 원본의 정렬된 mip를 캐시 생성 시 행별 혼합, 근경은 확보된 원본 해상도 보존. 원본 이상의 디테일 생성/2배 업스케일 효과를 주장하지 않는다. 기존 tier/메모리 상한·객체 비율·지면 확장 유지. 임시 mip는 bake 후 해제.
- 구름 atlas 캐시는 그대로 두고 full tier에서만 높이별 절편의 전단·폭·광량을 천천히 변화. 한 구름도 변화하며 이웃 무리의 제한된 상대이동으로 겹침/분리가 생긴다. 위상은 시드·시간의 순수 함수, 눈에 보이는 갑작스러운 재추첨 없음. lite/still은 변형을 생략한다.
- 시청자/미리보기 정지·마우스 없음·모바일 제외는 기존 엔진 게이트를 따른다. 상공풍은 별도 씨앗을 쓰지만 화면별 임의 wall-clock이나 Math.random을 추가하지 않는다.

## 검증 기록

기준 build `wrGnmcBXtpyW3zuWMxcd4`, 지면/구름 before는 R27 `smooth-clouds/` 및 `weather-banks/`에서 고정 입력 비교. 새 결과는 R28에 기록한다. 아직 하지 않은 검사는 통과로 간주하지 않는다.

- 1차 build `EzBvW7fUy-xazv-vP8nes`: `after/` 4계절 지면+3날씨×0/15/30초13장 오류0. R27 파일은 정확히 입력이 같은 경우만 전후 근거이며 사계절 전체의 paired before라고 주장하지 않는다.
- A/B 실제검토: 거리별 선명도가 이어지고 수평줄/투명틈/분홍경계 없음. 구름 절편경계/지면침범 없음. 형태변화는 미세하며 정지3시점이 연속움직임 자연스러움을 보장하지는 않는다.
- C 지적2건 수정: 변형 최대폭/흐린여백을 포함한 화면밖판정, 지면 좌우여백도 필터된 중앙에서 추출. 이후 추가 차단문제 없음.
- 전체 단위834통과, 전체lint/typecheck/build 통과. selftest3시나리오 통과. still/cache/mobile33검사 통과, 4K/패닝 edge검사 통과. 이 검사는 1차 build 범위다.
- 수분주기 후속: 맑음/바람은 수분감쇠가0까지, 흐림/비/눈은 core배율.72이상. `final/` 0/30/120초6장 오류0 (`phKT8C9e5FThKCJizhFrA`); 메인 실제확인. C 코드확인 후 수분배율은 모든 tier에 유지하여 lite전환시 사라진 구름이 갑자기 복구되지 않게 했다. 시간정지는 기존엔진이 담당한다. 관련17검사와 최종build/typecheck 통과.
- 실기기/OBS/GPU 성능 및 실제 기상 정확성은 검증하지 않았다. 현재 지면은 원경 샘플을 줄이고 근경 원본을 보존하는 구현이지 새 고해상도 원본 생성이 아니다. 미래 바이옴의 표면별 연결은 아직 하지 않았다.

최종 build `6oQ8gWB9o7qv0rgpWNuGU`, 서버3100 유지. `final/live-perf.json`: 1400×860 headless Chromium, 여름 초원 흐림 seed42, max/lite 각각12초 단독 실행. 마지막180표본 raw RAF 평균16.67ms, draw평균 max0.68ms/lite0.37ms, page errors0. GPU시간/기기간 보장/정밀전후 성능향상 근거가 아니다. live-max/lite PNG 기록 및 메인 확인. 최종 harness/diff-check 통과. 전체834검사는 수분주기 추가 전, 후속17관련검사·최종build/typecheck는 이후 실행했다.

Ground portion superseded by [ROUND-29](ROUND-29-near-ground-detail.md): owner rejected far degradation. Cloud evolution remains active.
