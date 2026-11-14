import { retiredSchoolQuizRequest } from "../../_retired-quiz";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  return retiredSchoolQuizRequest(request);
}
