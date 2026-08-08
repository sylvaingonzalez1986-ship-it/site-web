"use client";

import { ChevronLeft, ChevronRight, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
  type Ref,
  type TouchEvent as ReactTouchEvent,
} from "react";
import styles from "./NotebookFlipBook.module.css";

type NotebookFlipBookLabels = {
  previous?: string;
  next?: string;
  pageLabel?: string;
};

type NotebookFlipBookProps = {
  left: ReactNode;
  right: ReactNode;
  cover?: ReactNode;
  spreadOverlay?: ReactNode;
  dialogOverlay?: ReactNode;
  sideTabs?: ReactNode;
  mobileToolbar?: ReactNode;
  className?: string;
  leftPageClassName?: string;
  rightPageClassName?: string;
  leftInnerProps?: NotebookPageInnerProps;
  rightInnerProps?: NotebookPageInnerProps;
  leftInnerRef?: Ref<HTMLDivElement>;
  rightInnerRef?: Ref<HTMLDivElement>;
  initialPage?: 0 | 1;
  activePage?: 0 | 1;
  coverOpenPage?: 0 | 1;
  onActivePageChange?: (page: 0 | 1) => void;
  labels?: NotebookFlipBookLabels;
  variant?: "default" | "editorial";
  tone?: "green" | "gold";
};

type NotebookPageInnerProps = Omit<HTMLAttributes<HTMLDivElement>, "children">;

const TURN_DURATION_MS = 560;

