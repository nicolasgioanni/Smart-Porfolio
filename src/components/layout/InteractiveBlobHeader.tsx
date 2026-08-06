"use client";

import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PortfolioLink } from "@/content/types";
import { MainNavigation } from "@/components/navigation/MainNavigation";
import { MobileNavigation } from "@/components/navigation/MobileNavigation";
import type { NavigationItem } from "@/components/navigation/navigationItems";
import { SocialLinkGroup } from "@/components/navigation/SocialLinkGroup";
import { ProfileImagePreview } from "@/components/layout/ProfileImagePreview";
import { ThemeSwitcher } from "@/components/theme/ThemeSwitcher";
import type { ThemeName } from "@/lib/theme/resolveThemeName";

const compactScrollThreshold = 72;
const topProximityPixels = 128;
const scrollDirectionThreshold = 4;

type HeaderScrollIntent = "expanded" | "compact";

export type HeaderBrand = {
  initial: string;
  markImageSrc?: string;
  name: string;
};

type InteractiveBlobHeaderProps = {
  brand: HeaderBrand;
  initialTheme: ThemeName;
  navigationItems: NavigationItem[];
  primaryLinks: PortfolioLink[];
};

export function InteractiveBlobHeader({ brand, initialTheme, navigationItems, primaryLinks }: InteractiveBlobHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [pointerNearHeader, setPointerNearHeaderState] = useState(false);
  const [profilePreviewOpen, setProfilePreviewOpen] = useState(false);
  const [scrollIntent, setScrollIntentState] = useState<HeaderScrollIntent>("expanded");
  const [themeMenuHeaderState, setThemeMenuHeaderState] = useState<HeaderScrollIntent>();
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const markClassName = ["site-brand__mark", brand.markImageSrc ? "site-brand__mark--image" : null].filter(Boolean).join(" ");
  const profileImageAlt = `${brand.name} profile photo`;
  const finePointerRef = useRef(true);
  const lastScrollYRef = useRef(0);
  const mobileMenuOpenRef = useRef(false);
  const pointerNearHeaderRef = useRef(false);
  const scrollIntentRef = useRef<HeaderScrollIntent>("expanded");
  const themeMenuOpenRef = useRef(false);
  const headerVisualStateRef = useRef<HeaderScrollIntent>("expanded");
  const naturallyCompactHeader = scrollIntent === "compact" && !pointerNearHeader && !mobileMenuOpen;
  const compactHeader = themeMenuOpen && themeMenuHeaderState ? themeMenuHeaderState === "compact" : naturallyCompactHeader;
  headerVisualStateRef.current = compactHeader ? "compact" : "expanded";

  const setScrollIntent = useCallback((nextIntent: HeaderScrollIntent) => {
    if (scrollIntentRef.current === nextIntent) return;

    scrollIntentRef.current = nextIntent;
    setScrollIntentState(nextIntent);
  }, []);

  const setPointerNearHeader = useCallback((nextPointerNearHeader: boolean) => {
    if (pointerNearHeaderRef.current === nextPointerNearHeader) return;

    pointerNearHeaderRef.current = nextPointerNearHeader;
    setPointerNearHeaderState(nextPointerNearHeader);
  }, []);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(hover: hover) and (pointer: fine)");

    function updatePointerMode() {
      finePointerRef.current = mediaQuery ? mediaQuery.matches : true;
    }

    updatePointerMode();
    mediaQuery?.addEventListener?.("change", updatePointerMode);
    mediaQuery?.addListener?.(updatePointerMode);

    return () => {
      mediaQuery?.removeEventListener?.("change", updatePointerMode);
      mediaQuery?.removeListener?.(updatePointerMode);
    };
  }, []);

  useEffect(() => {
    lastScrollYRef.current = window.scrollY;

    function handleScroll() {
      const nextScrollY = window.scrollY;
      const scrollDelta = nextScrollY - lastScrollYRef.current;

      if (themeMenuOpenRef.current) {
        lastScrollYRef.current = nextScrollY;
        return;
      }

      if (mobileMenuOpenRef.current || nextScrollY <= compactScrollThreshold) {
        setScrollIntent("expanded");
      } else if (scrollDelta < -scrollDirectionThreshold) {
        setScrollIntent("expanded");
      } else if (scrollDelta > scrollDirectionThreshold && nextScrollY > compactScrollThreshold) {
        setScrollIntent("compact");
      }

      lastScrollYRef.current = nextScrollY;
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => window.removeEventListener("scroll", handleScroll);
  }, [setScrollIntent]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      if (!finePointerRef.current) return;

      const pointerInProximityZone = event.clientY <= topProximityPixels;
      setPointerNearHeader(pointerInProximityZone);
    }

    window.addEventListener("pointermove", handlePointerMove);

    return () => window.removeEventListener("pointermove", handlePointerMove);
  }, [setPointerNearHeader]);

  function expandHeaderFromFocus() {
    setScrollIntent("expanded");
  }

  function revealHeaderFromPointer() {
    if (!finePointerRef.current) return;

    setPointerNearHeader(true);
  }

  function compactHeaderWhenAway(event?: ReactPointerEvent<HTMLElement>) {
    if (!finePointerRef.current) return;

    const pointerStillNearHeader = typeof event?.clientY === "number" && event.clientY <= topProximityPixels;
    setPointerNearHeader(pointerStillNearHeader);
  }

  const handleMobileMenuOpenChange = useCallback((open: boolean) => {
    mobileMenuOpenRef.current = open;
    setMobileMenuOpen(open);

    if (open) {
      themeMenuOpenRef.current = false;
      setThemeMenuHeaderState(undefined);
      setThemeMenuOpen(false);
      setScrollIntent("expanded");
    }
  }, [setScrollIntent]);

  const handleThemeMenuOpenChange = useCallback((open: boolean) => {
    themeMenuOpenRef.current = open;
    setThemeMenuHeaderState(open ? headerVisualStateRef.current : undefined);
    setThemeMenuOpen(open);

    if (open) {
      mobileMenuOpenRef.current = false;
      setMobileMenuOpen(false);
    }
  }, []);

  function openProfilePreview() {
    if (brand.markImageSrc) {
      setProfilePreviewOpen(true);
    }
  }

  function closeProfilePreview() {
    setProfilePreviewOpen(false);
  }

  return (
    <>
      <header
        className={["blob-header", compactHeader ? "blob-header--compact" : null].filter(Boolean).join(" ")}
        data-header-state={compactHeader ? "compact" : "expanded"}
        onFocusCapture={expandHeaderFromFocus}
        onPointerEnter={revealHeaderFromPointer}
        onPointerLeave={compactHeaderWhenAway}
      >
        <div className="glass-blob glass-blob--nav blob-header__island">
          <div className="site-brand">
            {brand.markImageSrc ? (
              <button
                aria-label={`View ${profileImageAlt}`}
                className={`${markClassName} hover-base-1 hover-base-1--compact hover-base-1--solid hover-base-1--no-wave`}
                onClick={openProfilePreview}
                type="button"
              >
                <img alt="" className="site-brand__mark-image" src={brand.markImageSrc} />
              </button>
            ) : (
              <span className={markClassName} aria-hidden="true">
                {brand.initial}
              </span>
            )}
            <span className="site-brand__text">
              <span className="site-brand__name">{brand.name}</span>
            </span>
          </div>
          <MainNavigation items={navigationItems} />
          <div className="blob-header__actions">
            <SocialLinkGroup compact links={primaryLinks.slice(0, 4)} />
            <ThemeSwitcher initialTheme={initialTheme} onOpenChange={handleThemeMenuOpenChange} open={themeMenuOpen} />
            <MobileNavigation
              items={navigationItems}
              links={primaryLinks}
              onOpenChange={handleMobileMenuOpenChange}
              open={mobileMenuOpen}
            />
          </div>
        </div>
      </header>
      {brand.markImageSrc ? <ProfileImagePreview alt={profileImageAlt} imageSrc={brand.markImageSrc} onClose={closeProfilePreview} open={profilePreviewOpen} /> : null}
    </>
  );
}
