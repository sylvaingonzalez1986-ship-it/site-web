"use client";

import { useRef, type ComponentProps } from "react";
import Link from "@/components/navigation/NavigationLink";
import { useRouter } from "@/components/navigation/NavigationFeedback";
import { shopProductHref, type ShopOrigin } from "@/lib/shop-origin";
import { saveShopResults, type ShopProductControl } from "./ShopResultsRestore";

type ShopProductLinkProps = Omit<ComponentProps<typeof Link>, "href" | "onNavigate" | "ref"> & {
  href: string;
  origin?: ShopOrigin;
  control: ShopProductControl;
};

export function ShopProductLink({ href, origin, control, ...props }: ShopProductLinkProps) {
  const ref = useRef<HTMLAnchorElement>(null);
  const router = useRouter();

  return <Link {...props} ref={ref} href={origin ? shopProductHref(href, origin) : href} data-shop-product-control={control}
    onNavigate={event => {
      if (!origin || !ref.current) return;
      const resume = saveShopResults(ref.current, origin, control);
      if (!resume) return;
      event.preventDefault();
      router.push(shopProductHref(href, { ...origin, resume }));
    }} />;
}
