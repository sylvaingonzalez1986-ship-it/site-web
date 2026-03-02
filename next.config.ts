import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  reactCompiler: true,
  serverExternalPackages: ["@napi-rs/canvas"],
  async headers() {
    const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "";
    const vivaOrigin = "https://www.vivapayments.com";
    const isProd = process.env.NODE_ENV === "production";
    const cspDirectives = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' ${vivaOrigin}`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: blob: ${supabaseOrigin} https://static.wixstatic.com https://files.cdn.printful.com`,
      `media-src 'self' blob: ${supabaseOrigin}`,
      `font-src 'self' data:`,
      `connect-src 'self' ${supabaseOrigin} ${vivaOrigin}`,
      `frame-src ${vivaOrigin}`,
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
    remotePatterns: [
      ...(supabaseHostname
        ? [
            {
              protocol: "https" as const,
              hostname: supabaseHostname,
              pathname: "/storage/v1/object/public/**",
            },
          ]
        : []),
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
    "/*": [
      "./node_modules/pdfkit/js/data/**",
      "./node_modules/@napi-rs/**",
      "./node_modules/pdfjs-dist/standard_fonts/**",
    ],
    "/api/account/orders/[orderId]/invoice": [
      "./node_modules/pdfkit/js/data/**",
    ],
  },
};

export default nextConfig;
