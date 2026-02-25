import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  archiveCmsPageByBackend,
  updateCmsPageByBackend,
} from "@/lib/cms-pages-backend";
import { isCmsPagesEnabledServer } from "@/lib/cms-pages-feature";
import type { CmsPageUpdateInput } from "@/types/cms-pages";

export const runtime = "nodejs";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }
  if (!isCmsPagesEnabledServer()) {
    return NextResponse.json({ error: "CMS pages disabled." }, { status: 503 });
  }

  const { pageId } = await params;

  try {
    const payload = (await request.json()) as CmsPageUpdateInput;
    const updated = await updateCmsPageByBackend(pageId, payload);
    if (!updated) {
      return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payload invalide.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(
  _: Request,
  { params }: { params: Promise<{ pageId: string }> },
) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }
  if (!isCmsPagesEnabledServer()) {
    return NextResponse.json({ error: "CMS pages disabled." }, { status: 503 });
  }

  const { pageId } = await params;
  const archived = await archiveCmsPageByBackend(pageId);
  if (!archived) {
    return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
  }

  return NextResponse.json(archived);
}
