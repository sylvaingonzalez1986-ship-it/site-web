import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  reactCompiler: true,
  async headers() {
    const supabaseOrigin = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "") || "";
    const vivaOrigin = "https://www.vivapayments.com";
    const cspDirectives = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline' 'unsafe-eval' ${vivaOrigin}`,
      `style-src 'self' 'unsafe-inline'`,
      `img-src 'self' data: blob: ${supabaseOrigin} https://static.wixstatic.com https://files.cdn.printful.com`,
      `font-src 'self' data:`,
      `connect-src 'self' ${supabaseOrigin} ${vivaOrigin}`,
      `frame-src ${vivaOrigin}`,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
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
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Content-Security-Policy-Report-Only",
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
    ],
    "/api/account/orders/[orderId]/invoice": [
      "./node_modules/pdfkit/js/data/**",
    ],
  },
};

export default nextConfig;
