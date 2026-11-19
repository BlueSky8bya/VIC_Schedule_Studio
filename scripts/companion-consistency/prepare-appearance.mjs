import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { extractKeys } from '../prepare-companion-motion-115.mjs';
import { prepareMaterialSources } from './material-source.mjs';
import { packRectangles } from './rectangle-pack.mjs';
const policy=JSON.parse(await fs.readFile('lib/ui/viewer-companion/appearance-policy.json'));
const out = '.scratch-pw/companion-consistency/full'; await fs.mkdir(out, { recursive: true });
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const json = value => JSON.stringify(value, null, 2) + '\n';
const metadata = JSON.parse(await fs.readFile('scripts/companion-consistency/input-metadata.json'));
await fs.writeFile(`${out}/input-metadata.json`, json(metadata));
const receipt = JSON.parse(await fs.readFile('art-src/빅타민/동행/작업회차/20261018-동작연결정리115/패킹파생기록.json'));
const specs = JSON.parse(await fs.readFile('scripts/companion-consistency/native-parts.json'));
const native = await fs.readFile(receipt.slots[0].source);
if (hash(native) !== receipt.slots[0].sourceSha256) throw Error('Frozen native changed');
const { keys } = await extractKeys(native), size = 192, count = size * size;
const nativeOwners = keys.map((key, id) => {
  const ears = specs.ears[id]; if (!ears) return undefined;
  const owners = new Uint8Array(key.width * key.height);
  for (let y = 0; y < key.height; y++) for (let x = 0; x < key.width; x++) {
    const px = (x + .5) / key.width * 100, py = (y + .5) / key.height * 100;
    let nearest = Infinity;
    ears.forEach((ear, side) => {
      if (!ear) return;
      const [rx, ry, tx, ty, width] = ear, dx = tx - rx, dy = ty - ry, length2 = dx * dx + dy * dy;
      const t = ((px - rx) * dx + (py - ry) * dy) / length2;
      if (t < -.06 || t > 1.36) return;
      const along = Math.max(0, Math.min(1, t)), distance = Math.hypot(px - rx - dx * along, py - ry - dy * along);
      const radius = width * (t < .18 ? .5 + Math.max(0, t) * 2.5 : t > 1 ? Math.sqrt(Math.max(0, 1 - ((t - 1) / .36) ** 2)) : 1);
      if (distance <= radius && distance < nearest) { nearest = distance; owners[y * key.width + x] = 1 + side * 2 + (t > .43 ? 1 : 0); }
    });
  }
  return owners;
});
const bases = await prepareMaterialSources(metadata, receipt, keys, nativeOwners);
const frames = [], packets = [], cleanup = [];
const faces = JSON.parse(await fs.readFile('lib/ui/viewer-companion/expression-anchors-161.json'));
const extra=JSON.parse(await fs.readFile('lib/ui/viewer-companion/expression-pose-overrides.json'));
const faceMap = new Map([...faces.frames,...extra.frames].map(frame => [frame.physicalIndex, frame]));
const sources = [];
for (let atlas = 0; atlas < metadata.atlases.length; atlas++) {
  const source = metadata.atlases[atlas], bytes = await fs.readFile('public' + source.src);
  if (hash(bytes) !== source.sha256) throw Error('Input source changed: ' + source.src);
  const whole = Buffer.alloc(1536 * 384 * 4), crops = [],aliases=new Map();
  const indices = metadata.frames.map((frame, physicalIndex) => ({ frame, physicalIndex })).filter(item => item.frame.atlas === atlas);
  for (const { frame, physicalIndex } of indices) {
    const base=bases.get(physicalIndex),slot=base.slot,key=keys[slot.nativeCell],owners=base.owners.slice(),data=Buffer.from(base.data),material=base.material;
    const ox=frame.index%8*size,oy=Math.floor(frame.index/8)*size;
    if (process.argv.includes('--styled')) (await sharp(`${out}/styled-cells/${physicalIndex}.png`).ensureAlpha().raw().toBuffer()).copy(data);
    // Keep the main opaque component and meaningful authored detached marks.
    const seen = new Uint8Array(count), components = [];
    for (let i = 0; i < count; i++) if (!seen[i] && data[i * 4 + 3] >= 64) {
      const queue = [i]; seen[i] = 1;
      for (let q = 0; q < queue.length; q++) { const at = queue[q], x = at % size, y = Math.floor(at / size); for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy, j = yy * size + xx; if (xx >= 0 && yy >= 0 && xx < size && yy < size && !seen[j] && data[j * 4 + 3] >= 64) { seen[j] = 1; queue.push(j); } } }
      components.push(queue);
    }
    components.sort((a, b) => b.length - a.length);
    const retained = new Uint8Array(count);
    for (const component of components) if (component === components[0] || component.length >= 16 || key.record.marks.length) for (const at of component) retained[at] = 1;
    const near = new Uint8Array(count);
    for (let i = 0; i < count; i++) if (retained[i]) { const x = i % size, y = Math.floor(i / size); for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (x + dx >= 0 && y + dy >= 0 && x + dx < size && y + dy < size) near[(y + dy) * size + x + dx] = 1; }
    let removed = 0;
    for (let i = 0; i < count; i++) if (data[i * 4 + 3] && !near[i]) { data.fill(0, i * 4, i * 4 + 4); removed++; }
    const bounds = Array.from({ length: 5 }, () => ({ left: 192, top: 192, right: -1, bottom: -1, pixels: 0 })), parts = Array.from({ length: 5 }, () => Buffer.alloc(count * 4));
    let eyeState = specs.eyes[slot.nativeCell] ?? 'open';
    const parentFace=faceMap.get(physicalIndex),point=([x,y])=>[material.pivot.x+(x-material.pivot.x)*material.scale,material.pivot.y+(y-material.pivot.y)*material.scale];
    const face=parentFace&&{...parentFace,eyes:parentFace.eyes.map(eye=>({...eye,center:point(eye.center),bounds:[...point(eye.bounds.slice(0,2)),...point(eye.bounds.slice(2))]})),mouth:parentFace.mouth&&{...parentFace.mouth,x:point([parentFace.mouth.x,parentFace.mouth.y])[0],y:point([parentFace.mouth.x,parentFace.mouth.y])[1],bounds:[...point(parentFace.mouth.bounds.slice(0,2)),...point(parentFace.mouth.bounds.slice(2))]}};
    let faceProtected = 0;
    if (face) {
      const regions = [...face.eyes.map(eye => [eye.bounds[0] - 1.5, eye.bounds[1] - 1.5, eye.bounds[2] + 1.5, eye.bounds[3] + 1.5]), ...(face.mouth ? [[face.mouth.bounds[0] - 2, face.mouth.bounds[1] - 2, face.mouth.bounds[2] + 2, face.mouth.bounds[3] + 2]] : [])];
      for (let i = 0; i < count; i++) if (owners[i] && regions.some(([l,t,r,b]) => i % size / 2.4 >= l && i % size / 2.4 <= r && Math.floor(i / size) / 2.4 >= t && Math.floor(i / size) / 2.4 <= b)) { owners[i] = 0; faceProtected++; }
    }
    // Native identity tags govern the complete clip. A changing fitted AABB
    // must never reclassify a wink as open/closed or swap its anatomical side.
    if (physicalIndex >= 144 && physicalIndex < 160) eyeState = 'closed';
    if (physicalIndex === 266) eyeState = 'closed';
    for (let i = 0; i < count; i++) if (data[i * 4 + 3]) {
      const x = i % size, y = Math.floor(i / size), owner = owners[i], target = ((oy + y) * 1536 + ox + x) * 4;
      data.copy(whole, target, i * 4, i * 4 + 4); // Whole-pose band, fast no-hat path.
      data.copy(parts[owner], i * 4, i * 4, i * 4 + 4);
      const box = bounds[owner]; box.left = Math.min(box.left, x); box.top = Math.min(box.top, y); box.right = Math.max(box.right, x); box.bottom = Math.max(box.bottom, y); box.pixels++;
    }
    const partRecords = bounds.map((box, owner) => ({ owner, visible: box.pixels > 0, ...box, source: { x: 0, y: 0, width: Math.max(0, box.right - box.left + 1), height: Math.max(0, box.bottom - box.top + 1) } }));
    for (let owner = 0; owner < 5; owner++) if (bounds[owner].pixels) {
      const box = bounds[owner], width = box.right - box.left + 1, height = box.bottom - box.top + 1;
      const raw = await sharp(parts[owner], { raw: { width: 192, height: 192, channels: 4 } }).extract({ left: box.left, top: box.top, width, height }).raw().toBuffer();
      const signature=`${width}x${height}:${hash(raw)}`,alias=aliases.get(signature);
      if(alias)alias.records.push(partRecords[owner]);else{const crop={width,height,raw,record:partRecords[owner],records:[partRecords[owner]]};aliases.set(signature,crop);crops.push(crop);}
    }
    let mouth = null;
    if (face?.mouth) {
      const [a,b] = face.eyes.map(eye => eye.center), x = (a[0]+b[0])/2, y = (a[1]+b[1])/2, angle = Math.atan2(b[1]-a[1], b[0]-a[0]);
      const depth = Math.max(4, (face.mouth.x-x)*-Math.sin(angle)+(face.mouth.y-y)*Math.cos(angle));
      mouth = {x:x-Math.sin(angle)*depth,y:y+Math.cos(angle)*depth};
    }
    const visible=bounds.reduce((box,p)=>p.pixels?{left:Math.min(box.left,p.left),top:Math.min(box.top,p.top),right:Math.max(box.right,p.right),bottom:Math.max(box.bottom,p.bottom)}:box,{left:192,top:192,right:-1,bottom:-1});
    const clip=[visible.top/2.4-2,(192-visible.right-1)/2.4-2,(192-visible.bottom-1)/2.4-2,visible.left/2.4-2].map((v,i)=>Math.min(frame.clip[i],Math.max(0,Number(v.toFixed(6)))));
    if(visible.right-visible.left+1>policy.material.maxWidth||visible.bottom-visible.top+1>policy.material.maxHeight||visible.left<policy.material.cellMargin||visible.top<policy.material.cellMargin||visible.right>=192-policy.material.cellMargin||visible.bottom>=192-policy.material.cellMargin)throw Error('Material footprint exceeded '+physicalIndex+':'+JSON.stringify(visible));
    let measuredBodyArea=0;for(let i=0;i<count;i++)if(base.body[i]&&!base.owners[i])measuredBodyArea+=data[i*4+3]/255;
    material.measuredArea=measuredBodyArea;
    // The petting replay and live melt share the owner's13A/15B comparison
    // candidate. Other native mouth identities remain source-owned.
    const mouthState = physicalIndex >= 144 && physicalIndex < 160 ? "cat" : specs.mouths?.[slot.nativeCell] ?? "smile";
    frames.push({ physicalIndex, nativeCell: slot.nativeCell, atlas, index: frame.index, material, clip, eyeState, mouthState, mouth, folded: specs.folded[slot.nativeCell] ?? [false, false], parts: partRecords });
    cleanup.push({ physicalIndex, removedExportPixels: removed, keptAuthoredMarks: key.record.marks.length, protectedFacePixels: faceProtected, exactPartition: true });
  }
  const src = `/companion/hd/appearance-20261118-${String(atlas).padStart(2, '0')}.webp`;
  let packed, partHeight = 192;
  while (!(packed = packRectangles(crops, 1536, partHeight))) { partHeight += 192; if (partHeight > 768) throw Error('Part packing budget exceeded'); }
  const height = 384 + partHeight, sheet = Buffer.alloc(1536 * height * 4); whole.copy(sheet);
  for (const crop of packed) {
    for(const record of crop.records){record.source.x=crop.x;record.source.y=crop.y+384;}
    for (let y = 0; y < crop.height; y++) crop.raw.copy(sheet, ((crop.y + 384 + y) * 1536 + crop.x) * 4, y * crop.width * 4, (y + 1) * crop.width * 4);
  }
  const encoded = await sharp(sheet, { raw: { width: 1536, height, channels: 4 } }).webp({ lossless: true, effort: 4 }).toBuffer();
  await fs.writeFile('public' + src, encoded);
  packets.push({ parentSrc: source.src, parentSha256: source.sha256, src, sha256: hash(encoded), bytes: encoded.length, width: 1536, height, gridRows: height / 192 });
  sources.push({ src: source.src, sha256: source.sha256 });
}
await fs.writeFile('lib/ui/viewer-companion/appearance-edition.json', json({ version: 3, eyeReference: policy.eye, packets, frames }));
await fs.writeFile(`${out}/appearance-proof.json`, json({ nativeSha256: hash(native), sourcePackets: sources, nativeKeys: Object.keys(specs.ears).length, frames: frames.length, partsPerFrame: 4, cleanup, bytes: packets.reduce((sum, p) => sum + p.bytes, 0), maxDecodedBytesPerPacket: Math.max(...packets.map(p => p.width * p.height * 4)), maxRetainedPackets: 3, maxInflight: 2, note: 'Same decoder/LRU. Whole-pose plane plus tightly packed crop plane in one URI. Original source bytes unchanged.' }));
console.log(json({ frames: frames.length, keys: Object.keys(specs.ears).length, packets: packets.length, removed: cleanup.reduce((sum, c) => sum + c.removedExportPixels, 0), bytes: packets.reduce((sum, p) => sum + p.bytes, 0) }));
