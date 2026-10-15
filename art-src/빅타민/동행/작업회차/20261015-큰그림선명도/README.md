# 큰 그림 선명도 · 파생 기록

2026-10-15 KST. PLAN-050의 기존 원본 재사용. 새 원화·AI 생성·시각 승인 교체가 아니다.

- 기존 무손실272셀 archive를 Q95/alpha100으로 인코딩한 별도 파일: `public/companion/vitamin-fluid-q95.webp` (1,107,594B). 기존 runtime/receipt는 보존한다.
- 기존16키포즈 native를 전체472×472로 한 번 Lanczos3 다운샘플하고118px 셀을160px로 투명 패딩: `public/companion/vitamin-keyposes-2x.webp` (132,352B). 원본1254²보다 작으며 업스케일/재그림이 아니다.
- 등록은 largest8-connected alpha>160 몸의 중심40/발80, clip여백2인80 논리단위다. 새 메타: `lib/ui/viewer-companion/keypose-sprite.json`. 두 인코딩 모두 decoded alpha변경0을 검사한다.
- 추가 decoded RGBA는1,638,400B(1.5625MiB), 두 atlas 합8.203125MiB. GPU/mipmap/브라우저 중복 버퍼 비용의 실측치는 아니다. OFF 때 로드하지 않는 연결은 renderer가 책임진다.
- fluid256 원본은 셀78~79px라 압축 완화만으로 고해상도 디테일이 생기지 않는다. native가 잘린 셀·CSSclip과16개의 서로 다른 정지 포즈라는 한계는 보존한다.

원본 경로·SHA·크기·각 셀 측정과 파생 SHA는 [파생기록](파생기록.json)에 있다. 기존 source bytes는 읽기 전용이다.

재현: `node scripts/prepare-viewer-companion-sharp.mjs --check`.
