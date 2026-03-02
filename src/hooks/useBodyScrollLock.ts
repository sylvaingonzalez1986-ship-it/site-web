"use client";

import { useEffect } from "react";

let lockCount = 0;
let lockedScrollY = 0;
let prevHtmlOverflow = "";
let prevBodyOverflow = "";
let prevBodyPaddingRight = "";

function lockBodyScroll() {
  if (typeof window === "undefined") {
    return;
  }

  if (lockCount === 0) {
    const html = document.documentElement;
    const body = document.body;
    lockedScrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - html.clientWidth;

    prevHtmlOverflow = html.style.overflow;
    prevBodyOverflow = body.style.overflow;
    prevBodyPaddingRight = body.style.paddingRight;

    // Use overflow:hidden on both html & body — no position:fixed.
    // position:fixed on <body> kills touch-scrolling inside modals on iOS Safari.
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    if (scrollbarWidth > 0) {
      body.style.paddingRight = `${scrollbarWidth}px`;
    }
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
  const body = document.body;
  html.style.overflow = prevHtmlOverflow;
  body.style.overflow = prevBodyOverflow;
  body.style.paddingRight = prevBodyPaddingRight;
  window.scrollTo(0, lockedScrollY);
}

export function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) {
      return;
    }

    lockBodyScroll();
    return () => {
      unlockBodyScroll();
    };
  }, [locked]);
}
