"use client";

import { useLayoutEffect } from "react";

let lockCount = 0;

function lockBodyScroll() {
  if (typeof window === "undefined") {
    return;
  }

  if (lockCount === 0) {
    const html = document.documentElement;
    const body = document.body;
    const scrollbarWidth = Math.max(0, window.innerWidth - html.clientWidth);
    const paddingRight = Number.parseFloat(window.getComputedStyle(body).paddingRight) || 0;

    // Own a CSS lock instead of snapshotting inline overflow/padding. Other
    // overlays (including Next's error panel) must not save our lock as their
    // restore value, or crossing close order can leave every page unscrollable.
    html.style.setProperty("--site-scroll-lock-padding-right", `${paddingRight + scrollbarWidth}px`);
    html.setAttribute("data-site-scroll-locked", "");
  }

  lockCount += 1;
}

function unlockBodyScroll() {
  if (typeof window === "undefined") {
    return;
  }

  lockCount = Math.max(0, lockCount - 1);
  if (lockCount > 0) {
    return;
  }

  const html = document.documentElement;
  html.removeAttribute("data-site-scroll-locked");
  html.style.removeProperty("--site-scroll-lock-padding-right");
  // Overflow locking keeps the current position. Restoring an opening-time
  // snapshot here would override navigation that happened inside the modal.
}

export function useBodyScrollLock(locked: boolean) {
  useLayoutEffect(() => {
    if (!locked) {
      return;
    }

    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [locked]);
}
