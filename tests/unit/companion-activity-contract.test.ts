import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { ACT, describeTarget, isCompanionActivityTarget } from "@/lib/activity/labels";
import { sanitizeTarget } from "@/lib/activity/kinds";

// Structure audit, not evidence that a gesture completed in the browser. The
// native activity suite and real writer tests cover delivery and causality.
function files(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? files(path) : /\.tsx?$/.test(path) ? [path] : [];
  });
}
type Audit = { targets: Set<string>; errors: string[] };
const actionAttributes = new Set(["data-act", "dataAct", "headingAction"]);
const interactiveTags = new Set(["button", "input", "summary", "Switch", "SettingsSegment"]);

function audit(source: string, file = "companion.tsx"): Audit {
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const targets = new Set<string>(), errors: string[] = [], bindings = new Map<string, ts.Expression>();
  const collect = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) bindings.set(node.name.text, node.initializer);
    ts.forEachChild(node, collect);
  };
  collect(ast);
  const label = (node: ts.Node) => `${file}:${ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1}`;
  const strings = (node: ts.Node, seen = new Set<ts.Node>()): string[] => {
    if (seen.has(node)) return [];
    seen.add(node);
    if (ts.isStringLiteralLike(node)) return [node.text];
    if (ts.isConditionalExpression(node)) return strings(node.whenTrue, seen).concat(strings(node.whenFalse, seen));
    if (ts.isElementAccessExpression(node) || ts.isPropertyAccessExpression(node)) return strings(node.expression, seen);
    if (ts.isObjectLiteralExpression(node)) return node.properties.flatMap(property => ts.isPropertyAssignment(property) ? strings(property.initializer, seen) : []);
    // Only the fixed head is needed for catalog coverage. The real transport
    // and server both validate the complete option and discard private values.
    if (ts.isTemplateExpression(node)) return [node.head.text.split("#", 1)[0]];
    if (ts.isIdentifier(node) && bindings.has(node.text)) return strings(bindings.get(node.text)!, seen);
    const values: string[] = [];
    ts.forEachChild(node, child => { values.push(...strings(child, seen)); });
    return values;
  };
  const actions = (node: ts.Node) => {
    const own = strings(node).filter(isCompanionActivityTarget);
    if (own.length) return own;
    // A map callback may destructure an action from its fixed object list.
    // Resolve that actual list, rather than copying toggle/sound names here.
    for (let parent: ts.Node | undefined = node.parent; parent; parent = parent.parent) {
      if (ts.isCallExpression(parent) && ts.isPropertyAccessExpression(parent.expression) && parent.expression.name.text === "map") {
        return strings(parent.expression.expression).filter(isCompanionActivityTarget);
      }
    }
    return own;
  };
  const add = (node: ts.Node) => {
    for (const target of actions(node)) {
      targets.add(target.split("#", 1)[0]);
      if (sanitizeTarget(target) !== target || describeTarget("ui.click", target).unnamed) errors.push(`${label(node)} unregistered operation ${target}`);
    }
  };
  const companionScope = (node: ts.Node): boolean => {
    if (/[/\\](?:viewer-companion[/\\]|companion-[^/\\]*\.tsx$)/.test(file)) return true;
    for (let parent: ts.Node | undefined = node; parent; parent = parent.parent) {
      if (ts.isFunctionDeclaration(parent) && parent.name && /^(?:Viewer)?Companion/.test(parent.name.text)) return true;
    }
    return false;
  };
  const visit = (node: ts.Node) => {
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const attrs = node.attributes.properties.filter(ts.isJsxAttribute);
      const activity = attrs.filter(attribute => actionAttributes.has(attribute.name.getText(ast)));
      for (const attribute of activity) if (attribute.initializer) add(attribute.initializer);
      if (companionScope(node) && interactiveTags.has(node.tagName.getText(ast)) && !activity.length && !attrs.some(attribute => attribute.name.getText(ast) === "data-activity-manual")) {
        errors.push(`${label(node)} interactive control has no explicit activity owner`);
      }
      const option = attrs.find(attribute => attribute.name.getText(ast) === "data-act-opt");
      if (option?.initializer) {
        const fixedOptions = ts.isStringLiteral(option.initializer) ? [option.initializer.text]
          : ts.isJsxExpression(option.initializer) && option.initializer.expression && ts.isConditionalExpression(option.initializer.expression)
            ? strings(option.initializer.expression.whenTrue).concat(strings(option.initializer.expression.whenFalse)) : [];
        for (const attribute of activity) if (attribute.initializer) for (const target of actions(attribute.initializer)) for (const value of fixedOptions) {
          if (sanitizeTarget(`${target}#${value}`) !== `${target}#${value}`) errors.push(`${label(option)} unregistered option ${target}#${value}`);
        }
      }
    }
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === "logActivity" && node.arguments[1] && ts.isObjectLiteralExpression(node.arguments[1])) {
      for (const property of node.arguments[1].properties) if (ts.isPropertyAssignment(property) && property.name.getText(ast) === "target") add(property.initializer);
    }
    ts.forEachChild(node, visit);
  };
  visit(ast);
  return { targets, errors };
}

