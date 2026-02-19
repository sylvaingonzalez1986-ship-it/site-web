import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE_NAME, verifyAdminSessionToken } from "@/lib/admin-auth";

const MUTATIVE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const AGE_GATE_COOKIE_NAME = "age_verified";
const CRAWLER_USER_AGENT_PATTERN =
  /(googlebot|bingbot|duckduckbot|yandex(bot)?|baiduspider|facebookexternalhit|twitterbot|linkedinbot|slurp|applebot)/i;

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
    .some((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"));
}

function hasAgeGateCookie(request: NextRequest): boolean {
  return request.cookies.get(AGE_GATE_COOKIE_NAME)?.value === "true";
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

function shouldEnforceAgeGate(pathname: string): boolean {
  return (
    pathname === "/" ||
    pathname === "/profil" ||
    pathname.startsWith("/compte") ||
    pathname.startsWith("/application") ||
    pathname.startsWith("/boutique") ||
    pathname.startsWith("/blog")
  );
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
  const customerAuthenticated = hasCustomerSession(request);
  const ageVerified = hasAgeGateCookie(request);
  const isCrawler = isCrawlerRequest(request);
  const isDocumentNavigation = isDocumentNavigationRequest(request);

  const isAdminPage = pathname.startsWith("/admin");
  const isAdminApi = pathname.startsWith("/api/admin");
  const isAdminLoginPage = pathname === "/admin/login";
  const isAdminLoginApi = pathname === "/api/admin/login";
  const isAdminLogoutApi = pathname === "/api/admin/logout";
  const needsAdminSessionCheck = isAdminPage || isAdminApi || isAdminLoginPage;
  const adminAuthorized = needsAdminSessionCheck
    ? await isAdminAuthorized(request)
    : false;

  const isProfilePage = pathname === "/profil";
  const isCustomerAuthPage =
    pathname === "/compte/connexion" || pathname === "/compte/inscription";
  const isCustomerApi = pathname.startsWith("/api/account");
  const isCheckoutApi = pathname.startsWith("/api/checkout");
  const isCheckoutWebhookApi = pathname === "/api/checkout/viva/webhook";
  const isCustomerAuthApi =
    pathname === "/api/account/login" ||
    pathname === "/api/account/register" ||
    pathname === "/api/account/logout";
  const isAgeGatePage = pathname === "/age-gate";

  if (isAgeGatePage && ageVerified && isDocumentNavigation) {
    const nextPath = sanitizeNextPath(request.nextUrl.searchParams.get("next"));
    return NextResponse.redirect(new URL(nextPath, request.url));
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
    return NextResponse.redirect(ageGateUrl);
  }

  if (isAdminApi && MUTATIVE_METHODS.has(request.method) && !isValidOrigin(request)) {
    return NextResponse.json({ error: "Requete refusee (origine invalide)." }, { status: 403 });
  }
  if (isCustomerApi && MUTATIVE_METHODS.has(request.method) && !isValidOrigin(request)) {
    return NextResponse.json({ error: "Requete refusee (origine invalide)." }, { status: 403 });
  }
  if (isCheckoutApi && MUTATIVE_METHODS.has(request.method) && !isValidOrigin(request)) {
    return NextResponse.json({ error: "Requete refusee (origine invalide)." }, { status: 403 });
  }

  if (isAdminLoginApi || isAdminLogoutApi || isCustomerAuthApi) {
    return NextResponse.next();
  }

  if (isAdminLoginPage && adminAuthorized) {
    return NextResponse.redirect(new URL("/admin", request.url));
  }

  if ((isAdminPage || isAdminApi) && !adminAuthorized) {
    if (isAdminApi) {
      return NextResponse.json({ error: "Non autorise." }, { status: 401 });
    }

    const loginUrl = new URL("/admin/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (isCustomerAuthPage && customerAuthenticated) {
    return NextResponse.redirect(new URL("/profil", request.url));
  }

  if ((isProfilePage || isCustomerApi) && !customerAuthenticated) {
    if (isCustomerApi) {
      return NextResponse.json({ error: "Non autorise." }, { status: 401 });
    }

    const loginUrl = new URL("/compte/connexion", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(loginUrl);
  }

  if (
    isCheckoutApi &&
    !isCheckoutWebhookApi &&
    MUTATIVE_METHODS.has(request.method) &&
    !customerAuthenticated
  ) {
    return NextResponse.json({ error: "Connexion requise." }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/admin/:path*",
    "/age-gate",
    "/application/:path*",
    "/boutique/:path*",
    "/blog/:path*",
    "/api/admin/:path*",
    "/profil",
    "/compte/:path*",
    "/api/account/:path*",
    "/api/checkout/:path*",
  ],
};
