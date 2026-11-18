import { readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
export function createProductReader() {
  const cache = new Map();
  function load(name) {
    if (cache.has(name)) return cache.get(name).exports;
    const source = readFileSync(path.resolve(name), 'utf8');
    if (name.endsWith('.json')) return JSON.parse(source);
    const loaded = { exports: {} }; cache.set(name, loaded);
    const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    new Function('require', 'module', 'exports', code)(request => load(path.posix.normalize(request.startsWith('@/') ? request.slice(2) : path.posix.join(path.posix.dirname(name), request)) + (request.endsWith('.json') ? '' : '.ts')), loaded, loaded.exports);
    return loaded.exports;
  }
  return load;
}
