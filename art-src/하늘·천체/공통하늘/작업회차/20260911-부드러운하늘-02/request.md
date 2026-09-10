# 하늘 아틀라스 매트 수정

01회차는 실제 알파 없는 1254×1254 RGB 체커보드 원본이라 공개 연결하지 않는다. 02회차는 실제 본 01 원본을 입력으로 부드러운 천체/구름 어법을 보존하고 RGB 단색 마젠타 배경으로 바꾼다. 원본은 그대로 보존하며 런타임 로딩 때 측정 마스크로 배경 제외. 투명 PNG라고 주장하지 않는다.

Edit this exact 3x3 sky sprite atlas. Preserve ALL nine sprites, their fine pixel-art detail, shapes, colors, positions, relative sizes, cell layout and square canvas. The checkerboard is incorrectly baked into the image. Remove the entire checkerboard background and replace it with a perfectly flat, opaque pure MAGENTA #FF00FF RGB(255,0,255) background everywhere outside sprites and in all gaps. No checkerboard, no shading or gradient in background, no magenta bleeding into sprite edges. This is a chroma-key source for runtime clipping, so precisely separate foreground pixels from the background. Preserve the round full moon and sun without dark outlines and preserve all cloud, meteor and comet details. Do not add or change objects. Return the same dimensions as input.
