# public/ambient/art — 계절 배경 그림 자리

여기에 `<id>.png`(변형은 `<id>-1.png`…)를 넣으면 장면이 그 그림을 쓴다. 자리 목록·규격·프롬프트는
`components/shared/ambient/art/manifest.ts`가 정본이고, 편집실 `/studio/ambient-art`(개발자)에서 상태를 본다.

- PNG 1024×1024, 투명 배경, 한 장에 한 물체, 긴 변 85%. 엔진이 알파 경계로 잘라 자리 크기에 맞춘다.
- 카메라: `stand`(동물의 숲 카메라 3/4) · `flat`(정확히 위에서) · `shadow`(단색 실루엣).
- 색: 오행 규칙 — 선명한 빨강·주황·노랑 금지.
- 출처·라이선스는 `../NOTICE.txt`에 적는다(생성물은 이 프로젝트 원작).
