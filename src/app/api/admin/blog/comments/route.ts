import { NextResponse } from "next/server";
import {
  getAdminBlogComments,
  moderateBlogComment,
  parseBlogCommentStatus,
} from "@/lib/blog-interactions-backend";
import { denyIfNotAdminApi, getValidatedAdminContext } from "@/lib/admin-guard";
import type { BlogCommentStatus } from "@/types/blog";

export const runtime = "nodejs";

type ModerationStatus = Exclude<BlogCommentStatus, "pending">;

function isModerationStatus(value: string): value is ModerationStatus {
  return value === "approved" || value === "rejected";
}

export async function GET(request: Request) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }

  const url = new URL(request.url);
  const status = parseBlogCommentStatus(url.searchParams.get("status"));
  const comments = await getAdminBlogComments(status);
  return NextResponse.json({ comments });
}

export async function PATCH(request: Request) {
  const context = await getValidatedAdminContext();
  if (!context) {
    return NextResponse.json({ error: "Non autorise." }, { status: 401 });
  }

  const payload = (await request.json().catch(() => null)) as
    | { commentId?: string; status?: string; adminNote?: string }
    | null;

  const commentId = (payload?.commentId ?? "").trim();
  const status = (payload?.status ?? "").trim();
  const adminNote = (payload?.adminNote ?? "").trim().slice(0, 500);

  if (!commentId || !isModerationStatus(status)) {
    return NextResponse.json({ error: "Payload moderation invalide." }, { status: 400 });
  }

  await moderateBlogComment({
    commentId,
    status,
    adminNote,
    reviewedBy: context.email,
  });

  return NextResponse.json({ ok: true });
}
