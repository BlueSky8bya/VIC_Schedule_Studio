import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typedRoutes: true,
  // 빌드(=배포) 시각/커밋을 클라이언트에서도 쓰게 빌드 때 박는다(인사이트 배포 시각, 액션바 버전 표시).
  env: {
    BUILD_TIME: new Date().toISOString(),
    APP_COMMIT: process.env.VERCEL_GIT_COMMIT_SHA ?? "dev"
  },
  experimental: {
    // 커스텀 이모지 업로드는 최대 2MB까지 허용한다. Server Action 기본 본문 한도(1MB)에 막혀
    // 1~2MB 파일이 프레임워크 단에서 거부되며 "올리는 중…"에서 멈추던 문제를 푼다.
    serverActions: {
      bodySizeLimit: "4mb"
    }
  }
};

export default nextConfig;
