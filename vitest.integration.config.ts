import { defineConfig } from "vitest/config";
import path from "node:path";

// 통합 테스트 전용 설정 — **실제 Supabase에 왕복한다**(단위 테스트와 분리해서 돌린다).
//
// 왜 분리하나: 단위(`npm test`)는 네트워크 없이 몇 초면 끝나야 커밋마다 돌릴 수 있다.
// 통합은 자격증명(.env.local)이 있어야 하고 운영 DB에 실제로 쓰기 때문에, 부를 때만 돈다
// (`npm run test:integration`). 자격증명이 없으면 스스로 건너뛴다.
//
// ⚠ 데이터 안전: 테스트 데이터는 **과거 달**에만 만들고(시청자 실시간 화면 보호), 제목에
// 표식을 달며, 끝나면 물리 삭제까지 한다(tests/integration/setup.ts).
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    setupFiles: ["tests/integration/setup.ts"],
    // 실 DB 왕복이라 단위 테스트보다 넉넉히. 순차 실행(같은 캘린더를 건드린다).
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  }
});
