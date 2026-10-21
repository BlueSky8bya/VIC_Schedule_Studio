import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";

// Execute the actual browser-local pure parser, not a separately copied test
// implementation. Playwright serializes its surrounding observer callback.
const source = readFileSync("tests/visual/helpers/companion-qa.ts","utf8");
const ast = ts.createSourceFile("companion-qa.ts",source,ts.ScriptTarget.Latest,true);
const declarations: ts.FunctionDeclaration[] = [];
const visit = (node: ts.Node) => { if(ts.isFunctionDeclaration(node)&&node.name?.text==="normalizedInsetPercent157") declarations.push(node);ts.forEachChild(node,visit); };
visit(ast);
if(declarations.length!==1)throw Error("Expected one actual browser inset parser");
const actual = ts.createPrinter().printNode(ts.EmitHint.Unspecified,declarations[0],ast);
const compiled = ts.transpileModule(actual+"\nnormalizedInsetPercent157;",{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.None}}).outputText;
const browserParser = vm.runInNewContext(compiled,{}, {timeout:1000}) as (value:string)=>number[]|undefined;
const parse = (value:string) => { const result=browserParser(value);return result&&Array.from(result); };

describe("157 native observer actual CSS inset shorthand normalization",()=>{
  it.each([
    ["inset(2%)",[2,2,2,2]],
    ["inset(2% 3%)",[2,3,2,3]],
    ["inset(2% 3% 4%)",[2,3,4,3]],
    ["inset(2% 3% 4% 5%)",[2,3,4,5]],
    ["  inset( 2%   3%\t4% )  ",[2,3,4,3]],
    ["inset(-.5% +2.25% 0%)",[-.5,2.25,0,2.25]],
    ["inset(0% 0% 0%)",[0,0,0,0]],
    ["inset(2.% .25%)",[2,.25,2,.25]],
  ] as const)("normalizes actual serialized %s",(value,expected)=>expect(parse(value)).toEqual(expected));
  it.each(["", "none", "initial", "inset()", "inset( )", "inset(2px)", "inset(2% 3px)", "inset(2% 3% 4% 5% 6%)", "inset(2% round 4px)",
    "inset(calc(2%) 3%)", "inset(var(--clip))", "inset(1..2%)", "inset(.%)", "inset(NaN%)", "inset(Infinity%)", "inset(2%,3%)", "inset(2%)/invalid", "polygon(0% 0%,100% 0%)", "INSET(2%)", "inset(1e2%)"])("keeps unsupported %s unmeasured",value=>{
    expect(parse(value)).toBeUndefined();
  });
  it("keeps measured alpha and all four finite expanded edges as prerequisites",()=>{
    expect(source).toContain("let clipError: number | undefined, sourceClipMeasured = false");
    expect(source).toContain("const alpha = cache.get(key), inset = normalizedInsetPercent157(getComputedStyle(sprite).clipPath)");
    expect(source).toContain("if (alpha && inset?.length === 4 && inset.every(Number.isFinite))");
    expect(source.match(/sourceClipMeasured\s*=\s*true/g)).toHaveLength(1);
  });
});
