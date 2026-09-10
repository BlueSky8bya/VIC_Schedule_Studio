# 봄 초원 세 겹 시안

상태: 생성 준비 · 소유자 검토 전 · 공개 반영 불가

이번 요청은 봄 3장뿐이다. 원본 보존, 투명 하늘, 원점 유지. 실제 앱 연결·사계절 확장·푸시는 별도 단계다.

## 고정 참고

- 고정입력/화풍참고/dave-d60bb1f3.png: 밝고 차분한 장면 분위기만. 바다·인물·UI·고유 구도 복제 금지. SHA-256 d60bb1f337098f3df81c6b50e294c381ac91beb263ade5515e9f8b296200f6fb
- 고정입력/화풍참고/acnh-160a43b6.jpg: 높은 3/4 시점과 열린 봄 잔디 공간감만. 3D 재질·물체·UI·고유 구도 복제 금지. SHA-256 160a43b62c8ab57d6021f14d5da23aa17ff99439ddfd42fc5391362c95ca2bbe

## 생성 프롬프트

### 먼 풍경 — backdrop-meadow-spring-far.png

Use case: stylized-concept. Asset: one original spring-meadow depth layer for a calm pixel-art schedule background. Output exactly 1536x1024 PNG, full canvas origin preserved, real transparent alpha outside the painted region. Logical 384x256 grid, hard 4x4 square pixel blocks. Only 6–10 opaque RGB colors, binary alpha 0/255. No gradients, antialiasing, blur, noise, dithering, painted checkerboard, text, UI, borders or labels. Cool muted sage, mint, gray teal and soft yellow-green; related-hue edges, no black outlines. High three-quarter view, flat quiet broad masses, intentionally simple and spacious. Ground horizon y=268 of 1024 (nearest 4px block to .26h). Shared origin across all three layers. No sky painted in this layer; sky is supplied separately by the renderer. No sun, clouds, fog, weather, shadows, creatures, standalone trees, rocks or interactive flower clumps. Two attached references are atmosphere/camera guidance ONLY, not pixel style or layouts to copy. Do not reproduce their UI, characters, objects or composition. This is a candidate, not approved/public art.
LAYER far: 밝고 저채도인 먼 나무 실루엣. 공통 지평선 바로 위의 낮은 띠. 하늘과 지면은 투명.
Paint only a shallow, continuous distant woodland silhouette band: treetops at y=176–252, opaque lower band ending y=320; all below y=320 and above the canopy is transparent. No distinct foreground trunks. Use pale desaturated mint/teal values. No mountains or islands.

### 지면 — backdrop-meadow-spring-ground.png

Use case: stylized-concept. Asset: one original spring-meadow depth layer for a calm pixel-art schedule background. Output exactly 1536x1024 PNG, full canvas origin preserved, real transparent alpha outside the painted region. Logical 384x256 grid, hard 4x4 square pixel blocks. Only 6–10 opaque RGB colors, binary alpha 0/255. No gradients, antialiasing, blur, noise, dithering, painted checkerboard, text, UI, borders or labels. Cool muted sage, mint, gray teal and soft yellow-green; related-hue edges, no black outlines. High three-quarter view, flat quiet broad masses, intentionally simple and spacious. Ground horizon y=268 of 1024 (nearest 4px block to .26h). Shared origin across all three layers. No sky painted in this layer; sky is supplied separately by the renderer. No sun, clouds, fog, weather, shadows, creatures, standalone trees, rocks or interactive flower clumps. Two attached references are atmosphere/camera guidance ONLY, not pixel style or layouts to copy. Do not reproduce their UI, characters, objects or composition. This is a candidate, not approved/public art.
LAYER ground: 지평선 아래부터 하단까지 빈틈 없는 열린 잔디 활동면. 중앙은 단순하게, 하늘은 투명. 서 있는 나무·돌·꽃 군집 없음.
All pixels y<268 transparent. All pixels y>=268 opaque through the bottom and both side edges. A flat open spring grassy plane, broad restrained color patches receding toward the straight horizon. Sparse small flat turf marks at edges, quiet middle. No path, pond, central emblem, objects or hills. No cast shadows.

### 가까운 풀숲 — backdrop-meadow-spring-frame.png

Use case: stylized-concept. Asset: one original spring-meadow depth layer for a calm pixel-art schedule background. Output exactly 1536x1024 PNG, full canvas origin preserved, real transparent alpha outside the painted region. Logical 384x256 grid, hard 4x4 square pixel blocks. Only 6–10 opaque RGB colors, binary alpha 0/255. No gradients, antialiasing, blur, noise, dithering, painted checkerboard, text, UI, borders or labels. Cool muted sage, mint, gray teal and soft yellow-green; related-hue edges, no black outlines. High three-quarter view, flat quiet broad masses, intentionally simple and spacious. Ground horizon y=268 of 1024 (nearest 4px block to .26h). Shared origin across all three layers. No sky painted in this layer; sky is supplied separately by the renderer. No sun, clouds, fog, weather, shadows, creatures, standalone trees, rocks or interactive flower clumps. Two attached references are atmosphere/camera guidance ONLY, not pixel style or layouts to copy. Do not reproduce their UI, characters, objects or composition. This is a candidate, not approved/public art.
LAYER frame: 하단 모서리와 바깥 가장자리에만 성긴 낮은 풀. 중앙과 상단은 투명. 큰 덤불·서 있는 객체 없음.
Only small low grass tufts growing inward from the bottom left and bottom right outside edges, confined to bottom 15% and outer 18% of width. More than 90% of canvas transparent. Center x=25–75% completely transparent from top to bottom. No tall plants, continuous hedge, land base, flowers, trunks or cast shadows. Muted gray-green with crisp related-hue accents.
