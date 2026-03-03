import { NextResponse } from "next/server";
import { denyIfNotAdminApi } from "@/lib/admin-guard";
import {
  createCmsPageByBackend,
  invalidateCmsPagesCache,
  readAdminCmsPagesByBackend,
} from "@/lib/cms-pages-backend";
import { isCmsPagesEnabledServer } from "@/lib/cms-pages-feature";
import type { CmsPageCreateInput } from "@/types/cms-pages";

export const runtime = "nodejs";

export async function GET() {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }
  if (!isCmsPagesEnabledServer()) {
    return NextResponse.json({ error: "CMS pages disabled." }, { status: 503 });
  }

  const pages = await readAdminCmsPagesByBackend();
  return NextResponse.json({ pages });
}

export async function POST(request: Request) {
  const denied = await denyIfNotAdminApi();
  if (denied) {
    return denied;
  }
  if (!isCmsPagesEnabledServer()) {
    return NextResponse.json({ error: "CMS pages disabled." }, { status: 503 });
  }

  try {
    const payload = (await request.json()) as CmsPageCreateInput;
    const page = await createCmsPageByBackend(payload);
    invalidateCmsPagesCache();
    return NextResponse.json(page, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Payload invalide.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