describe("companion explicit-control dictionary drift", () => {
  it("checks actual JSX and manual emitters against the shared timeline/usage dictionary", () => {
    const paths = [...files(join(process.cwd(), "components")), ...files(join(process.cwd(), "lib/ui/viewer-companion"))];
    const actual = paths.map(path => audit(readFileSync(path, "utf8"), relative(process.cwd(), path)));
    expect(actual.flatMap(result => result.errors)).toEqual([]);
    const observed = new Set(actual.flatMap(result => [...result.targets]));
    const registered = Object.keys(ACT).filter(key => isCompanionActivityTarget(key) && !describeTarget("ui.click", key).retired);
    expect(registered.filter(key => !observed.has(key)), "orphan dictionary entries need an actual explicit control or emitter").toEqual([]);
    for (const key of observed) {
      expect(Object.hasOwn(ACT, key), key).toBe(true);
      expect(describeTarget("ui.click", key).retired, key).toBeUndefined();
    }
  });

  it("finds new untagged/unknown controls and bad fixed options, ignoring comments and labels", () => {
    const result = audit(`// <button data-act="companion-comment-only" />
      function CompanionExample() { return <>
        <button onClick={() => {}}>private title</button>
        <button data-act="companion-unknown" />
        <button data-act="companion-radio-list" data-act-opt="radio-01" />
        <button data-activity-manual="" />
      </>; }`, "components/shared/companion-example.tsx");
    expect(result.errors).toHaveLength(3);
    expect([...result.targets]).toEqual(["companion-unknown", "companion-radio-list"]);
    expect(JSON.stringify(result)).not.toContain("private title");
  });

  it("reads a fixed mapped action and conditional/manual target without a copied feature list", () => {
    const result = audit(`const controls = [{ action: "companion-enabled" }];
      function CompanionExample() { return <>{controls.map(({ action }) => <Switch dataAct={action} />)}
        <button data-act={open ? "companion-home-close" : "companion-home-open"} />
      </>; }
      logActivity("ui.click", { target: thrown ? "companion-throw" : "companion-drag" });`);
    expect(result.errors).toEqual([]);
    expect([...result.targets].sort()).toEqual(["companion-drag", "companion-enabled", "companion-home-close", "companion-home-open", "companion-throw"]);
  });

  it("the actual radio summary handler reads native open state even before a deferred toggle event", () => {
    const source = readFileSync(join(process.cwd(), "components/studio/studio-settings.tsx"), "utf8");
    const ast = ts.createSourceFile("settings.tsx", source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let summary: ts.JsxOpeningElement | undefined;
    const find = (node: ts.Node) => {
      if (ts.isJsxOpeningElement(node) && node.tagName.getText(ast) === "summary" && node.attributes.properties.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(ast) === "data-act" && attribute.initializer && ts.isStringLiteral(attribute.initializer) && attribute.initializer.text === "companion-radio-list")) summary = node;
      ts.forEachChild(node, find);
    };
    find(ast); expect(summary).toBeDefined();
    const attributes = summary!.attributes.properties.filter(ts.isJsxAttribute);
    expect(attributes.some(attribute => attribute.name.getText(ast) === "data-activity-manual"), "delegation must not count the same click again").toBe(true);
    const click = attributes.find(attribute => attribute.name.getText(ast) === "onClick")?.initializer;
    expect(click && ts.isJsxExpression(click) && click.expression).toBeTruthy();
    const expression = click && ts.isJsxExpression(click) ? click.expression! : undefined;
    const compiled = ts.transpileModule(`exports.click = (${expression!.getText(ast)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
    const events: { kind: string; target: string }[] = [];
    const exported: { click?: (event: { currentTarget: { closest: (selector: string) => { open: boolean } } }) => void } = {};
    runInNewContext(compiled, { exports: exported, logActivity: (kind: string, options: { target: string }) => events.push({ kind, target: options.target }) });
    const details = { open: false }, event = { currentTarget: { closest: (selector: string) => { expect(selector).toBe("details"); return details; } } };
    exported.click!(event);
    details.open = true; // Native default action; deliberately no onToggle/React render.
    exported.click!(event);
    expect(events).toEqual([{ kind: "ui.click", target: "companion-radio-list#open" }, { kind: "ui.click", target: "companion-radio-list#close" }]);
  });
});
