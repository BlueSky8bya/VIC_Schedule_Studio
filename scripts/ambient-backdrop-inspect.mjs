// Read-only pixel checks. Never remove a background, quantize or repair a candidate.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import crypto from "node:crypto";

const runDir = path.resolve(process.argv[2] ?? "");
const request = JSON.parse(fs.readFileSync(path.join(runDir, "request.json"), "utf8"));
if (request.schemaVersion !== "backdrop-pilot-1" || request.previewOnly !== true) throw new Error("Expected a backdrop pilot request");
const { requestSha256, ...unsigned } = request;
const hash = bytes => crypto.createHash("sha256").update(bytes).digest("hex");
if (hash(JSON.stringify(unsigned)) !== requestSha256) throw new Error("Request changed after freezing");
for (const input of request.inputs) {
  const inputFile = path.resolve(runDir, input.path);
  if (!inputFile.startsWith(runDir + path.sep)) throw new Error("Input leaves run");
  if (hash(fs.readFileSync(inputFile)) !== input.sha256) throw new Error("Frozen reference changed");
}
const files = [];
for (const file of request.files) {
  if (path.basename(file) !== file || !file.endsWith(".png")) throw new Error("Invalid candidate filename");
  const bytes = fs.readFileSync(path.join(runDir, "원본", file));
  const meta = await sharp(bytes).metadata();
  const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const colors = new Set();
  let transparent = 0, semitransparent = 0, mismatchedBlocks = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 4, a = data[i + 3];
    if (a === 0) transparent++; else colors.add(data[i] * 65536 + data[i + 1] * 256 + data[i + 2]);
    if (a > 0 && a < 255) semitransparent++;
    const b = (Math.floor(y / 4) * 4 * info.width + Math.floor(x / 4) * 4) * 4;
    if (data[i] !== data[b] || data[i + 1] !== data[b + 1] || data[i + 2] !== data[b + 2] || a !== data[b + 3]) mismatchedBlocks++;
  }
  const checks = { size: meta.width === 1536 && meta.height === 1024, transparency: !!meta.hasAlpha && transparent > 0 && semitransparent === 0, palette: colors.size >= 6 && colors.size <= 10, grid: mismatchedBlocks === 0 };
  files.push({ file, sha256: hash(bytes), width: meta.width, height: meta.height, hasAlpha: meta.hasAlpha, colors: colors.size, transparent, semitransparent, mismatchedBlockPixels: mismatchedBlocks, checks });
}
const result = { requestSha256, status: files.every(f => Object.values(f.checks).every(Boolean)) ? "pass" : "fail", files, ownerDecision: "pending", normalization: "not performed", publication: "not allowed" };
console.log(JSON.stringify(result, null, 2));
if (result.status === "fail") process.exitCode = 1;
