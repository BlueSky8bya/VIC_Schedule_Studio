import { readFileSync, readdirSync } from "node:fs";
import { extname, join } from "node:path";
import { describe, expect, test } from "vitest";

const REDESIGN_TOKENS = [
  "--broadcast-layer-width",
  "--broadcast-mobile-layer-height",
  "--broadcast-mobile-tray-height",
  "--broadcast-shelf-height",
  "--broadcast-source-width",
  "--control-hit",
  "--focus-ring",
  "--lh-body",
  "--lh-relaxed",
  "--r-control",
  "--safe-bottom",
  "--selection-border",
  "--selection-fill",
  "--selection-overlay",
  "--selection-overlay-opacity",
  "--sheet-width-lg",
  "--sheet-width-md",
  "--space-card",
  "--space-control-x",
  "--space-control-y",
  "--space-panel",
  "--status-danger",
  "--status-danger-fill",
  "--status-success",
  "--status-success-fill",
  "--status-warning",
  "--status-warning-fill",
  "--stroke-hairline",
  "--text-hero",
  "--tracking-tight",
  "--tracking-ui",
  "--weight-bold",
  "--weight-semibold",
] as const;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return [".css", ".ts", ".tsx"].includes(extname(path)) ? [path] : [];
  });
}

describe("Apple redesign token audit", () => {
  const root = process.cwd();
  const globals = readFileSync(join(root, "app", "globals.css"), "utf8");
  const consumers = ["app", "components", "lib"]
    .flatMap((directory) => sourceFiles(join(root, directory)))
    .map((path) => readFileSync(path, "utf8"))
    .join("\n");

  test("every redesign token is declared and consumed", () => {
    for (const token of REDESIGN_TOKENS) {
      expect
        .soft(globals, `${token} declaration`)
        .toMatch(new RegExp(`^\\s*${token}:`, "m"));
      expect.soft(consumers, `${token} consumer`).toContain(`var(${token}`);
    }
  });
});
