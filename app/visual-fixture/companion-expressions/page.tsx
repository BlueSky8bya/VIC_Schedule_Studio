import { notFound } from "next/navigation";
import ExpressionFixture from "./expression-fixture";
export const dynamic = "force-dynamic";
export default function CompanionExpressionFixture() {
  if (process.env.VISUAL_TEST_FIXTURE !== "1") notFound();
  return <ExpressionFixture />;
}
