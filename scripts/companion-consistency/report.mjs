import fs from 'node:fs/promises';
import path from 'node:path';
export async function writeReport(out) {
  const proof = JSON.parse(await fs.readFile(path.join(out, 'proof.json')));
  const sections = [
    ['CONSISTENCY', '몸 비율', '동일한 원화와 합산 변형 입력. 원화 자체의 전 포즈 교정 완료를 뜻하지 않습니다.'],
    ['PETTING', '쓰담쓰담 눈·입', '양눈이 함께 웃고 작은 입 미소를 유지합니다. 원화0/9, 같은 진행 시점.'],
    ['CROWN', '참고 방향을 반영한 왕관', '붉은 벨벳 돔·금빛 아치·보석·십자 장식. 앞·비스듬·옆·뒤.'],
    ['EARS', '전체 모자와 귀 분할 시제품', '기준0·시무룩432의 두 자세 한정. 모든 포즈에 귀 레이어를 적용한 제품은 아닙니다.'],
  ];
  const body = sections.map(([id, title, note]) => `<section><h2>${title}</h2><p>${note}</p><div class="pair"><figure><figcaption>전 · origin/main</figcaption><img src="before-${id}.png" alt="${title} 변경 전"></figure><figure><figcaption>후 · 작업 브랜치${id === 'EARS' ? ' 시제품' : ''}</figcaption><img src="after-${id}.png" alt="${title} 변경 후"></figure></div></section>`).join('\n');
  await fs.writeFile(path.join(out, 'index.html'), `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>빅타민 모습 개선 비교</title><style>body{margin:24px;background:#f5eedf;color:#514133;font:16px/1.6 sans-serif}h1{font-size:26px}h2{font-size:21px;margin:24px 0 4px}p{margin:8px 0}.pair{display:grid;grid-template-columns:1fr 1fr;gap:16px}figure{margin:0;min-width:0}figcaption{font-weight:600;margin:4px 0}img{display:block;width:100%;height:auto;border-radius:12px}a{color:#715092}section{margin-bottom:28px}@media(max-width:760px){.pair{grid-template-columns:1fr}body{margin:16px}}</style><h1>빅타민 모습 개선 · 2026-11-18</h1><p><a href="ear-lab.html">모든 모자·귀 앞뒤 실험실</a> · <a href="after-SOURCES.png">전체 자세 기준표</a> · <a href="proof.json">검사/원본 해시</a></p><p>전 기준: ${proof.baseline.slice(0, 8)}. 로컬 main에 이미 있던 액세서리 변경도 origin/main과 차이가 있습니다. 새 귀 분할 효과만 비교하려면 실험실의 ‘현재 겹침/분할 시제품’을 함께 보세요.</p>${body}</html>`);
}
