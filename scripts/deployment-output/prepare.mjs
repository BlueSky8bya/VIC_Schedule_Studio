// Package only active public assets. Originals and immutable creation receipts
// remain at their historical paths in every source checkout and local QA run.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

export const ARCHIVE_DIRECTORY = '.deployment-output-archive';
const manifestPath = fileURLToPath(new URL('./archive-manifest.json', import.meta.url));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const inside = (root, target) => target.startsWith(`${root}${path.sep}`);
const sourceExtensions = /\.(?:tsx?|jsx?|css|json|mjs)$/;
const allowedAsset = /^public\/(?:companion\/(?:hd\/[^/]+\.webp|audio\/radio\/radio-(?:0[1-9]|[12]\d|3[0-2])\.ogg|(?:victamin-motion|vitamin-fluid-q95|victamin-fluid|victamin-clean|vitamin-keyposes-2x)\.webp)|premiere\/(?:victamin-audience|victamin-audience-big-eyes-v1)\.webp)$/;

export function isVercelBuild(env = process.env, platform = process.platform) {
  return platform === 'linux' && env.VERCEL === '1' && ['production', 'preview'].includes(env.VERCEL_ENV);
}

function checkedPath(root, relative) {
  if (typeof relative !== 'string' || relative.includes('\\') || relative.split('/').some(p => !p || p === '.' || p === '..')) throw Error('Invalid archive asset path');
  const target = path.resolve(root, relative);
  if (!inside(root, target)) throw Error('Archive asset escapes project');
  let cursor = root;
  for (const segment of relative.split('/')) {
    cursor = path.join(cursor, segment);
    if (fs.lstatSync(cursor, { throwIfNoEntry: false })?.isSymbolicLink()) throw Error(`Linked archive path: ${relative}`);
  }
  return target;
}

function runtimeTexts(root) {
  const rows = [];
  function visit(directory) {
    if (!fs.existsSync(directory)) return;
    if (fs.lstatSync(directory).isSymbolicLink()) throw Error('Linked runtime source directory is not supported');
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw Error('Linked runtime source directory is not supported');
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile() && sourceExtensions.test(entry.name)) rows.push({ path: path.relative(root, full), text: fs.readFileSync(full, 'utf8') });
    }
  }
  for (const directory of ['app', 'components', 'lib']) visit(path.join(root, directory));
  return rows;
}

function publicInventory(root) {
  let files = 0, bytes = 0;
  function visit(directory) {
    if (fs.lstatSync(directory).isSymbolicLink()) throw Error('Linked public asset directory is not supported');
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const full = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) throw Error('Linked public asset is not supported');
      if (entry.isDirectory()) visit(full);
      else if (entry.isFile()) { files++; bytes += fs.statSync(full).size; }
    }
  }
  visit(path.join(root, 'public'));
  return { files, bytes };
}

function checkedReceipt(root, manifestSha256) {
  const target = checkedPath(root, `${ARCHIVE_DIRECTORY}/receipt.json`);
  const stat = fs.lstatSync(target, { throwIfNoEntry: false });
  if (!stat) return target;
  // A hardlink is not detected by checkedPath's symlink guard. Never write
  // through an existing receipt or replace an unrelated/unmanaged file.
  if (!stat.isFile() || stat.nlink !== 1 || stat.size > 1024 * 1024) throw Error('Unsafe archive receipt file');
  let previous;
  try { previous = JSON.parse(fs.readFileSync(target, 'utf8')); }
  catch { throw Error('Unmanaged archive receipt file'); }
  if (previous?.version !== 1 || previous.stage !== true || previous.manifestSha256 !== manifestSha256) throw Error('Unmanaged archive receipt file');
  return target;
}

function publishReceipt(root, receipt) {
  const target = checkedReceipt(root, receipt.manifestSha256);
  const temporary = checkedPath(root, `${ARCHIVE_DIRECTORY}/.receipt-${process.pid}-${crypto.randomUUID()}.tmp`);
  // O_EXCL refuses any pre-existing file/link. Write only the newly owned fd,
  // then replace the directory entry atomically instead of following it.
  const fd = fs.openSync(temporary, 'wx', 0o600);
  try {
    const stat = fs.fstatSync(fd);
    if (!stat.isFile() || stat.nlink !== 1) throw Error('Unsafe temporary archive receipt');
    fs.writeFileSync(fd, `${JSON.stringify(receipt, null, 2)}\n`);
    fs.fsyncSync(fd);
  } finally { fs.closeSync(fd); }
  checkedReceipt(root, receipt.manifestSha256);
  fs.renameSync(temporary, target);
}

