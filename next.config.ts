import type { NextConfig } from "next";

const supabaseHostname = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : null;

const nextConfig: NextConfig = {
  reactCompiler: true,
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
