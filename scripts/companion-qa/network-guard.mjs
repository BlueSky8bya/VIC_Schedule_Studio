/** Isolated build/server preload. It never loads .env or patches a browser/AI. */
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';
const fonts = new Set(['fonts.googleapis.com', 'fonts.gstatic.com', 'cdn.jsdelivr.net', 'fastly.jsdelivr.net']);
// Browser native guards declare these three public font files. Keep this
// exception exact: the provider host, other files, queries and APIs stay denied.
const declaredFonts = new Set([
  'https://hangeul.pstatic.net/hangeul_static/webfont/NanumSquareRound/NanumSquareRoundR.woff2',
  'https://hangeul.pstatic.net/hangeul_static/webfont/NanumSquareRound/NanumSquareRoundB.woff2',
  'https://hangeul.pstatic.net/hangeul_static/webfont/NanumSquareRound/NanumSquareRoundEB.woff2',
]);
export function admitNodeRequest(value, method = 'GET', loopback) {
  let url; try { url = new URL(value); } catch { return false; }
  if (!['GET', 'HEAD'].includes(String(method).toUpperCase()) || url.username || url.password) return false;
  if (url.protocol === 'http:' && ['127.0.0.1', '127.0.0.2', 'localhost', '[::1]'].includes(url.hostname)) return url.origin === loopback && url.pathname.startsWith('/visual-fixture/');
  return url.protocol === 'https:' && (!url.port || url.port === '443') && (fonts.has(url.hostname) || declaredFonts.has(url.href));
}
function requestUrl(value, protocol) {
  if (typeof value === 'string' || value instanceof URL) return String(value);
  if (!value || typeof value !== 'object') return '';
  return `${value.protocol ?? protocol}//${value.hostname ?? value.host ?? ''}${value.port ? `:${value.port}` : ''}${value.path ?? '/'}`;
}
if (process.env.COMPANION_QA_NETWORK_LOG) {
  const deny = method => {
    fs.appendFileSync(process.env.COMPANION_QA_NETWORK_LOG, JSON.stringify({ decision: 'blocked', method: String(method), at: Date.now(), scope: 'isolated-node-process', privateRequestValuesRecorded: false }) + '\n');
    throw Error('Companion QA denied an unapproved build/server network request');
  };
  const fetch = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' || input instanceof URL ? String(input) : input.url, method = init?.method ?? (typeof input === 'object' && 'method' in input ? input.method : 'GET');
    if (!admitNodeRequest(url, method, process.env.COMPANION_QA_NODE_ORIGIN)) { try { deny(method); } catch (error) { return Promise.reject(error); } }
    // Native fetch follows redirects without invoking this wrapper again.
    // Reject redirects rather than permitting an approved font to proxy an
    // unapproved host, local API, telemetry endpoint or mutation.
    return fetch(input, { ...init, redirect: 'error' }).catch(error => {
      fs.appendFileSync(process.env.COMPANION_QA_NETWORK_LOG, JSON.stringify({ decision: 'approved-request-failed-or-redirected', method: String(method), at: Date.now(), scope: 'isolated-node-process', privateRequestValuesRecorded: false }) + '\n');
      throw error;
    });
  };
  for (const [module, protocol] of [[http, 'http:'], [https, 'https:']]) for (const key of ['request', 'get']) {
    const original = module[key];
    module[key] = function (...args) {
      const method = args[0]?.method ?? args[1]?.method ?? 'GET';
      if (!admitNodeRequest(requestUrl(args[0], protocol), method, process.env.COMPANION_QA_NODE_ORIGIN)) deny(method);
      return original.apply(this, args);
    };
  }
  syncBuiltinESMExports();
}
