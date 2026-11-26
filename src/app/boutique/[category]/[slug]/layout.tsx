import { headers } from "next/headers";
import type { ReactNode } from "react";

// The browser omits fragments from HTTP requests. Remember this single public
// anchor before Next's streamed redirect can replace an obsolete category URL.
const rememberReview = `try {
  if (location.hash === "#avis-degustation") {
    sessionStorage.setItem("shop:review-anchor", JSON.stringify([location.pathname, Date.now()]));
  }
} catch {}`;

export default async function ProductLayout({ children }: { children: ReactNode }) {
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return <><script nonce={nonce} dangerouslySetInnerHTML={{ __html: rememberReview }} />{children}</>;
}
