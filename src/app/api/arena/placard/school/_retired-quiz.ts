import { NextResponse } from "next/server";
import { KqSchoolError } from "@/lib/kanab-quest-school-server";
import { schoolRequest } from "./_request";

const tournamentUrl = "/arene/placard?view=school&section=tournament";

/** Retain the school access guards without resuming or writing any solo attempt. */
export async function retiredSchoolQuizRequest(request: Request) {
  const response = await schoolRequest(request, () => {
    throw new KqSchoolError("Le quiz solo a fermé. Rejoins le tournoi du chanvre.", 410, "school_quiz_retired");
  });
  if (response.status !== 410) return response;

  response.headers.set("Location", tournamentUrl);
  return NextResponse.json({ ...await response.json(), redirectTo: tournamentUrl }, { status: 410, headers: response.headers });
}
