import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GlobalNotFound, { metadata } from "@/app/global-not-found";

beforeEach(() => vi.stubGlobal("React", React));
afterEach(() => vi.unstubAllGlobals());

describe("independent unmatched-route document", () => {
  it("renders the complete Korean document and a plain keyboard-accessible home link", () => {
    const html = renderToStaticMarkup(React.createElement(GlobalNotFound));
    expect(html).toContain('<html lang="ko"');
    expect(html).toContain('<h1 id="not-found-title">페이지를 찾을 수 없어요</h1>');
    expect(html).toContain('aria-labelledby="not-found-title"');
    expect(html).toContain('data-act="not-found-home" href="/">홈으로</a>');
    expect(html).not.toMatch(/<script|<iframe|<form|accountEmail|hasUnlockSession|owner_private|platform_admins/);
  });

  it("does not authorize indexing or expose application/user state", () => {
    expect(metadata.robots).toEqual({ index: false, follow: false });
    const html = renderToStaticMarkup(React.createElement(GlobalNotFound));
    expect(html).not.toMatch(/data-companion|data-food|data-toy|visitKey|anonId|user_id|email|passcode/i);
  });
});
