import fs from 'node:fs/promises';
import sharp from 'sharp';
const anchors = JSON.parse(await fs.readFile('lib/ui/viewer-companion/accessory-anchors.json'));
await fs.mkdir('.scratch-pw/companion-consistency', { recursive: true });
for (const id of [0, 144, 432]) {
  const frame = anchors.frames.find(f => f.physicalIndex === id), src = anchors.sources[frame.atlas].src;
  const size = (await sharp('public' + src).metadata()).width / 8;
  const grid = Array.from({ length: 17 }, (_, i) => `<path d="M${i * 40} 0 V640 M0 ${i * 40} H640" stroke="#0099aa" stroke-opacity=".4"/><text x="${i * 40 + 1}" y="12" font-size="12">${i * 5}</text><text x="1" y="${i * 40 + 12}" font-size="12">${i * 5}</text>`).join('');
  await sharp('public' + src).extract({ left: frame.index % 8 * size, top: Math.floor(frame.index / 8) * size, width: size, height: size }).resize(640, 640).composite([{ input: Buffer.from(`<svg width="640" height="640">${grid}</svg>`) }]).png().toFile(`.scratch-pw/companion-consistency/ear-grid-${id}.png`);
}