export function prepareDeploymentOutput({ root = process.cwd(), stage = false, manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) } = {}) {
  root = fs.realpathSync(root);
  if (JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).name !== 'vic-schedule-studio') throw Error('Wrong deployment project');
  if (manifest.version !== 1 || !Array.isArray(manifest.entries) || manifest.entries.length < 1 || manifest.entries.length > 512) throw Error('Invalid archive manifest');
  const texts = runtimeTexts(root), before = publicInventory(root), seen = new Set(), checked = [];
  const archiveRoot = checkedPath(root, ARCHIVE_DIRECTORY);
  const manifestSha256 = hash(Buffer.from(JSON.stringify(manifest)));
  // Include the final output path in the all-before-any-move preflight.
  checkedReceipt(root, manifestSha256);
  // Validate every source, destination and live reference before the first move.
  for (const entry of manifest.entries) {
    if (!allowedAsset.test(entry.path) || seen.has(entry.path) || !Number.isSafeInteger(entry.bytes) || entry.bytes < 1 || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw Error('Invalid or repeated archive entry');
    seen.add(entry.path);
    const source = checkedPath(root, entry.path), destination = checkedPath(root, `${ARCHIVE_DIRECTORY}/${entry.path}`);
    const reference = texts.find(row => row.text.includes(path.posix.basename(entry.path)));
    if (reference) throw Error(`Archive asset has a runtime reference: ${entry.path} in ${reference.path}`);
    const sourceExists = fs.existsSync(source), destinationExists = fs.existsSync(destination);
    if (sourceExists === destinationExists) throw Error(`Archive asset missing or duplicated: ${entry.path}`);
    const existing = sourceExists ? source : destination, stat = fs.lstatSync(existing);
    if (!stat.isFile() || stat.size !== entry.bytes || hash(fs.readFileSync(existing)) !== entry.sha256) throw Error(`Archive bytes changed: ${entry.path}`);
    if (!sourceExists && !stage) throw Error(`Read-only check requires source originals: ${entry.path}`);
    checked.push({ ...entry, source, destination, alreadyStaged: !sourceExists });
  }
  const archivedBytes = checked.reduce((sum, entry) => sum + entry.bytes, 0);
  const receipt = { version: 1, stage, manifestSha256, candidates: checked.length, archivedBytes, before, after: before, moved: 0, reused: checked.filter(entry => entry.alreadyStaged).length, sourceOriginalsDeleted: 0, providerStorageMeasured: false };
  if (!stage) return receipt;
  const moved = [];
  try {
    for (const entry of checked) {
      if (entry.alreadyStaged) continue;
      fs.mkdirSync(path.dirname(entry.destination), { recursive: true });
      fs.renameSync(entry.source, entry.destination);
      moved.push(entry);
    }
    receipt.after = publicInventory(root);
    receipt.moved = moved.length;
    const remainingBytes = checked.filter(entry => !entry.alreadyStaged).reduce((sum, entry) => sum + entry.bytes, 0);
    if (receipt.before.bytes - receipt.after.bytes !== remainingBytes) throw Error('Public output byte delta does not match archive');
    fs.mkdirSync(archiveRoot, { recursive: true });
    publishReceipt(root, receipt);
    return receipt;
  } catch (error) {
    for (const entry of moved.reverse()) {
      if (!fs.existsSync(entry.source) && fs.existsSync(entry.destination)) fs.renameSync(entry.destination, entry.source);
    }
    throw error;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  if (args.some(argument => argument !== '--check')) throw Error('Usage: node scripts/deployment-output/prepare.mjs [--check]');
  if (!args.includes('--check') && !isVercelBuild()) console.log('Deployment output: local source checkout retained (not a Vercel cloud build).');
  else console.log(`Deployment output: ${JSON.stringify(prepareDeploymentOutput({ stage: !args.includes('--check') }))}`);
}
