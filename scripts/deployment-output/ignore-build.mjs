// Vercel: exit 0 skips the build; exit 1 continues it. No install is needed.
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const shaPattern = /^[a-f0-9]{40}$/;
const documentRoots = ['docs/', '.agents/'];
const documentFiles = new Set(['AGENTS.md', 'CLAUDE.md', 'README.md']);

function git(cwd, args) {
  return spawnSync('git', args, {
    cwd, encoding: 'utf8', timeout: 10_000, maxBuffer: 4 * 1024 * 1024,
    windowsHide: true
  });
}

export function decideBuild({ cwd = process.cwd(), env = process.env } = {}) {
  const build = reason => ({ skip: false, reason });
  if (env.VERCEL !== '1' || !['production', 'preview'].includes(env.VERCEL_ENV)) return build('outside Vercel Git build');
  const previous = env.VERCEL_GIT_PREVIOUS_SHA;
  const current = env.VERCEL_GIT_COMMIT_SHA;
  // No HEAD^ fallback: that could hide runtime changes from an earlier skipped
  // or failed commit. Missing history, first deploys and redeploys must build.
  if (!shaPattern.test(previous ?? '') || !shaPattern.test(current ?? '') || previous === current) return build('missing baseline or same-commit redeploy');
  const head = git(cwd, ['rev-parse', 'HEAD']);
  if (head.status !== 0 || head.stdout.trim() !== current) return build('checkout does not match deployment commit');
  if (git(cwd, ['merge-base', '--is-ancestor', previous, current]).status !== 0) return build('baseline unavailable or history diverged');
  // --no-renames exposes both paths when a runtime file moves into docs.
  const diff = git(cwd, ['diff', '--no-ext-diff', '--no-textconv', '--no-renames', '--name-only', '-z', previous, current, '--']);
  if (diff.status !== 0 || !diff.stdout.endsWith('\0')) return build('diff unavailable or empty');
  const files = diff.stdout.slice(0, -1).split('\0');
  if (!files.every(file => documentFiles.has(file) || documentRoots.some(root => file.startsWith(root)))) return build('deployment input changed');
  return { skip: true, reason: 'only documentation or agent instructions changed', changedFiles: files.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const decision = decideBuild();
    console.log(`Deployment build: ${decision.skip ? 'skip' : 'continue'} (${decision.reason}).`);
    process.exitCode = decision.skip ? 0 : 1;
  } catch {
    console.log('Deployment build: continue (could not safely determine changed inputs).');
    process.exitCode = 1;
  }
}
