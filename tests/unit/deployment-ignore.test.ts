import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

// Real isolated Git history exercises the release gate without provider access.
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'vic-deployment-ignore-'));
const script = path.resolve('scripts/deployment-output/ignore-build.mjs');
const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true }).trim();
const put = (name: string) => { fs.mkdirSync(path.dirname(path.join(root, name)), { recursive: true }); fs.writeFileSync(path.join(root, name), name); };
let baseline: string;
let decide: (options: { cwd: string; env: Record<string, string> }) => { skip: boolean };
const envFor = (previous = baseline) => ({ VERCEL: '1', VERCEL_ENV: 'production', VERCEL_GIT_PREVIOUS_SHA: previous, VERCEL_GIT_COMMIT_SHA: git('rev-parse', 'HEAD') });

beforeAll(async () => {
  git('init', '--quiet');
  git('config', 'user.name', 'Synthetic test');
  git('config', 'user.email', 'fixture@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  put('app/page.tsx');
  git('add', '.'); git('commit', '--quiet', '-m', 'baseline');
  baseline = git('rev-parse', 'HEAD');
  ({ decideBuild: decide } = await import(/* @vite-ignore */ pathToFileURL(script).href));
});
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));

describe.sequential('conservative Vercel build gate', () => {
  it('continues first deploy, unknown/missing baseline and same-commit redeploy', () => {
    for (const previous of ['', 'f'.repeat(40), baseline, '--all']) {
      expect(decide({ cwd: root, env: envFor(previous) }).skip).toBe(false);
    }
  });
  it('skips several documentation-only commits since the successful deployment', () => {
    for (const name of ['docs/notes with spaces.md', '.agents/skills/example/SKILL.md']) {
      put(name); git('add', '.'); git('commit', '--quiet', '-m', 'documentation');
    }
    expect(decide({ cwd: root, env: envFor() }).skip).toBe(true);
    const result = spawnSync(process.execPath, [script], { cwd: root, env: { ...process.env, ...envFor() }, encoding: 'utf8', windowsHide: true });
    expect(result.status).toBe(0);
  });
  it('continues when checkout or environment does not match', () => {
    expect(decide({ cwd: root, env: { ...envFor(), VERCEL_GIT_COMMIT_SHA: baseline } }).skip).toBe(false);
    expect(decide({ cwd: root, env: { ...envFor(), VERCEL: '' } }).skip).toBe(false);
  });
  it('continues for runtime changes followed by a docs-only commit', () => {
    put('public/new.webp'); git('add', '.'); git('commit', '--quiet', '-m', 'asset');
    put('docs/later.md'); git('add', '.'); git('commit', '--quiet', '-m', 'documentation after runtime');
    expect(decide({ cwd: root, env: envFor() }).skip).toBe(false);
  });
  it('continues for moving runtime files into documentation and unknown inputs', () => {
    const previous = git('rev-parse', 'HEAD');
    git('mv', 'app/page.tsx', 'docs/page.tsx'); git('commit', '--quiet', '-m', 'move runtime');
    expect(decide({ cwd: root, env: envFor(previous) }).skip).toBe(false);
    const beforeUnknown = git('rev-parse', 'HEAD');
    put('new-build.config'); git('add', '.'); git('commit', '--quiet', '-m', 'unknown input');
    expect(decide({ cwd: root, env: envFor(beforeUnknown) }).skip).toBe(false);
    expect(decide({ cwd: root, env: { ...envFor(beforeUnknown), VERCEL_ENV: 'preview' } }).skip).toBe(false);
  });
  it('continues with a real shallow clone or divergent successful baseline', () => {
    const branch = git('symbolic-ref', '--short', 'HEAD');
    git('checkout', '--quiet', '-b', 'side', baseline);
    put('docs/side.md'); git('add', '.'); git('commit', '--quiet', '-m', 'divergent documentation');
    const side = git('rev-parse', 'HEAD');
    git('checkout', '--quiet', branch);
    expect(decide({ cwd: root, env: envFor(side) }).skip).toBe(false);
    const shallow = path.join(root, 'shallow');
    git('clone', '--quiet', '--depth', '1', pathToFileURL(root).href, shallow);
    expect(decide({ cwd: shallow, env: envFor() }).skip).toBe(false);
  });
});
