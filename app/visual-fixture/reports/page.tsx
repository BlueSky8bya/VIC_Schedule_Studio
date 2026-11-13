import { notFound } from "next/navigation";
import { ReportsBoard } from "@/components/studio/reports-board";

// 제보함 화면 점검용(VISUAL_TEST_FIXTURE=1에서만) — 실제 제보함은 개발자 로그인이 필요하다. 가짜 행·로컬 그림만 쓴다.
export const dynamic = "force-dynamic";

const shot = (n: number) => `/premiere/${["tori-invitation", "victamin-cheer", "victory-wish", "victamin-seated"][n % 4]}.webp`;

export default function ReportsFixturePage() {
  if (process.env.VISUAL_TEST_FIXTURE !== "1") notFound();
  const now = Date.now();
  return (
    <ReportsBoard
      error={null}
      rows={[
        { id: "f1", created_at: new Date(now - 600_000).toISOString(), topic: "schedule", body: "11월 13일 21시 합방이 22시예요.\n방송국 공지 확인했습니다.", reply_email: "viewer@example.com", page: "/", device: "mobile", imageUrls: [0, 1, 2, 3, 4, 5].map(shot), done_at: null, replied_at: null },
        { id: "f2", created_at: new Date(now - 3_600_000).toISOString(), topic: "bug", body: "검색에서 다시보기를 누르면 창이 안 열려요.", reply_email: null, page: "/privacy", device: "desktop", imageUrls: [shot(2)], done_at: null, replied_at: null },
        { id: "f3", created_at: new Date(now - 86_400_000).toISOString(), topic: "idea", body: "다크 모드 토글 좋아요!", reply_email: "fan@example.com", page: "/", device: "desktop", imageUrls: [], done_at: new Date(now - 7_200_000).toISOString(), replied_at: new Date(now - 7_000_000).toISOString() }
      ]}
    />
  );
}
