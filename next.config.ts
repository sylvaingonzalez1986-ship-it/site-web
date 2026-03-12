import type { NextConfig } from "next";
import bundleAnalyzer from "@next/bundle-analyzer";
import { withSentryConfig } from "@sentry/nextjs";

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === "true",
});

const DEFAULT_SUPABASE_HOSTNAME = "eyowwwpdmfrulhkpvlnf.supabase.co";

const configuredSupabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "";
const configuredSupabaseHostname = configuredSupabaseOrigin
  ? new URL(configuredSupabaseOrigin).hostname
  : null;
const isNonEmptyString = (value: string | null): value is string => Boolean(value);
const supabaseHostnames = Array.from(
  new Set([DEFAULT_SUPABASE_HOSTNAME, configuredSupabaseHostname].filter(isNonEmptyString)),
);
const supabaseOrigins = supabaseHostnames.map((hostname) => `https://${hostname}`);
const supabaseCspSources = Array.from(new Set([...supabaseOrigins, "https://*.supabase.co"])).join(" ");

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    optimizePackageImports: ["lucide-react", "simple-icons"],
  },
  serverExternalPackages: ["@napi-rs/canvas"],
  async headers() {
    const vivaOrigin = "https://www.vivapayments.com";
    const isProd = process.env.NODE_ENV === "production";
    const cspDirectives = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' ${vivaOrigin}`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: blob: ${supabaseCspSources} https://static.wixstatic.com https://files.cdn.printful.com`,
      `media-src 'self' blob: ${supabaseCspSources}`,
      `font-src 'self' data:`,
      `connect-src 'self' ${supabaseCspSources} ${vivaOrigin}`,
      `frame-src ${vivaOrigin} ${supabaseCspSources}`,
      "frame-ancestors 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      ...(isProd ? ["upgrade-insecure-requests"] : []),
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
          { key: "X-Permitted-Cross-Domain-Policies", value: "none" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Content-Security-Policy",
            value: cspDirectives,
          },
        ],
      },
    ];
  },
  images: {
    formats: ["image/avif", "image/webp"],
    localPatterns: [
      {
        pathname: "/**",
      },
    ],
    remotePatterns: [
      ...supabaseHostnames.map((hostname) => ({
        protocol: "https" as const,
        hostname,
        pathname: "/storage/v1/object/public/**",
      })),
      {
        protocol: "https",
        hostname: "static.wixstatic.com",
      },
      {
        protocol: "https",
        hostname: "files.cdn.printful.com",
      },
    ],
  },
  outputFileTracingIncludes: {
    "/api/admin/products/analysis/upload": [
      "./node_modules/@napi-rs/**",
      "./node_modules/pdfjs-dist/standard_fonts/**",
    ],
    "/api/account/orders/[orderId]/invoice": [
      "./node_modules/pdfkit/js/data/**",
    ],
    "/api/admin/orders/[orderId]/invoice": [
      "./node_modules/pdfkit/js/data/**",
    ],
  },
};

const sentrySourceMapsEnabled = Boolean(
  process.env.SENTRY_AUTH_TOKEN &&
    process.env.SENTRY_ORG &&
    process.env.SENTRY_PROJECT,
);

export default withSentryConfig(withBundleAnalyzer(nextConfig), {
  silent: true,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  webpack: {
    treeshake: {
      removeDebugLogging: true,
    },
  },
  sourcemaps: {
    disable: !sentrySourceMapsEnabled,
    deleteSourcemapsAfterUpload: true,
  },
});
