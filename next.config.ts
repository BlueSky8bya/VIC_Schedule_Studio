import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // 빌드(=배포) 시각/커밋을 클라이언트에서도 쓰게 빌드 때 박는다(인사이트 배포 시각, 액션바 버전 표시).
  env: {
    BUILD_TIME: new Date().toISOString(),
    APP_COMMIT: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev"
  },
  experimental: {
    // Server Action 본문 한도(기본 1MB) 상향. 원래 근거였던 커스텀 이모지 업로드는 2026-08-27 스티커
    // 철수로 사라졌지만, 그림판(방송 화면) 저장 등 큰 페이로드 여유분으로 4MB를 유지한다.
    serverActions: {
      bodySizeLimit: "4mb"
    }
  }
};

export default nextConfig;
