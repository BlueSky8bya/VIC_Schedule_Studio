import { describe, expect, it } from 'vitest';
import { loginRecoveryHref } from '@/lib/auth/login-recovery-link';

describe('manual login entry', () => {
  it.each(['/?code=secret#access_token=secret', '/login?next=https://evil.invalid&code=secret', '/login?next=%2F%2Fevil.invalid', '/login?next=%2Fstudio&next=%2F', '/login?next=%2Fapi%2Fauth%2Fcallback%3Fcode%3Dsecret'])('excludes transient data and untrusted destinations: %s', path => {
    expect(loginRecoveryHref(new URL(path, 'https://example.com'))).toBe('https://example.com/login');
  });
  it.each(['/studio', '/replay/2026-06-01'])('retains known path without nested query or fragment: %s', path => {
    const url = new URL('/login', 'https://example.com');
    url.searchParams.set('next', path + '?code=secret#token');
    const result = new URL(loginRecoveryHref(url));
    expect(result.searchParams.get('next')).toBe(path);
    expect(result.href).not.toContain('secret');
  });
});
