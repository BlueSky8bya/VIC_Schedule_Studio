import { NextResponse } from "next/server";
import { z } from "zod";
import { publicCalendarMeta, sampleProposals } from "@/lib/schedules/sample-public-data";

const proposalSchema = z.object({
  type: z.enum(["slot", "content", "collab"]).default("content"),
  content: z.string().min(2).max(200),
  suggestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional()
});

type ProposalRouteProps = {
  params: Promise<{
    calendarSlug: string;
  }>;
};

export async function GET(_request: Request, { params }: ProposalRouteProps) {
  const { calendarSlug } = await params;

  if (calendarSlug !== publicCalendarMeta.slug) {
    return NextResponse.json({ proposals: [] });
  }

  return NextResponse.json({
    proposals: sampleProposals
      .filter((proposal) => proposal.state === "accepted")
      .map(({ id, type, content, voteCount, state, suggestedDate }) => ({
        id,
        type,
        content,
        voteCount,
        state,
        suggestedDate
      }))
  });
}

export async function POST(request: Request, { params }: ProposalRouteProps) {
  const { calendarSlug } = await params;
  const body = await request.json().catch(() => null);
  const parsed = proposalSchema.safeParse(body);

  if (calendarSlug !== publicCalendarMeta.slug) {
    return NextResponse.json({ error: "Calendar not found" }, { status: 404 });
  }

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid proposal" }, { status: 400 });
  }

  return NextResponse.json(
    {
      proposal: {
        id: `incoming-${Date.now()}`,
        ...parsed.data,
        voteCount: 0,
        state: "new"
      }
    },
    { status: 202 }
  );
}
