import { readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { getPublicSchedule } from "@/lib/schedules/public-loader";
import { samplePublicScheduleData } from "@/lib/schedules/sample-public-data";

const repoRoot = join(fileURLToPath(new URL(".", import.meta.url)), "..", "..");

// 공개 표면(공개 API 라우트 + 공개 로더)이 스튜디오/서비스롤/비공개 샘플을 import하지 않는지
// 소스에서 정적으로 검증한다. 새 공개 route도 자동 포함한다. 직접 의존성 검사이며
// 실제 DTO/RLS 검증을 대체하지 않는다. 규칙: .claude/rules/public-private-boundary.md.
function publicRoutes(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? publicRoutes(path)
      : /^route\.[jt]sx?$/.test(entry.name) ? [relative(repoRoot, path).replaceAll("\\", "/")] : [];
  });
}
const publicSurfaceFiles = ["lib/schedules/public-loader.ts", ...publicRoutes(join(repoRoot, "app/api/public"))].sort();

// Alias/relative imports, re-exports and literal dynamic imports share this guard.
const forbiddenImports = [
  "lib/schedules/sample-data", // 스튜디오 샘플(privateMeta·requests 포함)
  "lib/schedules/studio-loader", // 스튜디오 로더
  "lib/auth/admin" // service_role 클라이언트
];

function moduleReferences(source: string): (string | null)[] {
  const modules: (string | null)[] = [];
  const ast = ts.createSourceFile("surface.ts", source, ts.ScriptTarget.Latest, true);
  const visit = (node: ts.Node) => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier) {
      modules.push(ts.isStringLiteralLike(node.moduleSpecifier) ? node.moduleSpecifier.text : null);
    } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword
      || ts.isIdentifier(node.expression) && node.expression.text === "require")) {
      const argument = node.arguments[0];
      modules.push(argument && ts.isStringLiteralLike(argument) ? argument.text : null);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return modules;
}

function localModule(specifier: string, importer: string): string {
  const absolute = specifier.startsWith("@/") ? resolve(repoRoot, specifier.slice(2))
    : specifier.startsWith(".") ? resolve(repoRoot, dirname(importer), specifier) : null;
  return absolute ? relative(repoRoot, absolute).replaceAll("\\", "/").replace(/\.[cm]?[jt]sx?$/, "") : specifier;
}

describe("public boundary — static imports", () => {
  it("automatically includes nested discovery, confirmation, clock and VOD routes", () => {
    expect(publicSurfaceFiles).toEqual(expect.arrayContaining([
      "app/api/public/clock/route.ts",
      "app/api/public/[calendarSlug]/teaser-state/[eventId]/route.ts",
      "app/api/public/[calendarSlug]/vod-timeline/route.ts",
      "app/api/public/[calendarSlug]/search/suggest/route.ts"
    ]));
  });
  it("recognizes multiline, dynamic, relative and re-export references without matching comments", () => {
    const source = `// import fake from '@/lib/auth/admin';
      import { value }\n from '@/lib/schedules/studio-loader';
      export { value } from '../../../../lib/auth/admin';
      const lazy = import('@/lib/schedules/sample-data');
      const required = require('@/lib/auth/admin');
      const unknown = import(variable);`;
    const references = moduleReferences(source);
    expect(references).toHaveLength(5);
    expect(references).toContain(null); // Nonliteral imports require an explicit review.
    expect(references.filter((reference): reference is string => reference !== null)
      .map(reference => localModule(reference, "app/api/public/vic/route.ts")))
      .toEqual([forbiddenImports[1], forbiddenImports[2], forbiddenImports[0], forbiddenImports[2]]);
  });
  for (const rel of publicSurfaceFiles) {
    it(`${rel} imports no studio/service-role modules`, () => {
      const source = readFileSync(join(repoRoot, rel), "utf8");
      for (const reference of moduleReferences(source)) {
        expect(reference, `${rel} has an unverifiable nonliteral import`).not.toBeNull();
        expect(forbiddenImports, `${rel} must not import ${reference}`).not.toContain(localModule(reference!, rel));
      }
    });
  }
});

// 공개 폴백 스케줄에 비공개 데이터가 새지 않는지(구조 검증). getPublicSchedule은 Supabase 미설정
// 테스트 환경에서 이 폴백을 그대로 돌려준다.
const forbiddenPrivateKeys = [
  "privateTitle",
  "privateMemo",
  "editorNote",
  "privateMeta",
  "requests",
  "variantGroups",
  "embargo",
  "owner_private",
  "receivedAt", // request payload 필드
  "triaged"
];

describe("public sample fallback — no private leak", () => {
  it("exposes only public-scope events (evt-007 embargo / evt-008 work excluded)", () => {
    const ids = samplePublicScheduleData.events.map((e) => e.id).sort();
    expect(ids).toEqual([
      "evt-001",
      "evt-002",
      "evt-003",
      "evt-004",
      "evt-005",
      "evt-006",
      "evt-tourn"
    ]);
    for (const e of samplePublicScheduleData.events) {
      expect(e.visibilityScope).toBe("public");
    }
  });

  it("getPublicSchedule('vic') carries no private keys", async () => {
    const schedule = await getPublicSchedule("vic");
    const payload = JSON.stringify(schedule);
    for (const key of forbiddenPrivateKeys) {
      expect(payload, `payload leaked ${key}`).not.toContain(key);
    }
    expect(schedule.events).toHaveLength(7);
  });

  it("unknown slug empties events but keeps public calendar shape", async () => {
    const schedule = await getPublicSchedule("nope");
    expect(schedule.events).toHaveLength(0);
    expect(schedule.calendar.slug).toBe("vic");
  });
});
