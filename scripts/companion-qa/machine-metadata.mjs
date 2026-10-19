/** Exact, independently audited legacy JSON prerequisites; never a directory allowlist. */
import { createHash } from 'node:crypto';
const base = 'art-src/빅타민/동행/작업회차/';
export const AUDITED_MACHINE_METADATA = Object.freeze([
  ['20261019-얼굴정렬교정118/정리본/hd-motion-sprite.json', 61144, 'cf78195f7e4b4a790aaddeabbca50b3a397d3e1fdd1582e2191f106284674ff7'],
  ['20261019-얼굴정렬교정118/정리본/accessory-anchors.json', 689660, 'e66bc660db56d4e6bafacffc915341e05d81b6a1e9a5eb2e04a12a7074ad6f3a'],
  ['20261018-동작연결정리115/정리본/play-motion-sprite.json', 41698, '3edf77137e28a7a7b06070785bd4b65e24849712ddd6f969a36845e951df69fa'],
  ['20261018-동작연결정리115/정리본/living-motion-sprite.json', 1951, '32906ec5767321b616d2b3f6f9432e6623fc625a7e81e8f9ad9a8db8ca64a084'],
  ['20261019-얼굴정렬교정118/패킹파생기록.json', 2279, '09c02d11f852c26d63838b34f93ffd85c34ffab8f31ad4f937f62c7198e1c4d4'],
  ['20261019-얼굴정렬교정118/합성범위.json', 1472, '6f6cb12452a6a6ac40ed3a390e30f5aa58ea019833cea523a5c4f27fece46520'],
  ['20261019-얼굴정렬교정118/고정입력/hd-motion-sprite.json', 61146, 'e57eca86ace1f0d6eca2916a538fc2f45feca8eaad5b95b722c19e128226f22a'],
  ['20261019-얼굴정렬교정118/고정입력/accessory-anchors.json', 689673, 'b9bbb8367fb1ec05644cde77546cd158b304cab76e7c158014aa775c58def6dc'],
  ['20261018-점프노란조각교정117/패킹파생기록.json', 7991, '71713735fba5236094225aa7778cf37d4f20a183539fa5c1930a0deb69675a5f'],
  ['20261018-점프노란조각교정117/고정입력/accessory-anchors.json', 689586, '513415b536a30520f4e9bc66c967b527ca84c16d63f111bd74ba14e786792ada'],
  ['20261018-포즈통일114/고정입력/living-motion-sprite.json', 1876, '12aa71ac30c011595d5971acfb1c9fca913ab835fcbee17b77b48d190aad6ea2'],
  ['20261019-표정체적교정119/패킹파생기록.json', 132647, '6e25109580595a13ca57c6f657d08c5217d7cca8be5fcb15b431fbee691ab804'],
  ['20261018-포즈통일114/정리본/hd-motion-sprite.json', 59558, '3fc9eeb849103f446a7412cdfd2f92da522d7bfc6b7628be8ae9081e3e120d95'],
  ['20261018-포즈통일114/정리본/play-motion-sprite.json', 41709, '681baa3aa19065e2d53e098f621ad31754fe3d9c929faceef29f37a6e7d0141f'],
  ['20261018-포즈통일114/정리본/living-motion-sprite.json', 1941, 'dc2f0fc1e621e7cbbce61bb1e2b734cb77451dd64a8937881636d39efb74ecf9'],
  ['20261018-동작연결정리115/패킹파생기록.json', 1053195, '56737de7e348a530ab255ef6f9c4e2a8c428a673febf0bcf1ab44b6969b33e4a'],
  ['20261019-쓰다듬기행복131/패킹파생기록.json', 25935, 'cd004e38c461114e50749eeff1b1856e33ca5050bdea4dfd3bbd3541b4fc17a5'],
  ['20261019-쓰다듬기눈선133/패킹파생기록.json', 37157, 'd56e5dfa37b49f2595926b5a9eaca70cf2bab942d314b3b89dbb51f73f58553e'],
].map(([relative, bytes, sha256]) => Object.freeze({ path: base + relative, bytes, sha256 })));
export const AUDITED_MACHINE_METADATA_BYTES = 3600618;
if (AUDITED_MACHINE_METADATA.length !== 18 || AUDITED_MACHINE_METADATA.reduce((sum, entry) => sum + entry.bytes, 0) !== AUDITED_MACHINE_METADATA_BYTES) throw Error('Audited metadata universe changed; independent re-audit is required');
export function validateAuditedMachineMetadata(relative, bytes, proof) {
  const entry = AUDITED_MACHINE_METADATA.find(entry => entry.path === relative);
  if (!entry || !proof.tracked || !proof.headUnchanged || !(bytes instanceof Uint8Array) || bytes.byteLength !== entry.bytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw Error('Machine JSON is not an unchanged tracked member of the exact audited path/byte/hash set');
  const parsed = JSON.parse(Buffer.from(bytes).toString('utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error('Audited machine metadata must remain a JSON object');
  // Paths, src and creatorFindingsPath are inert historical string metadata.
  // Never resolve, read or copy referenced files from this JSON.
  return entry;
}