export function NotebookFlipBook({
  left,
  right,
  cover,
  spreadOverlay,
  dialogOverlay,
  sideTabs,
  mobileToolbar,
  className,
  leftPageClassName,
  rightPageClassName,
  leftInnerProps,
  rightInnerProps,
  leftInnerRef,
  rightInnerRef,
  initialPage = 0,
  activePage,
  coverOpenPage = initialPage,
  onActivePageChange,
  labels,
  variant = "default",
  tone = "green",
}: NotebookFlipBookProps) {
  const [internalPage, setInternalPage] = useState<0 | 1>(cover ? coverOpenPage : initialPage);
  const [isCoverOpen, setIsCoverOpen] = useState(!cover);
  const [turnDirection, setTurnDirection] = useState<"previous" | "next" | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const dragRef = useRef<{ x: number; y: number } | null>(null);
  const coverDragRef = useRef<{ x: number; y: number } | null>(null);
  const coverButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const coverOpenRef = useRef(!cover);
  const currentPage = activePage ?? internalPage;
  const isControlled = typeof activePage === "number";
  const hasSideTabs = Boolean(sideTabs);
  const variantClassName = variant === "editorial" ? styles.editorial : "";
  const { className: leftInnerClassName, ...leftInnerRest } = leftInnerProps ?? {};
  const { className: rightInnerClassName, ...rightInnerRest } = rightInnerProps ?? {};

  useEffect(
    () => () => {
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    },
    [],
  );

  useEffect(() => {
    coverOpenRef.current = isCoverOpen;
  }, [isCoverOpen]);

  const setPage = useCallback((nextPage: 0 | 1) => {
    if (!isControlled) {
      setInternalPage(nextPage);
    }
    onActivePageChange?.(nextPage);
  }, [isControlled, onActivePageChange]);

  const finishTurnAnimation = useCallback(() => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = window.setTimeout(() => {
      setTurnDirection(null);
      timeoutRef.current = null;
    }, TURN_DURATION_MS);
  }, []);

  const openCover = useCallback(() => {
    if (coverOpenRef.current) {
      return;
    }

    coverOpenRef.current = true;
    setTurnDirection("next");
    setIsCoverOpen(true);
    setPage(coverOpenPage);
    finishTurnAnimation();
  }, [coverOpenPage, finishTurnAnimation, setPage]);

  const closeCover = useCallback(() => {
    coverOpenRef.current = false;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setTurnDirection(null);
    setIsCoverOpen(false);
    if (dialogRef.current?.open) {
      dialogRef.current.close();
    }
  }, []);

  useEffect(() => {
    if (!cover || !isCoverOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("contest-notebook-open");

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeCover();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("contest-notebook-open");
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [closeCover, cover, isCoverOpen]);

  useEffect(() => {
    if (!cover) {
      return;
    }

    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }

    if (isCoverOpen) {
      if (!dialog.open) {
        if (typeof dialog.showModal === "function") {
          dialog.showModal();
        } else {
          dialog.setAttribute("open", "");
        }
      }
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
  }, [cover, isCoverOpen]);

  useEffect(() => {
    if (!cover || !isCoverOpen) {
      return;
    }

    const modal = dialogRef.current;
    if (!modal) {
      return;
    }

    let focusedFieldScrollTimer: number | null = null;

    const syncVisibleViewport = () => {
      const visibleViewport = window.visualViewport;
      const top = visibleViewport?.offsetTop ?? 0;
      const left = visibleViewport?.offsetLeft ?? 0;
      const width = visibleViewport?.width ?? window.innerWidth;
      const height = visibleViewport?.height ?? window.innerHeight;
      const activeField =
        document.activeElement instanceof HTMLElement &&
        document.activeElement.matches(
          'textarea, input[type="text"], input[type="search"], input[type="email"], input:not([type])',
        )
          ? document.activeElement
          : null;
      const keyboardOpen =
        window.innerWidth <= 767 &&
        (Boolean(activeField) ||
          (Boolean(visibleViewport) &&
            window.innerHeight - height > Math.max(120, window.innerHeight * 0.18)));

      modal.style.setProperty("--contest-notebook-viewport-top", `${top}px`);
      modal.style.setProperty("--contest-notebook-viewport-left", `${left}px`);
      modal.style.setProperty("--contest-notebook-viewport-width", `${width}px`);
      modal.style.setProperty("--contest-notebook-viewport-height", `${height}px`);
      modal.dataset.keyboardOpen = keyboardOpen ? "true" : "false";

      if (keyboardOpen && activeField) {
        if (focusedFieldScrollTimer !== null) {
          window.clearTimeout(focusedFieldScrollTimer);
        }
        focusedFieldScrollTimer = window.setTimeout(() => {
          if (
            document.activeElement instanceof HTMLElement &&
            document.activeElement.matches(
              'textarea, input[type="text"], input[type="search"], input[type="email"], input:not([type])',
            )
          ) {
            document.activeElement.scrollIntoView({ block: "center", behavior: "smooth" });
          }
        }, 80);
      }
    };

    syncVisibleViewport();

    const visibleViewport = window.visualViewport;
    visibleViewport?.addEventListener("resize", syncVisibleViewport);
    visibleViewport?.addEventListener("scroll", syncVisibleViewport);
    modal.addEventListener("focusin", syncVisibleViewport);
    modal.addEventListener("focusout", syncVisibleViewport);
    window.addEventListener("resize", syncVisibleViewport);
    window.addEventListener("orientationchange", syncVisibleViewport);

    return () => {
      if (focusedFieldScrollTimer !== null) {
        window.clearTimeout(focusedFieldScrollTimer);
      }
      delete modal.dataset.keyboardOpen;
      visibleViewport?.removeEventListener("resize", syncVisibleViewport);
      visibleViewport?.removeEventListener("scroll", syncVisibleViewport);
      modal.removeEventListener("focusin", syncVisibleViewport);
      modal.removeEventListener("focusout", syncVisibleViewport);
      window.removeEventListener("resize", syncVisibleViewport);
      window.removeEventListener("orientationchange", syncVisibleViewport);
    };
  }, [cover, isCoverOpen]);

  useEffect(() => {
    const button = coverButtonRef.current;
    if (!button || !cover) {
      return;
    }

    const handleClick = () => {
      openCover();
    };

    const handleTouchStart = (event: globalThis.TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) {
        return;
      }

      coverDragRef.current = {
        x: touch.clientX,
        y: touch.clientY,
      };
    };

    const handleTouchMove = (event: globalThis.TouchEvent) => {
      const start = coverDragRef.current;
      const touch = event.touches[0];
      if (!start || !touch) {
        return;
      }

      const deltaX = start.x - touch.clientX;
      const deltaY = start.y - touch.clientY;
      if (Math.abs(deltaX) > Math.abs(deltaY) + 6) {
        event.preventDefault();
      }
    };

    const handleTouchEnd = (event: globalThis.TouchEvent) => {
      const start = coverDragRef.current;
      const touch = event.changedTouches[0];
      coverDragRef.current = null;
      if (!start || !touch) {
        return;
      }

      const deltaX = start.x - touch.clientX;
      const deltaY = start.y - touch.clientY;
      if (deltaX > 44 && Math.abs(deltaX) > Math.abs(deltaY) + 12) {
        openCover();
      }
    };

    button.addEventListener("click", handleClick);
    button.addEventListener("touchstart", handleTouchStart, { passive: true });
    button.addEventListener("touchmove", handleTouchMove, { passive: false });
    button.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      button.removeEventListener("click", handleClick);
      button.removeEventListener("touchstart", handleTouchStart);
      button.removeEventListener("touchmove", handleTouchMove);
      button.removeEventListener("touchend", handleTouchEnd);
    };
  }, [cover, openCover]);

  useEffect(() => {
    const button = closeButtonRef.current;
    if (!button || !cover) {
      return;
    }

    const handleClose = () => {
      closeCover();
    };

    button.addEventListener("click", handleClose);
    button.addEventListener("touchend", handleClose);

    return () => {
      button.removeEventListener("click", handleClose);
      button.removeEventListener("touchend", handleClose);
    };
  }, [closeCover, cover]);

  const goToPage = (nextPage: 0 | 1) => {
    if (!isCoverOpen) {
      openCover();
      return;
    }

    if (nextPage === currentPage) {
      return;
    }

    setTurnDirection(nextPage > currentPage ? "next" : "previous");
    setPage(nextPage);
    finishTurnAnimation();
  };

  const handleTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    dragRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  };

  const handleTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    const touch = event.touches[0];
    if (!start || !touch) {
      return;
    }

    const deltaX = start.x - touch.clientX;
    const deltaY = start.y - touch.clientY;
    if (Math.abs(deltaX) <= Math.abs(deltaY) + 6) {
      return;
    }

    event.preventDefault();
  };

  const handleTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = dragRef.current;
    const touch = event.changedTouches[0];
    if (!start || !touch) {
      dragRef.current = null;
      return;
    }

    dragRef.current = null;
    const deltaX = start.x - touch.clientX;
    const deltaY = start.y - touch.clientY;
    if (Math.abs(deltaX) <= Math.abs(deltaY) + 12 || Math.abs(deltaX) < 44) {
      return;
    }

    goToPage(deltaX > 0 ? 1 : 0);
  };

  const handleCoverTouchStart = (event: ReactTouchEvent<HTMLButtonElement>) => {
    const touch = event.touches[0];
    if (!touch) {
      return;
    }

    coverDragRef.current = {
      x: touch.clientX,
      y: touch.clientY,
    };
  };

  const handleCoverTouchMove = (event: ReactTouchEvent<HTMLButtonElement>) => {
    const start = coverDragRef.current;
    const touch = event.touches[0];
    if (!start || !touch) {
      return;
    }

    const deltaX = start.x - touch.clientX;
    const deltaY = start.y - touch.clientY;
    if (Math.abs(deltaX) > Math.abs(deltaY) + 6) {
      event.preventDefault();
    }
  };

  const handleCoverTouchEnd = (event: ReactTouchEvent<HTMLButtonElement>) => {
    const start = coverDragRef.current;
    const touch = event.changedTouches[0];
    coverDragRef.current = null;
    if (!start || !touch) {
      return;
    }

    const deltaX = start.x - touch.clientX;
    const deltaY = start.y - touch.clientY;
    if (deltaX > 44 && Math.abs(deltaX) > Math.abs(deltaY) + 12) {
      openCover();
    }
  };

  const notebookInterior = (
    <>
        {cover ? (
          <button
            ref={closeButtonRef}
            type="button"
            className="contest-notebook-close-button"
            onPointerDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              closeCover();
            }}
            onMouseDown={(event) => {
              event.preventDefault();
              event.stopPropagation();
              closeCover();
            }}
            onTouchStart={(event) => {
              event.preventDefault();
              event.stopPropagation();
              closeCover();
            }}
            onClick={(event) => {
              event.preventDefault();
              event.stopPropagation();
              closeCover();
            }}
            aria-label="Fermer le carnet"
            style={{ zIndex: 1000, pointerEvents: "auto" }}
          >
            <X aria-hidden="true" size={22} />
          </button>
        ) : null}

        {mobileToolbar ? (
          <div className="contest-notebook-mobile-toolbar">{mobileToolbar}</div>
        ) : null}

        <div className="contest-notebook-flip-viewport">
          <div
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className="contest-notebook-spread contest-notebook-spread-flip"
            data-has-spread-overlay={spreadOverlay ? "true" : "false"}
          >
            <div className="contest-notebook-fold" aria-hidden="true" />
            <div className="contest-notebook-page-track">
              <div className={`contest-notebook-page contest-notebook-page-left ${leftPageClassName ?? ""}`}>
                <div className="contest-inner-frame" aria-hidden="true" />
                <div className="contest-page-corner contest-page-corner-left" aria-hidden="true" />
                <div
                  ref={leftInnerRef}
                  {...leftInnerRest}
                  className={`contest-notebook-page-inner space-y-4 ${leftInnerClassName ?? ""}`}
                >
                  {left}
                </div>
              </div>
              <div className={`contest-notebook-page contest-notebook-page-right ${rightPageClassName ?? ""}`}>
                <div className="contest-inner-frame" aria-hidden="true" />
                <div className="contest-page-corner contest-page-corner-right" aria-hidden="true" />
                <div
                  ref={rightInnerRef}
                  {...rightInnerRest}
                  className={`contest-notebook-page-inner space-y-4 ${rightInnerClassName ?? ""}`}
                >
                  {right}
                </div>
              </div>
            </div>
            {spreadOverlay ? <div className="contest-notebook-spread-overlay">{spreadOverlay}</div> : null}
            <div className="contest-notebook-turn-sheet" aria-hidden="true" />
          </div>
        </div>

        {sideTabs ? <div className="contest-notebook-bookmarks">{sideTabs}</div> : null}

        <div className="contest-notebook-flip-controls" aria-label={labels?.pageLabel ?? "Pages du carnet"}>
          <button
            type="button"
            onClick={() => goToPage(0)}
            disabled={currentPage === 0}
            className="contest-notebook-flip-button"
            aria-label={labels?.previous ?? "Voir la page de gauche"}
          >
            <ChevronLeft aria-hidden="true" size={18} />
            <span>{labels?.previous ?? "Gauche"}</span>
          </button>
          <span className="contest-notebook-flip-count">{currentPage + 1} / 2</span>
          <button
            type="button"
            onClick={() => goToPage(1)}
            disabled={currentPage === 1}
            className="contest-notebook-flip-button"
            aria-label={labels?.next ?? "Voir la page de droite"}
          >
            <span>{labels?.next ?? "Droite"}</span>
            <ChevronRight aria-hidden="true" size={18} />
          </button>
        </div>
    </>
  );

  const modalProps = {
    className: `contest-notebook-modal contest-notebook-flipbook ${variantClassName}`,
    "data-active-page": currentPage,
    "data-cover-open": isCoverOpen ? "true" : "false",
    "data-has-cover": cover ? "true" : "false",
    "data-has-spread-overlay": spreadOverlay ? "true" : "false",
    "data-has-side-tabs": hasSideTabs ? "true" : "false",
    "data-turning": turnDirection ?? undefined,
    "data-notebook-variant": variant,
    "data-notebook-tone": tone,
    "aria-label": labels?.pageLabel ?? "Carnet concours",
  };

  return (
    <div
      className={`contest-notebook-flipbook ${variantClassName} ${className ?? ""}`}
      data-active-page={currentPage}
      data-cover-open={isCoverOpen ? "true" : "false"}
      data-has-cover={cover ? "true" : "false"}
      data-has-spread-overlay={spreadOverlay ? "true" : "false"}
      data-has-side-tabs={hasSideTabs ? "true" : "false"}
      data-turning={turnDirection ?? undefined}
      data-notebook-variant={variant}
      data-notebook-tone={tone}
    >
      {cover ? (
        <button
          ref={coverButtonRef}
          type="button"
          className="contest-notebook-cover-button"
          onClick={openCover}
          onTouchStart={handleCoverTouchStart}
          onTouchMove={handleCoverTouchMove}
          onTouchEnd={handleCoverTouchEnd}
          aria-label={labels?.pageLabel ?? "Ouvrir le carnet"}
        >
          {cover}
        </button>
      ) : null}

      {cover ? (
        <dialog
          ref={dialogRef}
          {...modalProps}
          onCancel={(event) => {
            event.preventDefault();
            closeCover();
          }}
          onClose={() => {
            if (coverOpenRef.current) {
              closeCover();
            }
          }}
        >
          {notebookInterior}
          {dialogOverlay}
        </dialog>
      ) : (
        <div {...modalProps}>
          {notebookInterior}
          {dialogOverlay}
        </div>
      )}
    </div>
  );
}
