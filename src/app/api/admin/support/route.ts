import { getValidatedAdminContext } from "@/lib/admin-guard";
import { findSupportForReconciliation, getAdminSupportDashboard, getAdminSupportRows, getSupportVivaConfig, mutateSupportAdmin } from "@/lib/support-backend";
import { SupportError, SUPPORT_UUID, supportCsv } from "@/lib/support-campaign";
import { readSupportBody, requireSupportOrigin, supportFailure, supportJson } from "@/lib/support-http";
import { reconcileAdminSupport } from "@/lib/support-viva";
export const runtime = "nodejs";

function periodDate(value: string | null, nextDay = false) {
  if (!value) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new SupportError("Date de période invalide.");
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) throw new SupportError("Date de période invalide.");
  if (nextDay) date.setUTCDate(date.getUTCDate() + 1);
  // Resolve Paris midnight using its actual winter/summer offset on this date.
  const offset = new Intl.DateTimeFormat("en", { timeZone: "Europe/Paris", timeZoneName: "longOffset" }).formatToParts(date).find(part => part.type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(offset ?? "");
  if (!match) throw new SupportError("Fuseau horaire indisponible.", 503);
  return new Date(date.getTime() - (match[1] === "+" ? 1 : -1) * (Number(match[2]) * 60 + Number(match[3])) * 60_000).toISOString();
}

export async function GET(request: Request) {
  try {
    if (!await getValidatedAdminContext()) return supportJson({ error: "Non autorisé." }, 401);
    const url = new URL(request.url);
    const period = { from: periodDate(url.searchParams.get("from")), until: periodDate(url.searchParams.get("to"), true) };
    if (period.from && period.until && period.from >= period.until) throw new SupportError("La fin doit suivre le début de période.");
    if (url.searchParams.get("format") === "csv") return new Response(supportCsv(await getAdminSupportRows(period)), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": 'attachment; filename="soutiens-producteurs.csv"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" },
    });
    const page = Number(url.searchParams.get("page") ?? 0);
    if (!Number.isSafeInteger(page) || page < 0 || page > 1000) throw new SupportError("Page invalide.");
    return supportJson(await getAdminSupportDashboard(period, page));
  } catch (error) { return supportFailure(error); }
}

export async function POST(request: Request) {
  try {
    const admin = await getValidatedAdminContext();
    if (!admin) return supportJson({ error: "Non autorisé." }, 401);
    requireSupportOrigin(request);
    const body = await readSupportBody(request);
    if (body.action === "campaign") {
      if (typeof body.active !== "boolean" || !(body.goalCents === null || (Number.isSafeInteger(body.goalCents) && Number(body.goalCents) > 0 && Number(body.goalCents) <= 1_000_000_000))) throw new SupportError("Objectif ou état invalide.");
      if (body.active && !getSupportVivaConfig().isConfigured) throw new SupportError(getSupportVivaConfig().configurationError ?? "Configurer Viva avant l’ouverture.", 409);
      await mutateSupportAdmin("campaign", null, { active: body.active, goalCents: body.goalCents }, admin.customerId);
    } else {
      if (typeof body.id !== "string" || !SUPPORT_UUID.test(body.id)) throw new SupportError("Référence invalide.");
      if (body.action === "visibility" && typeof body.hidden === "boolean") await mutateSupportAdmin("visibility", body.id, { hidden: body.hidden }, admin.customerId);
      else if (body.action === "fees") {
        if (!Number.isSafeInteger(body.feesCents) || Number(body.feesCents) < 0 || Number(body.feesCents) > 1_000_000 || typeof body.reference !== "string" || !body.reference.trim() || body.reference.trim().length > 200) throw new SupportError("Saisis les frais réels et la référence du relevé Viva.");
        await mutateSupportAdmin("fees", body.id, { feesCents: body.feesCents, reference: body.reference.trim() }, admin.customerId);
      } else if (body.action === "reconcile") {
        if (typeof body.transactionId !== "string" || !SUPPORT_UUID.test(body.transactionId)) throw new SupportError("Identifiant de transaction Viva invalide.");
        const record = await findSupportForReconciliation(body.id);
        if (!record) throw new SupportError("Soutien introuvable.", 404);
        await reconcileAdminSupport(record, body.transactionId);
      } else throw new SupportError("Action inconnue.");
    }
    return supportJson({ ok: true });
  } catch (error) { return supportFailure(error); }
}
