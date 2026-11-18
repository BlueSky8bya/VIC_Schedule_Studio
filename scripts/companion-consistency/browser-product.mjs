import fs from 'node:fs/promises';
import path from 'node:path';
import ts from 'typescript';
import { execFileSync } from 'node:child_process';
export async function browserProduct(entries, revision) {
  const modules = {}, json = {};
  async function load(name) {
    if (modules[name] || json[name]) return;
    const source = revision ? execFileSync('git', ['show', `${revision}:${name}`], { maxBuffer: 20e6 }).toString() : await fs.readFile(name, 'utf8');
    if (name.endsWith('.json')) { json[name] = JSON.parse(source); return; }
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    modules[name] = code;
    for (const [, request] of code.matchAll(/require\("([^"]+)"\)/g)) await load(path.posix.normalize(request.startsWith('@/') ? request.slice(2) : path.posix.join(path.posix.dirname(name), request)) + (request.endsWith('.json') ? '' : '.ts'));
  }
  for (const entry of entries) await load(entry);
  return { modules, json };
}
export function installBrowserProduct(data) {
  const cache = new Map();
  const norm = name => { const parts = []; for (const part of name.split('/')) { if (part === '..') parts.pop(); else if (part !== '.') parts.push(part); } return parts.join('/'); };
  const load = name => {
    if (data.json[name]) return data.json[name];
    if (cache.has(name)) return cache.get(name).exports;
    const loaded = { exports: {} }; cache.set(name, loaded);
    if (!data.modules[name]) throw Error('Unknown module ' + name);
    new Function('require', 'module', 'exports', data.modules[name])(request => load(norm(request.startsWith('@/') ? request.slice(2) : name.slice(0, name.lastIndexOf('/') + 1) + request) + (request.endsWith('.json') ? '' : '.ts')), loaded, loaded.exports);
    return loaded.exports;
  };
  window.product = load;
}
