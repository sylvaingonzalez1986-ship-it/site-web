"use client";

import { useEffect } from "react";

let lockCount = 0;
let lockedScrollY = 0;
let previousOverflow = "";
let previousPosition = "";
let previousTop = "";
let previousWidth = "";
let previousPaddingRight = "";

function lockBodyScroll() {
  if (typeof window === "undefined") {
    return;
  }

  if (lockCount === 0) {
    const body = document.body;
    lockedScrollY = window.scrollY;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    previousOverflow = body.style.overflow;
    previousPosition = body.style.position;
    previousTop = body.style.top;
    previousWidth = body.style.width;
    previousPaddingRight = body.style.paddingRight;

    body.style.overflow = "hidden";
    body.style.position = "fixed";
    body.style.top = `-${lockedScrollY}px`;
    body.style.width = "100%";
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

  const body = document.body;
  body.style.overflow = previousOverflow;
  body.style.position = previousPosition;
  body.style.top = previousTop;
  body.style.width = previousWidth;
  body.style.paddingRight = previousPaddingRight;
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
