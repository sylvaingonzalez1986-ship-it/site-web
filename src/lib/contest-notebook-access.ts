import "server-only";
import { NextResponse } from "next/server";

/** The public tasting notebook opens independently of the game's beta and launch. */
export function isContestNotebookEnabledServer(): boolean {
  const value = process.env.CONTEST_NOTEBOOK_ENABLED?.trim().toLowerCase();
  return !["0", "false", "off", "no"].includes(value ?? "");
}

export async function getContestNotebookAccessDeniedResponse(): Promise<NextResponse | null> {
  return isContestNotebookEnabledServer()
    ? null
    : NextResponse.json({ error: "Carnet indisponible." }, { status: 404 });
}
