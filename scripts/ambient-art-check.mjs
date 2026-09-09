// Measurements are evidence, not owner approval. Candidate and baseline stay separate.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { artManifest, familySlots, root } from "./lib/ambient-art-manifest.mjs";
import { pixels, texture, silhouette, iou, snowShare, leafHue, dotCells, structure } from "./lib/ambient-art-metrics.mjs";

export async function checkArt({ family, dir, baselineDir = null, expectedFiles = null }) {
  const { slotFiles, ART_FAMILIES } = artManifest();
  const slots = familySlots(family);
  const byFile = new Map(slots.flatMap((s) => slotFiles(s).map((f, i) => [f, { slot: s, variant: i + 1 }])));
  const checks = [];
  const add = (ruleId, asset, status, measured = null, expected = null) => checks.push({ ruleId, asset, status, measured, expected });
  const listed = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".png")) : [];
  const files = expectedFiles ?? listed.filter((f) => byFile.has(f));
  if (!files.length) add("files.present", family, "fail", 0, "At least one manifest asset");
  for (const file of files) {
    if (!byFile.has(file)) add("files.known", file, "fail", file, "Exact slotFiles() name");
    else if (!listed.includes(file)) add("files.present", file, "fail", false, true);
  }
  if (expectedFiles) for (const file of listed) if (!expectedFiles.includes(file)) add("files.unrequested", file, "fail", file, expectedFiles);
  const measure = async (file) => {
    const px = await pixels(file), cells = await dotCells(file);
    return { px, tex: texture(cells), sil: silhouette(px), snow: snowShare(px), hue: leafHue(px), st: structure(cells) };
  };
  const baseline = new Map(), candidates = new Map();
  if (baselineDir) for (const file of byFile.keys()) {
    if (baselineDir === "git") {
      let buffer;
      try { buffer = execFileSync("git", ["show", `HEAD:public/ambient/art/${file}`], { cwd: root, stdio: ["ignore", "pipe", "ignore"] }); }
      catch { continue; }
      baseline.set(file, await measure(buffer));
    } else {
      const source = path.join(baselineDir, file);
      if (fs.existsSync(source)) baseline.set(file, await measure(source));
    }
  }
  for (const file of files.filter((f) => byFile.has(f) && listed.includes(f))) {
    try { candidates.set(file, await measure(path.join(dir, file))); }
    catch (error) { add("image.readable", file, "fail", error.message, "Readable PNG"); }
  }
  for (const [file, r] of candidates) {
    const { slot } = byFile.get(file);
    const baseFile = baseline.has(file) ? file : slotFiles(slot).find((f) => baseline.has(f));
    const b = baseline.get(baseFile);
    add("image.nonempty", file, r.st.body > 0 ? "pass" : "fail", r.st.body, "> 0 opaque cells");
    add("palette.colors", file, r.tex.colors <= 128 ? "pass" : "fail", r.tex.colors, "<= 128; visual palette review still required");
    const ratio = r.px.box[0] / r.px.box[1], wantedRatio = slot.px[0] / slot.px[1];
    const fill = Math.min(ratio / wantedRatio, wantedRatio / ratio);
    add("shape.slot-fill", file, fill >= .45 ? "pass" : "fail", fill, ">= .45");
    add("texture.baseline", file, !b ? "unmeasured" : r.tex.meanRun < b.tex.meanRun * .85 || r.tex.changeDensity > b.tex.changeDensity * 1.25 ? "fail" : "pass",
      { meanRun: r.tex.meanRun, changeDensity: r.tex.changeDensity, baseline: baseFile ?? null }, "run >= baseline * .85; density <= baseline * 1.25");
    const small = r.st.body < 300;
    const structureBad = b && (r.st.orphanPct > b.st.orphanPct + 5 || r.st.blobPer1k > b.st.blobPer1k + 8 || (!r.st.bright && (r.st.edgeDarkPct < b.st.edgeDarkPct - 8 || r.st.gaps > b.st.gaps + 6)));
    add("structure.baseline", file, small ? "not-applicable" : !b ? "unmeasured" : structureBad ? "fail" : "pass", r.st, small ? "Small sprites require visual review" : "Relative to same-slot accepted baseline");
    const pine = family === "tree-pine";
    add("pine.trunk", file, !pine ? "not-applicable" : !b ? "unmeasured" : r.st.trunkRuns > b.st.trunkRuns ? "fail" : "pass", r.st.trunkRuns, b?.st.trunkRuns ?? null);
    const winter = pine && slot.id === "tree-pine-winter";
    add("pine.snow.coverage", file, !winter ? "not-applicable" : r.snow < (b ? b.snow - 3 : 20) ? "fail" : "pass", r.snow, b ? b.snow - 3 : 20);
    add("pine.snow.location", file, !winter ? "not-applicable" : !b || b.st.snowEdgePct === null || r.st.snowEdgePct === null ? "unmeasured" : r.st.snowEdgePct > b.st.snowEdgePct + 10 ? "fail" : "pass", r.st.snowEdgePct, b?.st.snowEdgePct == null ? null : b.st.snowEdgePct + 10);
    const autumn = pine && slot.id === "tree-pine-autumn";
    add("pine.autumn.hue", file, !autumn ? "not-applicable" : !r.hue ? "unmeasured" : r.hue.yellowPct > (b?.hue ? b.hue.yellowPct + 10 : 20) || r.hue.mean < (b?.hue ? b.hue.mean - 8 : 85) ? "fail" : "pass", r.hue, "Pine-specific accepted hue range");
  }
  // Accepted neighbours participate in comparisons; replacements never disappear behind them.
  const comparison = new Map([...baseline, ...candidates]);
  for (const slot of slots) {
    const names = slotFiles(slot).filter((f) => comparison.has(f));
    if (!slot.perScreen) { add("variants.diversity", slot.id, "not-applicable", null, "No perScreen diversity contract"); continue; }
    if (names.length < 2) { add("variants.diversity", slot.id, "unmeasured", names.length, "At least two variants"); continue; }
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
      if (!candidates.has(names[i]) && !candidates.has(names[j])) continue;
      const a = comparison.get(names[i]), b = comparison.get(names[j]), value = iou(a.sil, b.sil);
      add("variants.diversity", `${names[i]} / ${names[j]}`, a.st.body < 300 || b.st.body < 300 ? "not-applicable" : value >= .8 ? "fail" : "pass", value, "< .8; small objects require visual comparison");
    }
  }
  if (ART_FAMILIES[family]?.pairedVariants) {
    const variants = new Set(files.map((f) => byFile.get(f)?.variant).filter(Boolean));
    for (const variant of variants) {
      const pack = slots.map((s) => slotFiles(s)[variant - 1]);
      const present = pack.filter((f) => candidates.has(f));
      add("seasons.complete", `variant-${variant}`, present.length === pack.length ? "pass" : "fail", present, pack);
      const base = candidates.get(pack[0]);
      for (const file of pack.slice(1)) {
        const other = candidates.get(file);
        add("seasons.identity", `${pack[0]} / ${file}`, !base || !other ? "unmeasured" : iou(base.sil, other.sil) >= .95 ? "pass" : "fail", base && other ? iou(base.sil, other.sil) : null, ">= .95");
      }
    }
  } else add("seasons.identity", family, "not-applicable", null, "No explicit paired family");
  add("owner.visual-review", family, "unmeasured", null, "Owner inspects normalized contact sheet and records decision");
  return { schemaVersion: 1, family, candidateDir: path.resolve(dir), baselineDir,
    status: checks.some((c) => c.status === "fail") ? "fail" : checks.some((c) => c.status === "unmeasured") ? "unmeasured" : "pass", checks };
}

async function main() {
  const args = process.argv.slice(2);
  const valued = new Set(["--dir", "--baseline"]);
  const family = args.find((a, i) => !a.startsWith("--") && !valued.has(args[i - 1]));
  const flag = (name, fallback) => { const i = args.indexOf(name); return i < 0 ? fallback : args[i + 1]; };
  if (!family) throw new Error("Usage: art:check <family-or-slot> [--dir raw] [--baseline public/ambient/art|git] [--json]");
  const dir = path.resolve(root, flag("--dir", "public/ambient/art"));
  const base = flag("--baseline", null);
  const report = await checkArt({ family, dir, baselineDir: base && base !== "git" ? path.resolve(root, base) : base });
  if (args.includes("--json")) console.log(JSON.stringify(report, null, 2));
  else for (const check of report.checks) console.log(`${check.status.padEnd(14)} ${check.ruleId} ${check.asset} ${JSON.stringify(check.measured)}`);
  process.exitCode = report.status === "fail" ? 1 : 0;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error.message); process.exitCode = 1; });
