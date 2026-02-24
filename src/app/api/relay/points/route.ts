import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { MondialRelayPoint } from "@/lib/shipping";
import { getRequestIp, hitRateLimit } from "@/lib/security-rate-limit";

export const runtime = "nodejs";

const DEFAULT_COUNTRY = "FR";
const DEFAULT_MAX_RESULTS = "15";
const DEFAULT_ACTION = "24R";

function sanitizePostalCode(value: string | null): string {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 10);
}

function sanitizeCity(value: string | null): string {
  if (!value) {
    return "";
  }

  return value
    .trim()
    .replace(/[<>]/g, "")
    .slice(0, 80);
}

function sanitizeCountry(value: string | null): string {
  if (!value) {
    return DEFAULT_COUNTRY;
  }

  const normalized = value.trim().toUpperCase().replace(/[^A-Z]/g, "");
  if (normalized.length < 2) {
    return DEFAULT_COUNTRY;
  }

  return normalized.slice(0, 2);
}

function xmlDecode(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim();
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+^${}()|[\]\\]/g, "\\$&");
}

function readXmlTag(block: string, tags: string[]): string {
  for (const tag of tags) {
    const pattern = new RegExp(
      `<(?:(?:\\w+):)?${escapeRegex(tag)}\\b[^>]*>([\\s\\S]*?)</(?:(?:\\w+):)?${escapeRegex(tag)}>`,
      "i",
    );
    const match = block.match(pattern);
    if (match?.[1]) {
      return xmlDecode(match[1]);
    }
  }

  return "";
}

function parsePointsFromXml(xml: string, fallbackCountry: string): {
  statusCode: string | null;
  points: MondialRelayPoint[];
} {
  const statusMatch = xml.match(
    /<(?:(?:\w+):)?STAT\b[^>]*>([^<]*)<\/(?:(?:\w+):)?STAT>/i,
  );
  const statusCode = statusMatch?.[1]?.trim() || null;

  const points: MondialRelayPoint[] = [];
  const dedupe = new Set<string>();
  const blockRegex =
    /<(?:(?:\w+):)?(?:PointRelais_Details|PointsRelais_Details)\b[^>]*>([\s\S]*?)<\/(?:(?:\w+):)?(?:PointRelais_Details|PointsRelais_Details)>/gi;

  let blockMatch = blockRegex.exec(xml);
  while (blockMatch) {
    const block = blockMatch?.[1] ?? "";
    const id = readXmlTag(block, ["Num", "ID"]).slice(0, 64);
    const name = readXmlTag(block, ["LgAdr1", "Nom"]).slice(0, 120);
    const postalCode = readXmlTag(block, ["CP"]).slice(0, 16);
    const city = readXmlTag(block, ["Ville"]).slice(0, 120);
    const country = readXmlTag(block, ["Pays"]).slice(0, 4) || fallbackCountry;

    const addressParts = [
      readXmlTag(block, ["LgAdr1", "Adresse1"]),
      readXmlTag(block, ["LgAdr2", "Adresse2"]),
      readXmlTag(block, ["LgAdr3", "Adresse3"]),
      readXmlTag(block, ["LgAdr4", "Adresse4"]),
    ]
      .map((part) => part.trim())
      .filter(Boolean);

    if (!id || dedupe.has(id)) {
      blockMatch = blockRegex.exec(xml);
      continue;
    }

    dedupe.add(id);
    points.push({
      id,
      name: name || `Point Relais ${id}`,
      address: addressParts.join(", ") || city,
      city,
      postalCode,
      country,
    });

    blockMatch = blockRegex.exec(xml);
  }

  return { statusCode, points };
}

function looksLikeHtmlErrorPage(payload: string): boolean {
  const sample = payload.slice(0, 800).toLowerCase();
  return sample.includes("<!doctype html") || sample.includes("<html");
}

