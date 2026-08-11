import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-auth";

const MUTATIVE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const AGE_GATE_COOKIE_NAME = "age_verified";
const CRAWLER_USER_AGENT_PATTERN =
  /(googlebot|bingbot|duckduckbot|yandex(bot)?|baiduspider|facebookexternalhit|twitterbot|linkedinbot|slurp|applebot|pinterestbot|discordbot|whatsapp|petalbot|ahrefsbot|semrushbot)/i;

const SUPABASE_HOSTNAME = "eyowwwpdmfrulhkpvlnf.supabase.co";
const SUPABASE_CSP_SOURCES = `https://${SUPABASE_HOSTNAME} https://*.supabase.co`;
const VIVA_ORIGIN = "https://www.vivapayments.com";

function buildCspHeader(nonce: string): string {
  const isProd = process.env.NODE_ENV === "production";
  const devConnectSources = isProd ? "" : " ws:";
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' ${VIVA_ORIGIN}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: ${SUPABASE_CSP_SOURCES} https://static.wixstatic.com https://files.cdn.printful.com`,
    `media-src 'self' blob: ${SUPABASE_CSP_SOURCES}`,
    `font-src 'self' data:`,
    `connect-src 'self'${devConnectSources} ${SUPABASE_CSP_SOURCES} ${VIVA_ORIGIN}`,
    `frame-src ${VIVA_ORIGIN} ${SUPABASE_CSP_SOURCES}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ];
  return directives.join("; ");
}

async function isAdminAuthorized(request: NextRequest): Promise<boolean> {
  try {
    const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value;
    return await verifyAdminSessionToken(token);
  } catch {
    return false;
  }
}

function hasCustomerSession(request: NextRequest): boolean {
  return request.cookies
    .getAll()
    .some((cookie) => {
      if (!cookie.name.startsWith("sb-")) {
        return false;
      }

      // Accept only real Supabase session cookies:
      // sb-<project-ref>-auth-token
      // sb-<project-ref>-auth-token.0 / .1 / ...
      if (!/^sb-[a-z0-9-]+-auth-token(?:\.\d+)?$/i.test(cookie.name)) {
        return false;
      }

      const value = (cookie.value ?? "").trim().toLowerCase();
      if (!value || value === "deleted" || value === "null" || value === "undefined") {
        return false;
      }

      return true;
    });
}

let cachedAgeGateKeyPromise: Promise<CryptoKey> | null = null;

function getAgeGateSigningKey(): Promise<CryptoKey> {
  if (!cachedAgeGateKeyPromise) {
    const secret = process.env.ADMIN_SESSION_SECRET?.trim();
    if (!secret) {
      return Promise.reject(new Error("ADMIN_SESSION_SECRET manquant."));
    }
    cachedAgeGateKeyPromise = crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
  }
  return cachedAgeGateKeyPromise;
}

async function verifyAgeGateCookie(request: NextRequest): Promise<boolean> {
  const value = request.cookies.get(AGE_GATE_COOKIE_NAME)?.value ?? "";
  if (!value.startsWith("true.")) {
    return false;
  }
  const receivedSig = value.slice(5);
  if (receivedSig.length !== 16) {
    return false;
  }
  try {
    const key = await getAgeGateSigningKey();
    const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode("age_verified:true"));
    const expectedSig = Array.from(new Uint8Array(sigBuf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("")
      .slice(0, 16);
    return receivedSig === expectedSig;
  } catch {
    return false;
  }
}

function isCrawlerRequest(request: NextRequest): boolean {
  const userAgent = request.headers.get("user-agent") || "";
  return CRAWLER_USER_AGENT_PATTERN.test(userAgent);
}

function isDocumentNavigationRequest(request: NextRequest): boolean {
  if (request.method !== "GET") {
    return false;
  }

  const secFetchDest = request.headers.get("sec-fetch-dest");
  if (secFetchDest === "document") {
    return true;
  }

  const accept = request.headers.get("accept") || "";
  return accept.includes("text/html");
}

export function shouldEnforceAgeGate(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/profil" ||
    pathname.startsWith("/compte") ||
    pathname.startsWith("/bete-de-concours") ||
    pathname.startsWith("/arene") ||
    pathname.startsWith("/boutique") ||
    pathname.startsWith("/blog")
  );
}

export function shouldValidateMutativeOrigin(pathname: string, method: string): boolean {
  if (!MUTATIVE_METHODS.has(method)) {
    return false;
  }

  return (
    pathname.startsWith("/api/admin") ||
    pathname.startsWith("/api/account") ||
    pathname.startsWith("/api/contest") ||
    (pathname.startsWith("/api/checkout") && pathname !== "/api/checkout/viva/webhook")
  );
}

export function isAdminRestrictedPage(pathname: string): boolean {
  return pathname.startsWith("/admin") || pathname === "/dev/placard" || pathname.startsWith("/dev/placard/");
}

function sanitizeNextPath(value: string | null): string {
  if (!value) {
    return "/";
  }
  if (!value.startsWith("/") || value.startsWith("//")) {
    return "/";
  }
  return value;
}

function isValidOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) {
    // For mutative requests, a missing Origin header is suspicious (non-browser client
    // or very old browser). Allow only for webhook endpoints that receive server-to-server
    // calls. For everything else, require the header on mutative methods.
    if (MUTATIVE_METHODS.has(request.method)) {
      return false;
    }
    return true;
  }

  try {
    const originHost = new URL(origin).host;
    const requestHost = request.headers.get("host") || "";
    return originHost === requestHost;
  } catch {
    return false;
  }
}

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const nonce = crypto.randomUUID().replace(/-/g, "");
  const cspHeader = buildCspHeader(nonce);
  const secure = <T extends NextResponse>(response: T): T => {
    response.headers.set("Content-Security-Policy", cspHeader);
    if (pathname.startsWith("/paiement")) {
      response.headers.set("Cache-Control", "private, no-store, max-age=0");
      response.headers.set("Referrer-Policy", "no-referrer");
    }
    return response;
  };
  const customerAuthenticated = hasCustomerSession(request);
  const ageVerified = await verifyAgeGateCookie(request);
  const isCrawler = isCrawlerRequest(request);
  const isDocumentNavigation = isDocumentNavigationRequest(request);

  const isAdminPage = isAdminRestrictedPage(pathname);
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminLoginPage = pathname === "/admin/login";
  const isAdminLoginApi = pathname === "/api/admin/login";
  const isAdminLogoutApi = pathname === "/api/admin/logout";
  const needsAdminSessionCheck = isAdminPage || isAdminApi || isAdminLoginPage;
  const adminAuthorized = needsAdminSessionCheck
    ? await isAdminAuthorized(request)
    : false;

  const isProfilePage = pathname === "/profil";
  const isCustomerApi = pathname.startsWith("/api/account");
  const isAuthCallbackApi = pathname === "/api/auth/callback";
  const isCheckoutWebhookApi = pathname === "/api/checkout/viva/webhook";
  const isCustomerAuthApi =
    pathname === "/api/account/login" ||
    pathname === "/api/account/register" ||
    pathname === "/api/account/logout" ||
    pathname === "/api/account/password-reset/request" ||
    pathname === "/api/account/password-reset/confirm";
  const isAgeGatePage = pathname === "/age-gate";

  if (isAgeGatePage && ageVerified && isDocumentNavigation) {
    const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get("next"));
    return secure(NextResponse.redirect(new URL(nextPath, request.url)));
  }

  if (
    !isAgeGatePage &&
    shouldEnforceAgeGate(pathname) &&
    isDocumentNavigation &&
    !ageVerified &&
    !isCrawler
  ) {
    const ageGateUrl = new URL("/age-gate", request.url);
    ageGateUrl.searchParams.set("next", `${pathname}${search}`);
    return secure(NextResponse.redirect(ageGateUrl));
  }

  if (shouldValidateMutativeOrigin(pathname, request.method) && !isValidOrigin(request)) {
    return secure(NextResponse.json({ error: "Requete refusee (origine invalide)." }, { status: 403 }));
  }

  if (isAdminLoginApi || isAdminLogoutApi || isCustomerAuthApi || isAuthCallbackApi) {
    return secure(NextResponse.next());
  }

  if (isAdminLoginPage && adminAuthorized) {
    return secure(NextResponse.redirect(new URL("/admin", request.url)));
  }

  if ((isAdminPage || isAdminApi) && !adminAuthorized && !isAdminLoginPage) {
    if (isAdminApi) {
      return secure(NextResponse.json({ error: "Non autorise." }, { status: 401 }));
    }

    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return secure(NextResponse.redirect(loginUrl));
  }


  if ((isProfilePage || isCustomerApi) && !customerAuthenticated) {
    if (isCustomerApi) {
      return secure(NextResponse.json({ error: "Non autorise." }, { status: 401 }));
    }

    const loginUrl = new URL("/compte/connexion", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return secure(NextResponse.redirect(loginUrl));
  }

  if (
    pathname.startsWith("/api/checkout") &&
    !isCheckoutWebhookApi &&
    MUTATIVE_METHODS.has(request.method) &&
    !customerAuthenticated
  ) {
    return secure(NextResponse.json({ error: "Connexion requise." }, { status: 401 }));
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  return secure(response);
}

export const config = {
  matcher: [
    "/((?!_next/|favicon\\.ico|app/|uploads/|robots\\.txt|sitemap\\.xml).*)",
  ],
};
