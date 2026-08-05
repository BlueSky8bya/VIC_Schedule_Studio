import fs from "node:fs";
import path from "node:path";

// .env.local을 읽어 process.env에 넣는다(Next가 해주던 일을 vitest에서 직접).
// 없으면 조용히 넘어가고, 각 테스트가 자격증명 유무를 보고 스스로 건너뛴다.
const envPath = path.join(process.cwd(), ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line);
    if (!m) continue;
    const [, key, raw] = m;
    if (process.env[key] === undefined) process.env[key] = raw.replace(/^"|"$/g, "");
  }
}
