"use client";

import Link, { useLinkStatus } from "next/link";
import type { ComponentProps } from "react";
import { NavigationPending } from "./NavigationFeedback";

function LinkPending({ href }: Pick<ComponentProps<typeof Link>, "href">) {
  const { pending } = useLinkStatus();
  let changesPage = true;
  if (pending && typeof href === "string" && typeof window !== "undefined") {
    const destination = new URL(href, window.location.href);
    changesPage = destination.pathname !== window.location.pathname || destination.search !== window.location.search;
  }
  return <NavigationPending active={pending && changesPage} />;
}

export default function NavigationLink({ children, ...props }: ComponentProps<typeof Link>) {
  return <Link {...props}>{children}<LinkPending href={props.href} /></Link>;
}