function mapStatusMessage(statusCode: string | null): string {
  switch (statusCode) {
    case "0":
      return "ok";
    case "80":
      return "Aucun Point Relais trouve pour cette recherche.";
    case "81":
      return "Pays non pris en charge pour cette recherche Point Relais.";
    case "82":
      return "Code postal invalide pour la recherche Point Relais.";
    case "97":
      return "Requête Mondial Relay invalide.";
    case "98":
      return "Paramêtres Mondial Relay invalides.";
    default:
      return "Recherche Point Relais indisponible pour le moment.";
  }
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getApi1Config(): { url: string; enseigne: string; privateKey: string } {
  const url =
    process.env.MONDIAL_RELAY_API1_URL?.trim() ||
    "https://api.mondialrelay.com/WebService.asmx";
  const enseigne =
    process.env.MONDIAL_RELAY_API1_ENSEIGNE?.trim() ||
    process.env.NEXT_PUBLIC_MONDIAL_RELAY_BRAND?.trim() ||
    "";
  const privateKey = process.env.MONDIAL_RELAY_API1_PRIVATE_KEY?.trim() || "";

  if (!enseigne || !privateKey) {
    throw new Error("MONDIAL_RELAY_API1_CONFIG_MISSING");
  }

  return { url, enseigne, privateKey };
}

function buildSignaturePayload(input: {
  enseigne: string;
  country: string;
  postalCode: string;
  city: string;
  maxResults: string;
}): Record<string, string> {
  return {
    Enseigne: input.enseigne,
    Pays: input.country,
    NumPointRelais: "",
    Ville: input.city,
    CP: input.postalCode,
    Latitude: "",
    Longitude: "",
    Taille: "",
    Poids: String(Math.max(1, Number(process.env.MONDIAL_RELAY_DEFAULT_WEIGHT_G ?? 500) || 500)),
    Action: DEFAULT_ACTION,
    DelaiEnvoi: "",
    RayonRecherche: "20",
    TypeActivite: "",
    NACE: "",
    NombreResultats: input.maxResults,
  };
}

function resolveSoapEndpoint(baseUrl: string): string {
  const trimmed = baseUrl.trim();
  if (!trimmed) {
    return "https://api.mondialrelay.com/WebService.asmx";
  }

  if (/WebService\.asmx$/i.test(trimmed)) {
    return trimmed;
  }

  const match = trimmed.match(/^(.*WebService\.asmx)/i);
  if (match?.[1]) {
    return match[1];
  }

  return trimmed.replace(/\/+$/, "");
}

function buildSoapBody(input: {
  enseigne: string;
  privateKey: string;
  country: string;
  postalCode: string;
  city: string;
  maxResults: string;
}): string {
  const signatureParts = buildSignaturePayload({
    enseigne: input.enseigne,
    country: input.country,
    postalCode: input.postalCode,
    city: input.city,
    maxResults: input.maxResults,
  });
  const securityRaw = `${
    signatureParts.Enseigne
  }${signatureParts.Pays}${signatureParts.NumPointRelais}${signatureParts.Ville}${signatureParts.CP}${signatureParts.Latitude}${signatureParts.Longitude}${signatureParts.Taille}${signatureParts.Poids}${signatureParts.Action}${signatureParts.DelaiEnvoi}${signatureParts.RayonRecherche}${signatureParts.TypeActivite}${signatureParts.NACE}${signatureParts.NombreResultats}${input.privateKey}`;
  const security = createHash("md5").update(securityRaw, "utf8").digest("hex").toUpperCase();

  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <WSI4_PointRelais_Recherche xmlns="http://www.mondialrelay.fr/webservice/">
      <Enseigne>${escapeXml(signatureParts.Enseigne)}</Enseigne>
      <Pays>${escapeXml(signatureParts.Pays)}</Pays>
      <NumPointRelais>${escapeXml(signatureParts.NumPointRelais)}</NumPointRelais>
      <Ville>${escapeXml(signatureParts.Ville)}</Ville>
      <CP>${escapeXml(signatureParts.CP)}</CP>
      <Latitude>${escapeXml(signatureParts.Latitude)}</Latitude>
      <Longitude>${escapeXml(signatureParts.Longitude)}</Longitude>
      <Taille>${escapeXml(signatureParts.Taille)}</Taille>
      <Poids>${escapeXml(signatureParts.Poids)}</Poids>
      <Action>${escapeXml(signatureParts.Action)}</Action>
      <DelaiEnvoi>${escapeXml(signatureParts.DelaiEnvoi)}</DelaiEnvoi>
      <RayonRecherche>${escapeXml(signatureParts.RayonRecherche)}</RayonRecherche>
      <TypeActivite>${escapeXml(signatureParts.TypeActivite)}</TypeActivite>
      <NACE>${escapeXml(signatureParts.NACE)}</NACE>
      <NombreResultats>${escapeXml(signatureParts.NombreResultats)}</NombreResultats>
      <Security>${escapeXml(security)}</Security>
    </WSI4_PointRelais_Recherche>
  </soap:Body>
</soap:Envelope>`;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const postalCode = sanitizePostalCode(url.searchParams.get("postalCode"));
  const city = sanitizeCity(url.searchParams.get("city"));
  const country = sanitizeCountry(url.searchParams.get("country"));

  if (postalCode.length < 4) {
    return NextResponse.json(
      { error: "Code postal invalide. 4 caracteres minimum." },
      { status: 400 },
    );
  }

  try {
    const ip = getRequestIp(request);
    const rateLimit = await hitRateLimit({
      key: `relay_lookup:${ip}:${postalCode}`,
      windowSeconds: 60,
      maxHits: 20,
    });
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: "Trop de recherches Point Relais. Réessaie dans un instant." },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        },
      );
    }

    const config = getApi1Config();
    const soapEndpoint = resolveSoapEndpoint(config.url);
    const soapBody = buildSoapBody({
      enseigne: config.enseigne,
      privateKey: config.privateKey,
      country,
      postalCode,
      city,
      maxResults: DEFAULT_MAX_RESULTS,
    });

    const relayResponse = await fetch(soapEndpoint, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "text/xml, application/xml;q=0.9, */*;q=0.1",
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: "\"http://www.mondialrelay.fr/webservice/WSI4_PointRelais_Recherche\"",
      },
      body: soapBody,
    });

    if (!relayResponse.ok) {
      return NextResponse.json(
        { error: "Service Mondial Relay indisponible." },
        { status: 502 },
      );
    }

    const xml = await relayResponse.text();
    if (!xml) {
      return NextResponse.json(
        { error: "Reponse Mondial Relay vide." },
        { status: 502 },
      );
    }
    if (looksLikeHtmlErrorPage(xml)) {
      return NextResponse.json(
        { error: "Format de reponse Mondial Relay invalide (HTML recu)." },
        { status: 502 },
      );
    }

    const parsed = parsePointsFromXml(xml, country);
    if (!parsed.statusCode && parsed.points.length === 0) {
      return NextResponse.json(
        { error: "Format de reponse Mondial Relay invalide (STAT absent)." },
        { status: 502 },
      );
    }
    if (parsed.statusCode === "0" && parsed.points.length === 0) {
      return NextResponse.json(
        { error: "Reponse Mondial Relay incoherente (aucun point retourne)." },
        { status: 502 },
      );
    }

    return NextResponse.json({
      points: parsed.points,
      statusCode: parsed.statusCode,
      message: mapStatusMessage(parsed.statusCode),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Erreur Mondial Relay.";

    if (message.includes("MONDIAL_RELAY_API1_CONFIG_MISSING")) {
      return NextResponse.json(
        { error: "Configuration Mondial Relay incomplète." },
        { status: 503 },
      );
    }

    if (message.includes("rpc_rate_limit_hit")) {
      return NextResponse.json(
        { error: "Protection anti-abus indisponible. Réessaie plus tard." },
        { status: 503 },
      );
    }

    return NextResponse.json(
      { error: "Recherche Point Relais indisponible." },
      { status: 502 },
    );
  }
}



