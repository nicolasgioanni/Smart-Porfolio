"use client";

import type { FocusEvent, RefObject } from "react";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { MOBILE_UI_QUERY, useMediaQuery } from "@/components/responsive/useMediaQuery";

export type OpenDetailDisclosure = {
  itemId: string;
  sectionId: string;
};

function isCurrentDetail(
  current: OpenDetailDisclosure | null,
  expected: OpenDetailDisclosure
): boolean {
  return current?.itemId === expected.itemId && current.sectionId === expected.sectionId;
}

function getTargetElement(target: EventTarget | null): Element | null {
  if (target instanceof Element) return target;
  return target instanceof Node ? target.parentElement : null;
}

function hasTextSelection(): boolean {
  const selection = window.getSelection();
  return selection?.type === "Range" && selection.toString().trim().length > 0;
}

function isInteractiveTarget(target: Element): boolean {
  return Boolean(
    target.closest(
      'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [role="button"], [role="link"]'
    )
  );
}

/**
 * Shares one selected detail row across a route while keeping the route's
 * server-rendered summaries independent from client-only overlay behavior.
 */
export function useDetailDisclosure(rootRef: RefObject<HTMLElement | null>) {
  const usesNaturalFlow = useMediaQuery(MOBILE_UI_QUERY);
  const [openDetail, setOpenDetail] = useState<OpenDetailDisclosure | null>(null);
  const openDetailRef = useRef(openDetail);

  useEffect(() => {
    openDetailRef.current = openDetail;
  }, [openDetail]);

  useLayoutEffect(() => {
    setOpenDetail(null);
  }, [usesNaturalFlow]);

  const toggle = useCallback((itemId: string, sectionId: string) => {
    const nextDetail = { itemId, sectionId };

    setOpenDetail((current) => (isCurrentDetail(current, nextDetail) ? null : nextDetail));
  }, []);

  const close = useCallback((expected?: OpenDetailDisclosure) => {
    setOpenDetail((current) => {
      if (expected && !isCurrentDetail(current, expected)) return current;
      return null;
    });
  }, []);

  useEffect(() => {
    if (!openDetail) return;

    const activeDetail = openDetail;
    const handleDocumentClick = (event: MouseEvent) => {
      const target = getTargetElement(event.target);
      const activePanel = rootRef.current?.querySelector<HTMLElement>('.detail-section[data-open="true"] .detail-section__panel');

      if (!target) return;
      if (target.closest(".detail-section__trigger")) return;
      if (activePanel?.contains(target) && (hasTextSelection() || isInteractiveTarget(target))) return;

      close(activeDetail);
    };

    const handleDocumentFocusIn = (event: globalThis.FocusEvent) => {
      if (usesNaturalFlow) return;

      const target = getTargetElement(event.target);
      const activeSection = rootRef.current?.querySelector<HTMLElement>('.detail-section[data-open="true"]');
      if (!target || !activeSection?.contains(target)) close(activeDetail);
    };

    const handleDocumentKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;

      queueMicrotask(() => {
        if (event.defaultPrevented || !isCurrentDetail(openDetailRef.current, activeDetail)) return;

        const activeTrigger = rootRef.current?.querySelector<HTMLButtonElement>(
          '.detail-section[data-open="true"] .detail-section__trigger'
        );
        close(activeDetail);
        activeTrigger?.focus();
      });
    };

    document.addEventListener("click", handleDocumentClick);
    document.addEventListener("focusin", handleDocumentFocusIn);
    document.addEventListener("keydown", handleDocumentKeyDown);
    return () => {
      document.removeEventListener("click", handleDocumentClick);
      document.removeEventListener("focusin", handleDocumentFocusIn);
      document.removeEventListener("keydown", handleDocumentKeyDown);
    };
  }, [close, openDetail, rootRef, usesNaturalFlow]);

  const onFocusCapture = useCallback(
    (event: FocusEvent<HTMLElement>) => {
      const activeDetail = openDetailRef.current;
      if (usesNaturalFlow || !activeDetail) return;

      const target = getTargetElement(event.target);
      const activeSection = rootRef.current?.querySelector<HTMLElement>('.detail-section[data-open="true"]');

      if (!target || !activeSection?.contains(target)) {
        close(activeDetail);
      }
    },
    [close, rootRef, usesNaturalFlow]
  );

  return {
    close,
    onFocusCapture,
    openDetail,
    toggle,
    usesNaturalFlow
  };
}
