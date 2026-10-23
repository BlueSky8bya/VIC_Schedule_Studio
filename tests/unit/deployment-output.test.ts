import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error This build-time module is outside the application runtime.
import { ARCHIVE_DIRECTORY, isVercelBuild, prepareDeploymentOutput } from '../../scripts/deployment-output/prepare.mjs';

const sha = (bytes: Buffer | string) => createHash('sha256').update(bytes).digest('hex');
type Entry = { path: string; bytes: number; sha256: string; reason: string };
function fixture(count = 2) {
  fs.mkdirSync('.scratch-pw', { recursive: true });
  const root = fs.mkdtempSync(path.resolve('.scratch-pw/deployment-output-test-'));
  const put = (relative: string, text: string) => { const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
  put('package.json', '{"name":"vic-schedule-studio"}');
  put('app/page.tsx', 'export default function Page() { return null; }');
  put('public/current.webp', 'active public bytes');
  const entries: Entry[] = Array.from({ length: count }, (_, index) => {
    const asset = `public/companion/audio/radio/radio-${String(index + 1).padStart(2, '0')}.ogg`, text = `old recording ${index}`;
    put(asset, text);
    return { path: asset, bytes: Buffer.byteLength(text), sha256: sha(text), reason: 'inactive-radio-v155' };
  });
  return { root, put, entries, manifest: { version: 1, entries } };
}

describe('deployment-only public asset archive', () => {
  it('runs automatically only in a Linux Vercel preview or production build', () => {
    expect(isVercelBuild({ VERCEL: '1', VERCEL_ENV: 'production' }, 'linux')).toBe(true);
    expect(isVercelBuild({ VERCEL: '1', VERCEL_ENV: 'preview' }, 'linux')).toBe(true);
    expect(isVercelBuild({ VERCEL: '1', VERCEL_ENV: 'production' }, 'win32')).toBe(false);
    expect(isVercelBuild({ VERCEL: '1', VERCEL_ENV: 'development' }, 'linux')).toBe(false);
    expect(isVercelBuild({}, 'linux')).toBe(false);
  });

  it('checks the real exact archive without moving any repository original', () => {
    const receipt = prepareDeploymentOutput({ stage: false });
    expect(receipt).toMatchObject({ stage: false, candidates: 186, archivedBytes: 51_717_773, moved: 0, reused: 0, sourceOriginalsDeleted: 0, providerStorageMeasured: false });
    expect(receipt.before).toEqual(receipt.after);
  });

  it('moves only declared bytes in a disposable package and retains their content and timestamps', () => {
    const f = fixture(), modified = fs.statSync(path.join(f.root, f.entries[0].path)).mtimeMs;
    const result = prepareDeploymentOutput({ root: f.root, manifest: f.manifest, stage: true });
    expect(result).toMatchObject({ stage: true, moved: 2, reused: 0, sourceOriginalsDeleted: 0 });
    expect(result.before.bytes - result.after.bytes).toBe(result.archivedBytes);
    for (const entry of f.entries) {
      expect(fs.existsSync(path.join(f.root, entry.path))).toBe(false);
      expect(sha(fs.readFileSync(path.join(f.root, ARCHIVE_DIRECTORY, entry.path)))).toBe(entry.sha256);
    }
    expect(fs.statSync(path.join(f.root, ARCHIVE_DIRECTORY, f.entries[0].path)).mtimeMs).toBe(modified);
    expect(fs.readFileSync(path.join(f.root, 'public/current.webp'), 'utf8')).toBe('active public bytes');
  });

  it('rechecks the archived bytes when a build invokes prebuild twice', () => {
    const f = fixture();
    prepareDeploymentOutput({ root: f.root, manifest: f.manifest, stage: true });
    const repeated = prepareDeploymentOutput({ root: f.root, manifest: f.manifest, stage: true });
    expect(repeated).toMatchObject({ moved: 0, reused: 2 });
    expect(repeated.before).toEqual(repeated.after);
    fs.writeFileSync(path.join(f.root, ARCHIVE_DIRECTORY, f.entries[1].path), 'changed archive');
    expect(() => prepareDeploymentOutput({ root: f.root, manifest: f.manifest, stage: true })).toThrow('Archive bytes changed');
  });

  it('rejects a reintroduced runtime reference before moving any asset', () => {
    const f = fixture();
    f.put('lib/current.ts', `export const track = '/companion/audio/radio/radio-02.ogg';`);
    expect(() => prepareDeploymentOutput({ root: f.root, manifest: f.manifest, stage: true })).toThrow('runtime reference');
    expect(f.entries.every(entry => fs.existsSync(path.join(f.root, entry.path)))).toBe(true);
  });

  it('rejects one stale digest before moving an earlier valid entry', () => {
    const f = fixture(); f.entries[1].sha256 = '0'.repeat(64);
    expect(() => prepareDeploymentOutput({ root: f.root, manifest: f.manifest, stage: true })).toThrow('Archive bytes changed');
    expect(f.entries.every(entry => fs.existsSync(path.join(f.root, entry.path)))).toBe(true);
    expect(fs.existsSync(path.join(f.root, ARCHIVE_DIRECTORY))).toBe(false);
  });

  it('rejects missing, repeated and out-of-scope entries', () => {
    const f = fixture(1);
    expect(() => prepareDeploymentOutput({ root: f.root, manifest: { version: 1, entries: [...f.entries, ...f.entries] }, stage: true })).toThrow('repeated');
    for (const invalid of ['../outside.ogg', 'public/current.webp', 'public\\companion\\hd\\old.webp']) {
      expect(() => prepareDeploymentOutput({ root: f.root, manifest: { version: 1, entries: [{ ...f.entries[0], path: invalid }] }, stage: true })).toThrow('Invalid');
    }
    const missing = { ...f.entries[0], path: 'public/companion/audio/radio/radio-32.ogg' };
    expect(() => prepareDeploymentOutput({ root: f.root, manifest: { version: 1, entries: [missing] }, stage: true })).toThrow('missing');
  });

  it('rejects a destination collision instead of overwriting an original', () => {
    const f = fixture(1); f.put(`${ARCHIVE_DIRECTORY}/${f.entries[0].path}`, 'existing target');
    expect(() => prepareDeploymentOutput({ root: f.root, manifest: f.manifest, stage: true })).toThrow('duplicated');
    expect(fs.readFileSync(path.join(f.root, ARCHIVE_DIRECTORY, f.entries[0].path), 'utf8')).toBe('existing target');
  });

  it('rejects linked archive parents before following them outside the package', () => {
    const f = fixture(1), outside = fixture(1);
    fs.symlinkSync(outside.root, path.join(f.root, ARCHIVE_DIRECTORY), process.platform === 'win32' ? 'junction' : 'dir');
    expect(() => prepareDeploymentOutput({ root: f.root, manifest: f.manifest, stage: true })).toThrow('Linked archive path');
    expect(fs.readFileSync(path.join(f.root, f.entries[0].path), 'utf8')).toBe('old recording 0');
    expect(fs.readFileSync(path.join(outside.root, outside.entries[0].path), 'utf8')).toBe('old recording 0');
  });

  it('rejects a receipt hardlink before moving assets or changing the outside file', () => {
    const f = fixture(), outside = fixture(1), outsideFile = path.join(outside.root, 'public/current.webp');
    fs.mkdirSync(path.join(f.root, ARCHIVE_DIRECTORY));
    const receiptPath = path.join(f.root, ARCHIVE_DIRECTORY, 'receipt.json');
    fs.linkSync(outsideFile, receiptPath);
    expect(fs.statSync(receiptPath).nlink).toBe(2);
    expect(() => prepareDeploymentOutput({ root: f.root, manifest: f.manifest, stage: true })).toThrow('Unsafe archive receipt file');
    expect(fs.readFileSync(outsideFile, 'utf8')).toBe('active public bytes');
    for (const entry of f.entries) expect(sha(fs.readFileSync(path.join(f.root, entry.path)))).toBe(entry.sha256);
    expect(fs.statSync(receiptPath).nlink).toBe(2);
  });

  it('rejects a linked receipt entry before staging any assets', () => {
    const f = fixture(), outside = fixture(1);
    fs.mkdirSync(path.join(f.root, ARCHIVE_DIRECTORY));
    const receiptPath = path.join(f.root, ARCHIVE_DIRECTORY, 'receipt.json');
    // Junctions are supported without elevation on Windows and exercise the
    // same lstat symlink guard; Unix exercises a file symlink to real data.
    fs.symlinkSync(process.platform === 'win32' ? outside.root : path.join(outside.root, 'public/current.webp'), receiptPath, process.platform === 'win32' ? 'junction' : 'file');
    expect(() => prepareDeploymentOutput({ root: f.root, manifest: f.manifest, stage: true })).toThrow('Linked archive path');
    expect(fs.readFileSync(path.join(outside.root, 'public/current.webp'), 'utf8')).toBe('active public bytes');
    for (const entry of f.entries) expect(sha(fs.readFileSync(path.join(f.root, entry.path)))).toBe(entry.sha256);
  });

  it('refuses to overwrite an unrelated regular receipt file', () => {
    const f = fixture(); f.put(`${ARCHIVE_DIRECTORY}/receipt.json`, 'unrelated original');
    expect(() => prepareDeploymentOutput({ root: f.root, manifest: f.manifest, stage: true })).toThrow('Unmanaged archive receipt file');
    expect(fs.readFileSync(path.join(f.root, ARCHIVE_DIRECTORY, 'receipt.json'), 'utf8')).toBe('unrelated original');
    expect(f.entries.every(entry => fs.existsSync(path.join(f.root, entry.path)))).toBe(true);
  });

  it('rechecks receipt safety and restores assets when a hardlink appears after preflight', () => {
    const f = fixture(), outside = fixture(1), outsideFile = path.join(outside.root, 'public/current.webp'), original = fs.renameSync;
    let injected = false;
    const rename = vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      original(from, to);
      if (!injected && String(from) === path.join(f.root, f.entries[0].path)) {
        injected = true;
        fs.linkSync(outsideFile, path.join(f.root, ARCHIVE_DIRECTORY, 'receipt.json'));
      }
    });
    try {
      expect(() => prepareDeploymentOutput({ root: f.root, manifest: f.manifest, stage: true })).toThrow('Unsafe archive receipt file');
      expect(injected).toBe(true);
      expect(fs.readFileSync(outsideFile, 'utf8')).toBe('active public bytes');
      for (const entry of f.entries) expect(sha(fs.readFileSync(path.join(f.root, entry.path)))).toBe(entry.sha256);
    } finally { rename.mockRestore(); }
  });

  it('rolls back staged assets if atomic receipt publication fails', () => {
    const f = fixture(), original = fs.renameSync;
    const rename = vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (path.basename(String(from)).startsWith('.receipt-')) throw Error('simulated receipt publication failure');
      return original(from, to);
    });
    try {
      expect(() => prepareDeploymentOutput({ root: f.root, manifest: f.manifest, stage: true })).toThrow('simulated receipt publication failure');
      for (const entry of f.entries) expect(sha(fs.readFileSync(path.join(f.root, entry.path)))).toBe(entry.sha256);
      expect(fs.existsSync(path.join(f.root, ARCHIVE_DIRECTORY, 'receipt.json'))).toBe(false);
    } finally { rename.mockRestore(); }
  });

  it('restores earlier moves if the later package move fails', () => {
    const f = fixture(), original = fs.renameSync;
    const rename = vi.spyOn(fs, 'renameSync').mockImplementation((from, to) => {
      if (String(from) === path.join(f.root, f.entries[1].path)) throw Error('simulated package failure');
      return original(from, to);
    });
    try {
      expect(() => prepareDeploymentOutput({ root: f.root, manifest: f.manifest, stage: true })).toThrow('simulated package failure');
      for (const entry of f.entries) expect(sha(fs.readFileSync(path.join(f.root, entry.path)))).toBe(entry.sha256);
    } finally { rename.mockRestore(); }
  });

  it('keeps build staging excluded and runs before metadata and next build', () => {
    expect(fs.readFileSync('.vercelignore', 'utf8')).toContain(`/${ARCHIVE_DIRECTORY}/`);
    expect(fs.readFileSync('.gitignore', 'utf8')).toContain(`/${ARCHIVE_DIRECTORY}/`);
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    expect(pkg.scripts.prebuild).toMatch(/^node scripts\/deployment-output\/prepare\.mjs && node scripts\/generate-ambient-art-metadata\.mjs/);
  });
});
