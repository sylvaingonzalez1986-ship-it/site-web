import { after, NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  archiveCmsPageByBackend,
  invalidateCmsPagesCache,
  readAdminCmsPagesByBackend,
  updateCmsPageByBackend,
} from "@/lib/cms-pages-backend";
import { isCmsPagesEnabledServer } from "@/lib/cms-pages-feature";
import { notifyIndexNow } from "@/lib/indexnow";
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
    const previous = (await readAdminCmsPagesByBackend()).find((page) => page.id === pageId);
    const payload = (await request.json()) as CmsPageUpdateInput;
    const updated = await updateCmsPageByBackend(pageId, payload);
    if (!updated) {
      return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
    }

    invalidateCmsPagesCache();
    const changedPaths = new Set<string>();
    if (previous?.status === "published") changedPaths.add(`/${previous.slug}`);
    if (updated.status === "published") changedPaths.add(`/${updated.slug}`);
    if (changedPaths.size > 0) {
      after(() => notifyIndexNow([...changedPaths]));
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
  const previous = (await readAdminCmsPagesByBackend()).find((page) => page.id === pageId);
  const archived = await archiveCmsPageByBackend(pageId);
  if (!archived) {
    return NextResponse.json({ error: "Page introuvable." }, { status: 404 });
  }

  invalidateCmsPagesCache();
  if (previous?.status === "published") {
    after(() => notifyIndexNow([`/${previous.slug}`]));
  }

  return NextResponse.json(archived);
}
