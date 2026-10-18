// Original code-native ornaments. No body raster is edited or regenerated.
import fs from 'node:fs/promises';
const ids = ['bell-badge', 'heart-badge', 'lemon-badge', 'eyepatch', 'propeller-hat', 'magic-pocket', 'bandage', 'tiny-crown', 'mushroom-hat', 'star-patch', 'propeller-rotor', 'magic-pocket-open'];
const shapes = {
  'bell-badge': '<circle cx="64" cy="40" r="7" fill="#e5bd62"/><path d="M43 62Q43 43 64 43Q85 43 85 62L92 83Q64 98 36 83Z" fill="#ffdb83"/><path d="M39 79Q64 86 89 79M64 83V91" fill="none"/><circle cx="64" cy="91" r="5" fill="#96713f"/><path d="M51 54Q47 60 47 67" fill="none" stroke="#fff3bb" stroke-width="5"/>',
  'heart-badge': '<path d="M64 94C54 84 29 69 34 50C38 33 55 32 64 46C73 32 90 33 94 50C99 69 74 84 64 94Z" fill="#f39aaa"/><path d="M44 49Q49 42 55 48" fill="none" stroke="#ffe5e5" stroke-width="5"/>',
  'lemon-badge': '<path d="M36 76C25 52 53 30 80 40L94 38L92 52C106 78 74 101 50 89L37 91Z" fill="#ffe17a"/><path d="M74 39Q82 24 95 31Q92 42 80 43" fill="#a3bd83"/><path d="M43 61Q45 49 57 47" fill="none" stroke="#fff4bc" stroke-width="5"/>',
  eyepatch: '<path d="M18 51Q43 43 59 48M89 47L111 40" fill="none" stroke="#5a4c44" stroke-width="5"/><path d="M57 45Q75 37 94 46L91 67Q77 83 60 68Z" fill="#453f42"/><path d="M65 50L74 47" fill="none" stroke="#766b6a" stroke-width="3"/>',
  'propeller-hat': '<path d="M64 97V22" fill="none" stroke="#bd9366" stroke-width="4"/><g transform="translate(0 40)"><path d="M24 75Q30 48 64 49Q98 48 104 75L96 84H32Z" fill="#f8d788"/><path d="M64 50Q49 58 47 79M64 50Q81 60 82 79" fill="none" stroke="#dcaf68"/><ellipse cx="64" cy="80" rx="42" ry="7" fill="#efd4a5"/></g>',
  'magic-pocket': '<path d="M26 44Q64 30 102 44L97 76Q94 103 64 105Q34 103 31 76Z" fill="#f9e5c0"/><path d="M28 44Q64 58 100 44" fill="none" stroke="#b88f62" stroke-width="5"/><path d="M39 65Q38 91 64 94Q89 92 89 65" fill="none" stroke="#d4b78b" stroke-dasharray="3 5"/><path d="M64 62L68 72L79 73L71 81L73 92L64 86L55 92L57 81L49 73L60 72Z" fill="#efbd62"/>',
  bandage: '<rect x="26" y="45" width="76" height="39" rx="15" fill="#f2c5ad"/><path d="M48 46V83M80 46V83" stroke="#d8a38b" fill="none"/><path d="M64 51L68 60L78 61L70 68L73 77L64 72L55 77L58 68L50 61L60 60Z" fill="#fff3ca"/>',
  'tiny-crown': '<path d="M30 83L24 41L46 58L64 31L82 58L104 41L98 83Z" fill="#ffda7a"/><path d="M31 81H97V94H31Z" fill="#edbd60"/><circle cx="64" cy="77" r="7" fill="#eea2a0"/><circle cx="24" cy="39" r="5" fill="#fff0b3"/><circle cx="64" cy="29" r="5" fill="#fff0b3"/><circle cx="104" cy="39" r="5" fill="#fff0b3"/>',
  'mushroom-hat': '<path d="M43 69H85L88 96H40Z" fill="#fff2d7"/><path d="M18 72Q19 25 64 25Q109 25 110 72Q68 89 18 72Z" fill="#dc9480"/><ellipse cx="64" cy="72" rx="46" ry="11" fill="#f4d9bd"/><ellipse cx="43" cy="49" rx="10" ry="8" fill="#fff2dc" stroke="none"/><ellipse cx="78" cy="40" rx="9" ry="7" fill="#fff2dc" stroke="none"/><ellipse cx="94" cy="59" rx="6" ry="7" fill="#fff2dc" stroke="none"/>',
  'star-patch': '<path d="M18 53L55 52M87 48L111 42" fill="none" stroke="#b69569" stroke-width="4"/><path d="M75 36L81 48L95 50L85 60L87 74L75 67L62 74L65 60L54 50L69 48Z" fill="#f7d27e"/><path d="M72 46L76 42" fill="none" stroke="#fff2b7" stroke-width="3"/>',
  'propeller-rotor': '<ellipse cx="43" cy="22" rx="25" ry="7" transform="rotate(-7 43 22)" fill="#b8d1bd"/><ellipse cx="85" cy="22" rx="25" ry="7" transform="rotate(-7 85 22)" fill="#e8b2a1"/><circle cx="64" cy="22" r="7" fill="#e9cd8d"/>',
  'magic-pocket-open': '<path d="M26 44Q64 30 102 44L97 76Q94 103 64 105Q34 103 31 76Z" fill="#f9e5c0"/><ellipse cx="64" cy="47" rx="36" ry="11" fill="#86705c"/><path d="M28 47Q64 62 100 47" fill="none" stroke="#e3c69d" stroke-width="6"/><path d="M39 67Q38 91 64 94Q89 92 89 67" fill="none" stroke="#d4b78b" stroke-dasharray="3 5"/><path d="M64 64L68 73L79 74L71 82L73 93L64 87L55 93L57 82L49 74L60 73Z" fill="#efbd62"/>',
};
const cells = ids.flatMap((id, row) => ['front', 'quarter', 'side', 'back'].map((view, column) => {
  const scale = view === 'quarter' ? .83 : view === 'side' ? .56 : 1;
  return `<g transform="translate(${column * 128} ${row * 128})"><g transform="translate(${64 - 64 * scale + (view === 'quarter' ? 3 : 0)} 0) scale(${scale} 1)" stroke="#ad8c67" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">${shapes[id]}</g></g>`;
}));
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="${ids.length * 128}" viewBox="0 0 512 ${ids.length * 128}">${cells.join('')}</svg>\n`;
const file = 'public/companion/collection/accessories-111-v1.svg';
if (process.argv.includes('--check')) { if (await fs.readFile(file, 'utf8') !== svg) throw Error('Accessory vector atlas differs from its original code source'); }
else await fs.writeFile(file, svg);
console.log(`${process.argv.includes('--check') ? 'Verified' : 'Prepared'} ${ids.length * 4} original vector cells`);
