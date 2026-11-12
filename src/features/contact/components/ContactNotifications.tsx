"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { GlassIconButton } from "@/components/glass/GlassIconButton";
import { useMediaQuery } from "@/components/responsive/useMediaQuery";
import type { ContactNotification } from "./useContactNotifications";

const lifetimeMs = 30_000;
const exitDurationMs = 200;
type Countdown = { revision: number; remaining: number; started?: number };

export function ContactNotifications({ notifications, announcement, onDismiss, onRestoreFocus }: {
  notifications: ContactNotification[];
  announcement?: ContactNotification;
  onDismiss: (id: number, revision: number) => void;
  onRestoreFocus: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [heights, setHeights] = useState<Record<number, number>>({});
  const [exiting, setExiting] = useState<Record<number, number>>({});
  const rootRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const countdowns = useRef(new Map<number, Countdown>());
  const exitTimers = useRef(new Map<number, number>());
  const lastOutsideFocus = useRef<HTMLElement | null>(null);
  const focusedCard = useRef<number | undefined>(undefined);
  const pendingFocusRestore = useRef(false);
  const expandedBeforePointer = useRef<boolean | undefined>(undefined);
  const restoreFocusRef = useRef(onRestoreFocus);
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const expanded = notifications.length > 1 && !collapsed && (hovered || focused || pinned);
  const paused = hovered || focused || pinned || hidden;

  useEffect(() => { restoreFocusRef.current = onRestoreFocus; }, [onRestoreFocus]);

  const restoreFocus = useCallback(() => {
    const next = rootRef.current?.querySelector<HTMLButtonElement>(
      '.contact-notifications__item:not([inert]):not([data-exiting="true"]) .contact-notice__close'
    );
    if (next) next.focus({ preventScroll: true });
    else if (lastOutsideFocus.current?.isConnected && lastOutsideFocus.current !== document.body) {
      lastOutsideFocus.current.focus({ preventScroll: true });
    } else restoreFocusRef.current();
  }, []);

  const dismiss = useCallback((item: ContactNotification) => {
    const card = rootRef.current?.querySelector(`[data-notification-id="${item.id}"]`);
    if (card?.contains(document.activeElement)) pendingFocusRestore.current = true;
    const previous = exitTimers.current.get(item.id);
    if (previous !== undefined) window.clearTimeout(previous);
    setExiting((current) => ({ ...current, [item.id]: item.revision }));
    const finish = () => {
      exitTimers.current.delete(item.id);
      onDismiss(item.id, item.revision);
      setExiting((current) => {
        const next = { ...current };
        if (next[item.id] === item.revision) delete next[item.id];
        return next;
      });
    };
    if (reducedMotion) finish();
    else exitTimers.current.set(item.id, window.setTimeout(finish, exitDurationMs));
  }, [onDismiss, reducedMotion]);

  useEffect(() => {
    setMounted(true);
    lastOutsideFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const onFocus = (event: FocusEvent) => {
      if (event.target instanceof HTMLElement && !rootRef.current?.contains(event.target)) {
        lastOutsideFocus.current = event.target;
      }
    };
    const onVisibility = () => setHidden(document.hidden);
    onVisibility();
    document.addEventListener("focusin", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    const timers = exitTimers.current;
    return () => {
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useLayoutEffect(() => {
    if (!mounted) return;
    const measure = () => {
      const next: Record<number, number> = {};
      rootRef.current?.querySelectorAll<HTMLElement>(".contact-notice").forEach((card) => {
        next[Number(card.dataset.notificationId)] = card.offsetHeight;
      });
      setHeights((current) => JSON.stringify(current) === JSON.stringify(next) ? current : next);
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    rootRef.current?.querySelectorAll(".contact-notice").forEach((card) => observer.observe(card));
    return () => observer.disconnect();
  }, [mounted, notifications]);

  useLayoutEffect(() => {
    if (pendingFocusRestore.current || (focusedCard.current !== undefined && !notifications.some((item) => item.id === focusedCard.current))) {
      pendingFocusRestore.current = false;
      focusedCard.current = undefined;
      restoreFocus();
    }
    if (notifications.length === 0) {
      setHovered(false);
      setFocused(false);
      setPinned(false);
      setCollapsed(false);
    }
  }, [notifications, exiting, restoreFocus]);

  useEffect(() => {
    const now = performance.now();
    const entries = countdowns.current;
    const activeIds = new Set(notifications.map((item) => item.id));
    for (const id of countdowns.current.keys()) if (!activeIds.has(id)) countdowns.current.delete(id);
    for (const item of notifications) {
      if (countdowns.current.get(item.id)?.revision !== item.revision) {
        countdowns.current.set(item.id, { revision: item.revision, remaining: lifetimeMs });
      }
    }
    if (paused) return;
    const running = notifications.filter((item) => exiting[item.id] !== item.revision);
    for (const item of running) countdowns.current.get(item.id)!.started = now;
    const timer = running.length ? window.setTimeout(() => {
      const elapsed = performance.now() - now;
      for (const item of running) {
        if (countdowns.current.get(item.id)!.remaining <= elapsed) dismiss(item);
      }
    }, Math.max(0, Math.min(...running.map((item) => countdowns.current.get(item.id)!.remaining)))) : undefined;
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
      const end = performance.now();
      for (const item of running) {
        const entry = entries.get(item.id);
        if (entry?.started !== undefined) {
          entry.remaining = Math.max(0, entry.remaining - (end - entry.started));
          entry.started = undefined;
        }
      }
    };
  }, [notifications, paused, exiting, dismiss]);

  const collapse = useCallback(() => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && active.closest('.contact-notifications__item[data-index]:not([data-index="0"])')) {
      toggleRef.current?.focus({ preventScroll: true });
      focusedCard.current = undefined;
    }
    setPinned(false);
    setCollapsed(true);
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) collapse();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [expanded, collapse]);

  if (!mounted) return null;
  const firstHeight = heights[notifications[0]?.id] ?? 0;
  let offset = 0;
  const positions = notifications.map((item, index) => {
    const height = heights[item.id] ?? firstHeight;
    const top = expanded ? offset : firstHeight - height + index * 10;
    offset += height + 12;
    return { top, scale: expanded ? 1 : 1 - index * 0.02 };
  });
  const stageHeight = expanded ? Math.max(0, offset - 12) : firstHeight + Math.max(0, notifications.length - 1) * 10;

  return createPortal(<>
    <div aria-atomic="true" aria-live="assertive" className="visually-hidden" role={announcement?.tone === "error" ? "alert" : undefined}>
      {announcement?.tone === "error" ? <span key={announcement.revision}>{announcement.title}. {announcement.message}</span> : null}
    </div>
    <div aria-atomic="true" aria-live="polite" className="visually-hidden" role={announcement?.tone === "success" ? "status" : undefined}>
      {announcement?.tone === "success" ? <span key={announcement.revision}>{announcement.title}. {announcement.message}</span> : null}
    </div>
    {notifications.length ? <div
      aria-label="Contact notifications"
      className="contact-notifications"
      data-expanded={expanded}
      ref={rootRef}
      role="region"
      onPointerEnter={(event) => { if (event.pointerType === "mouse") { setHovered(true); setCollapsed(false); } }}
      onPointerLeave={(event) => { if (event.pointerType === "mouse") setHovered(false); }}
      onFocusCapture={(event) => {
        setFocused(true);
        const card = (event.target as HTMLElement).closest<HTMLElement>("[data-notification-id]");
        focusedCard.current = card ? Number(card.dataset.notificationId) : undefined;
        if (!event.currentTarget.contains(event.relatedTarget)) setCollapsed(false);
      }}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) { setFocused(false); focusedCard.current = undefined; }
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape" && expanded) { event.stopPropagation(); collapse(); }
      }}
    >
      <div className="contact-notifications__stage" style={{ height: stageHeight || undefined }}
        onClick={(event) => {
          // Inert older cards expose only their peeking surface to pointer users.
          if (!expanded && event.target === event.currentTarget) { setCollapsed(false); setPinned(true); }
        }}>
        {notifications.map((item, index) => {
          const isExiting = exiting[item.id] === item.revision;
          const concealed = !expanded && index > 0;
          return <div
            aria-hidden={concealed || isExiting || undefined}
            className="contact-notifications__item"
            data-exiting={isExiting}
            data-index={index}
            inert={concealed || isExiting}
            key={item.id}
            style={{ "--notice-top": `${positions[index].top}px`, "--notice-scale": positions[index].scale, zIndex: 3 - index } as CSSProperties}
          >
            <div className="contact-notice" data-notification-id={item.id} data-tone={item.tone}>
              <span aria-hidden="true" className="contact-notice__icon">{item.tone === "error" ? "!" : "✓"}</span>
              <div className="contact-notice__content" tabIndex={0} role="group" aria-label={`${item.title} message`}>
                <strong className="contact-notice__label">{item.title}</strong>
                <p>{item.message}</p>
              </div>
              <GlassIconButton className="contact-notice__close" label={`Dismiss notification: ${item.title}`} onClick={() => dismiss(item)}>
                <svg aria-hidden="true" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              </GlassIconButton>
            </div>
          </div>;
        })}
      </div>
      {notifications.length > 1 ? <button
        aria-expanded={expanded}
        className="contact-notifications__toggle hover-base-1"
        ref={toggleRef}
        type="button"
        onPointerDown={() => { expandedBeforePointer.current = expanded; }}
        onClick={() => {
          const wasExpanded = expandedBeforePointer.current ?? expanded;
          expandedBeforePointer.current = undefined;
          if (wasExpanded) collapse(); else { setCollapsed(false); setPinned(true); }
        }}
      >{expanded ? "Collapse notifications" : `Show all ${notifications.length} notifications`}</button> : null}
    </div> : null}
  </>, document.body);
}
