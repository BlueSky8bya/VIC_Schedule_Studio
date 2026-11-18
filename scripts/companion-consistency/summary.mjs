// Side-by-side review evidence; no artwork pixels are retouched here.
import path from 'node:path';
import sharp from 'sharp';
const out = path.resolve('.scratch-pw/companion-consistency/runs/20261118');
const faceCrop = { left: 708, top: 300, width: 210, height: 230 };
const beforeFace = process.argv[2] ? await sharp(process.argv[2]).resize(360, 394).png().toBuffer() : await sharp(path.join(out, 'before-PETTING.png')).extract(faceCrop).resize(360, 394).png().toBuffer();
const afterFace = await sharp(path.join(out, 'after-PETTING.png')).extract(faceCrop).resize(360, 394).png().toBuffer();
const beforeCrown = process.argv[3] ? await sharp(process.argv[3]).extract({ left: 0, top: 0, width: 916, height: 276 }).resize(720, 217).png().toBuffer() : await sharp(path.join(out, 'before-CROWN.png')).resize(720, 217).png().toBuffer();
const afterCrown = await sharp(path.join(out, 'after-CROWN.png')).resize(720, 217).png().toBuffer();
const labels = Buffer.from('<svg width="1440" height="540"><g fill="#514133" font-family="sans-serif" font-size="19"><text x="18" y="28">지적하신 얼굴</text><text x="378" y="28">잔상 정리 후</text><text x="738" y="28">거절된 왕관 시안</text><text x="738" y="290">참고 방향을 반영한 왕관</text><text x="18" y="465">같은 자세 · 같은 크기 · 확대 비교</text><text x="18" y="497">제품 전체의 귀 분할 적용은 아직 전 단계입니다.</text></g></svg>');
await sharp({ create: { width: 1440, height: 540, channels: 4, background: '#f5eedf' } }).composite([
  { input: beforeFace, left: 0, top: 40 }, { input: afterFace, left: 360, top: 40 },
  { input: beforeCrown, left: 720, top: 40 }, { input: afterCrown, left: 720, top: 302 },
  { input: labels, left: 0, top: 0 },
]).png().toFile(path.join(out, 'review-summary.png'));
console.log(path.join(out, 'review-summary.png'));
