import { defineConfig, devices } from "@playwright/test";
import { SETTINGS_EPOCH, SETTINGS_EPOCH_KEY } from "./lib/ui/motion";

// 비주얼 회귀 전용 설정(일반 e2e와 분리). 요구사항:
//  · production build로 띄운다(dev 서버 아님 — 실제 배포와 같은 렌더).
//  · 고정 fixture(`/__visual/poster`, VISUAL_TEST_FIXTURE=1)만 찍어 데이터·인증·시각에 안 흔들린다.
//  · viewport·DPR 고정 + 애니메이션 정지 → 매 실행 동일 픽셀.
// baseline 갱신: `npm run test:visual -- --update-snapshots` (변경이 '의도된' 것일 때만).
// baseline PNG는 OS별로 다르다(폰트 렌더 차 — 파일명에 `-win32`). 지금은 로컬(Windows) 기준선만
// 있다. CI(리눅스)에서 돌리려면 리눅스 기준선을 따로 생성해야 한다(같은 Docker/OS에서 --update).
export default defineConfig({
  testDir: "./tests/visual",
  testMatch: ["**/*.spec.ts"],
  fullyParallel: false,
  workers: 1,
  reporter: "html",
  // 픽셀 완전동일이 목표지만 폰트 렌더의 미세 차이를 위해 아주 작은 허용치만 둔다.
  expect: {
    toHaveScreenshot: { maxDiffPixelRatio: 0.001, animations: "disabled", scale: "css" }
  },
  use: {
    baseURL: "http://127.0.0.1:3100",
    viewport: { width: 1440, height: 1200 },
    deviceScaleFactor: 1,
    trace: "on-first-retry",
    // 설정 세대를 미리 심는다 — 앱의 페인트-전 스크립트가 '세대 다름 → 기본값 복원'을 하면서
    // 테스트가 켜 둔 '동작 줄이기'(결정성용)를 첫 로드에서 지워 버리지 않게(lib/ui/motion.ts).
    storageState: {
      cookies: [],
      origins: [
        {
          origin: "http://127.0.0.1:3100",
          localStorage: [
            { name: SETTINGS_EPOCH_KEY, value: SETTINGS_EPOCH },
            // 그래픽 여력 판정(lib/ui/gfx.ts)을 미리 'full'로 못 박는다 — 헤드리스에서 판정이 lite로
            // 튀면 눈 편한 테마가 필터→토큰 팔레트로 바뀌어 스냅샷이 실행마다 달라진다.
            { name: "vic.gfx", value: JSON.stringify({ mode: "full", at: Date.now() }) }
          ]
        }
      ]
    }
  },
  webServer: {
    // 프로덕션 빌드 후 기동. fixture 플래그를 런타임에 켠다(실사용 경로엔 영향 없음).
    command: "npm run build && npx next start -p 3100 -H 127.0.0.1",
    url: "http://127.0.0.1:3100/visual-fixture/poster",
    timeout: 240_000,
    reuseExistingServer: !process.env.CI,
    env: { VISUAL_TEST_FIXTURE: "1" }
  },
  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 1200 } }
    }
  ]
});
