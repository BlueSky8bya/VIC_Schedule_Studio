// Embedded as a self-contained browser function by ear-pilot.mjs.
export function setupEarLab(portraits) {
  const hat = document.querySelector('#hat'), front = document.querySelector('#front'), grid = document.querySelector('.grid');
  hat.innerHTML = portraits[0].hats.map((item, i) => `<option value="${i}">${item.name}</option>`).join('');
  const images = new Map();
  const image = src => {
    if (!images.has(src)) images.set(src, new Promise((resolve, reject) => {
      const node = new Image(); node.onload = () => resolve(node); node.onerror = reject; node.src = src;
    }));
    return images.get(src);
  };
  let generation = 0;
  async function draw() {
    const serial = ++generation, hatIndex = Number(hat.value), tipsInFront = front.checked;
    document.body.dataset.ready = 'false'; grid.innerHTML = '';
    for (const portrait of portraits) {
      const item = portrait.hats[hatIndex];
      const [native, hatImage, partEntries, rearImage] = await Promise.all([
        image(portrait.native), image(item.image),
        Promise.all(Object.entries(portrait.pngs).map(async ([name, src]) => [name, await image(src)])),
        item.rear ? image(item.rear.image) : undefined,
      ]);
      if (serial !== generation) return;
      const parts = Object.fromEntries(partEntries);
      for (const mode of ['before', 'after', 'layers']) {
        const figure = document.createElement('figure'), canvas = document.createElement('canvas'), label = document.createElement('figcaption');
        canvas.width = canvas.height = 384;
        label.textContent = `${portrait.spec.physicalIndex} · ${{ before: '현재 겹침', after: '분할 시제품', layers: '분리된 귀 조각' }[mode]}`;
        figure.append(canvas, label); grid.append(figure);
        const ctx = canvas.getContext('2d'); ctx.scale(384 / 80, 384 / 80);
        const part = (name, dx = 0, dy = 0) => ctx.drawImage(parts[name], dx, dy, 80, 80);
        if (mode !== 'layers' && item.rear) {
          const { art, anchor, pivot } = item.rear, scale = anchor.width / art.content.width;
          ctx.save(); ctx.translate(anchor.x, anchor.y); ctx.rotate(anchor.roll * Math.PI / 180); ctx.scale(item.placement.mirror ?? 1, 1);
          ctx.drawImage(rearImage, art.x, art.y, art.width, art.height, -pivot.x * scale, -pivot.y * scale, art.width * scale, art.height * scale); ctx.restore();
        }
        if (mode === 'before') ctx.drawImage(native, 0, 0, 80, 80);
        else {
          part('body');
          for (const side of ['left', 'right']) {
            const dx = mode === 'layers' ? side === 'left' ? -3 : 3 : 0;
            part(side + '-root', dx, mode === 'layers' ? -1 : 0);
            if (mode === 'layers') part(side + '-tip', dx * 2, -3);
            else if (!portrait.spec[side].tipInFront || !tipsInFront) part(side + '-tip');
          }
        }
        if (mode !== 'layers') {
          const placement = item.placement, art = placement.art, scale = placement.width / art.content.width;
          ctx.save(); ctx.translate(placement.x, placement.y); ctx.rotate(placement.rotation * Math.PI / 180); ctx.scale(placement.mirror ?? 1, 1);
          ctx.drawImage(hatImage, art.x, art.y, art.width, art.height, (-art.content.x - art.content.width / 2) * scale, (-art.content.y - art.content.height / 2) * scale, art.width * scale, art.height * scale); ctx.restore();
        }
        if (mode === 'after' && tipsInFront) for (const side of ['left', 'right']) if (portrait.spec[side].tipInFront) part(side + '-tip');
      }
    }
    if (serial === generation) document.body.dataset.ready = 'true';
  }
  for (const control of [hat, front]) control.addEventListener('change', () => { void draw(); });
  void draw();
}
