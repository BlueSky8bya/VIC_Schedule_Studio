import fs from 'node:fs/promises';
import sharp from 'sharp';
const receipt = JSON.parse(await fs.readFile('art-src/빅타민/동행/작업회차/20261018-동작연결정리115/패킹파생기록.json'));
const used = [...new Set(receipt.slots.map(s => s.nativeCell))].sort((a, b) => a - b);
const out = '.scratch-pw/companion-consistency/full'; await fs.mkdir(out, { recursive: true });
for (let page = 0; page < Math.ceil(used.length / 20); page++) {
  const tiles = [];
  for (const [i, id] of used.slice(page * 20, page * 20 + 20).entries()) {
    const key = receipt.keys[id], box = key.box;
    const native = await sharp(receipt.native.path ?? receipt.slots[0].source).extract(box).resize(180, 180).png().toBuffer();
    const label = Buffer.from(`<svg width="200" height="210"><text x="5" y="201" fill="#513d2b" font-size="17">key ${id}</text></svg>`);
    tiles.push({ input: native, top: Math.floor(i / 5) * 210, left: i % 5 * 200 }, { input: label, top: Math.floor(i / 5) * 210, left: i % 5 * 200 });
  }
  await sharp({ create: { width: 1000, height: 840, channels: 4, background: '#f5eedf' } }).composite(tiles).png().toFile(`${out}/native-${page}.png`);
}
await fs.writeFile(`${out}/native-keys.json`, JSON.stringify(used));
console.log(used);
