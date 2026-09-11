import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ThemeSwitcher,
  themeMenuCloseDelayMs,
  themeMenuPortalViewportGutterPx
} from "@/components/theme/ThemeSwitcher";
import { systemThemeMediaQuery, themeStorageKey } from "@/lib/theme/themePreference";

type MediaQueryChangeListener = (event: MediaQueryListEvent) => void;

function setMediaPreferences({ finePointer = true, legacySystem = false, systemDark = false } = {}) {
  let prefersDark = systemDark;
  const systemListeners = new Set<MediaQueryChangeListener>();
  const addSystemEventListener = vi.fn((eventName: string, listener: MediaQueryChangeListener) => {
    if (eventName === "change") systemListeners.add(listener);
  });
  const removeSystemEventListener = vi.fn((eventName: string, listener: MediaQueryChangeListener) => {
    if (eventName === "change") systemListeners.delete(listener);
  });
  const systemQuery = {
    addEventListener: legacySystem ? undefined : addSystemEventListener,
    addListener: vi.fn((listener: MediaQueryChangeListener) => systemListeners.add(listener)),
    dispatchEvent: vi.fn(),
    get matches() {
      return prefersDark;
    },
    media: systemThemeMediaQuery,
    onchange: null,
    removeEventListener: legacySystem ? undefined : removeSystemEventListener,
    removeListener: vi.fn((listener: MediaQueryChangeListener) => systemListeners.delete(listener))
  } as unknown as MediaQueryList;
  const pointerQuery = {
    addEventListener: vi.fn(),
    addListener: vi.fn(),
    dispatchEvent: vi.fn(),
    matches: finePointer,
    media: "(hover: hover) and (pointer: fine)",
    onchange: null,
    removeEventListener: vi.fn(),
    removeListener: vi.fn()
  } as unknown as MediaQueryList;

  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    value: vi.fn((query: string) => (query === systemThemeMediaQuery ? systemQuery : pointerQuery))
  });

  return {
    setSystemDark(nextValue: boolean) {
      prefersDark = nextValue;
      const event = { matches: nextValue, media: systemThemeMediaQuery } as MediaQueryListEvent;
      systemListeners.forEach((listener) => listener.call(systemQuery, event));
    },
    systemQuery
  };
}

function setFinePointer(matches: boolean) {
  return setMediaPreferences({ finePointer: matches });
}

describe("ThemeSwitcher", () => {
  beforeEach(() => {
    setFinePointer(true);
    window.localStorage.clear();
    document.documentElement.dataset.theme = "navy";
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    window.localStorage.clear();
    delete document.documentElement.dataset.theme;
  });

  it("renders a compact icon disclosure and keeps closed options out of the tab order", () => {
    const { container } = render(<ThemeSwitcher initialTheme="navy" />);
    const trigger = screen.getByRole("button", { name: /choose color theme/i });
    const popover = container.querySelector(".theme-switcher__popover");
    const options = container.querySelectorAll<HTMLButtonElement>(".theme-switcher__option");

    expect(trigger).toHaveClass("glass-icon-button", "hover-base-1", "hover-base-1--compact");
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveAttribute("aria-controls", popover?.id);
    expect(popover?.parentElement).toHaveClass("theme-switcher");
    expect(popover).not.toHaveClass("theme-switcher__popover--portal");
    expect(popover).toHaveAttribute("aria-hidden", "true");
    expect(popover).toHaveAttribute("data-state", "closed");
    expect(options).toHaveLength(4);
    options.forEach((option) => expect(option).toHaveAttribute("tabindex", "-1"));
    expect(container.querySelector(".theme-switcher__trigger svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("opens in the requested order and changes theme without dismissing the panel", () => {
    window.localStorage.setItem(themeStorageKey, "navy");
    render(<ThemeSwitcher initialTheme="navy" />);
    const trigger = screen.getByRole("button", { name: /choose color theme/i });

    fireEvent.click(trigger);

    const group = screen.getByRole("group", { name: "Color theme preference" });
    const options = within(group).getAllByRole("button");
    expect(options.map((option) => option.textContent)).toEqual(["SystemAuto", "Light", "My mode", "Dark"]);
    options.forEach((option) => expect(option).toHaveClass("hover-base-1", "hover-base-1--compact", "hover-base-1--inline"));
    expect(within(group).getByRole("button", { name: "My mode" })).toHaveAttribute("aria-pressed", "true");
    expect(trigger).toHaveAccessibleName("Choose color theme. Current setting: My mode");

    fireEvent.click(within(group).getByRole("button", { name: "Light" }));

    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(themeStorageKey)).toBe("light");
    expect(within(group).getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("group", { name: "Color theme preference" })).toBeInTheDocument();

    fireEvent.click(within(group).getByRole("button", { name: "My mode" }));

    expect(document.documentElement.dataset.theme).toBe("navy");
    expect(window.localStorage.getItem(themeStorageKey)).toBe("navy");
    expect(within(group).getByRole("button", { name: "My mode" })).toHaveAttribute("aria-pressed", "true");
    expect(trigger).toHaveAccessibleName("Choose color theme. Current setting: My mode");
  });

  it("restores a valid stored preference after hydration", async () => {
    window.localStorage.setItem(themeStorageKey, "light");
    render(<ThemeSwitcher initialTheme="navy" />);
    fireEvent.click(screen.getByRole("button", { name: /choose color theme/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "true");
      expect(document.documentElement.dataset.theme).toBe("light");
    });
  });

  it("uses the system preference by default and follows live light and dark changes", () => {
    const media = setMediaPreferences({ systemDark: false });
    render(<ThemeSwitcher initialTheme="navy" />);
    fireEvent.click(screen.getByRole("button", { name: /choose color theme/i }));

    const systemOption = screen.getByRole("button", { name: /system, follows device setting; currently light/i });
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(systemOption).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Light" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /choose color theme/i })).toHaveAccessibleName(
      "Choose color theme. Current setting: System; using Light"
    );

    act(() => media.setSystemDark(true));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: /system, follows device setting; currently dark/i })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByRole("button", { name: /choose color theme/i })).toHaveAccessibleName(
      "Choose color theme. Current setting: System; using Dark"
    );
  });

  it("keeps a manual choice stable across system changes", () => {
    const media = setMediaPreferences({ systemDark: false });
    render(<ThemeSwitcher initialTheme="navy" />);
    fireEvent.click(screen.getByRole("button", { name: /choose color theme/i }));
    fireEvent.click(screen.getByRole("button", { name: "My mode" }));

    expect(window.localStorage.getItem(themeStorageKey)).toBe("navy");
    expect(document.documentElement.dataset.theme).toBe("navy");

    act(() => media.setSystemDark(true));

    expect(document.documentElement.dataset.theme).toBe("navy");
    expect(screen.getByRole("button", { name: "My mode" })).toHaveAttribute("aria-pressed", "true");
  });

  it("removes a manual override when System is selected and resumes live following", () => {
    const media = setMediaPreferences({ systemDark: true });
    window.localStorage.setItem(themeStorageKey, "navy");
    render(<ThemeSwitcher initialTheme="navy" />);
    fireEvent.click(screen.getByRole("button", { name: /choose color theme/i }));
    fireEvent.click(screen.getByRole("button", { name: /system, follows device setting/i }));

    expect(window.localStorage.getItem(themeStorageKey)).toBeNull();
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => media.setSystemDark(false));

    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("uses the generated fallback when System is selected without media-query support", () => {
    window.localStorage.setItem(themeStorageKey, "navy");
    Object.defineProperty(window, "matchMedia", { configurable: true, value: undefined });
    render(<ThemeSwitcher initialTheme="light" />);
    fireEvent.click(screen.getByRole("button", { name: /choose color theme/i }));
    fireEvent.click(screen.getByRole("button", { name: "System, follows device setting" }));

    expect(window.localStorage.getItem(themeStorageKey)).toBeNull();
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("keeps System functional for the current visit when override removal fails", () => {
    const media = setMediaPreferences({ systemDark: true });
    window.localStorage.setItem(themeStorageKey, "navy");
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    render(<ThemeSwitcher initialTheme="navy" />);
    fireEvent.click(screen.getByRole("button", { name: /choose color theme/i }));
    fireEvent.click(screen.getByRole("button", { name: "System, follows device setting" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(window.localStorage.getItem(themeStorageKey)).toBe("navy");

    act(() => media.setSystemDark(false));
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("synchronizes explicit and automatic preferences from other tabs", () => {
    const media = setMediaPreferences({ systemDark: false });
    render(<ThemeSwitcher initialTheme="navy" />);

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: themeStorageKey, newValue: "dark" }));
    });
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => media.setSystemDark(true));
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: themeStorageKey, newValue: null }));
    });
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => media.setSystemDark(false));
    expect(document.documentElement.dataset.theme).toBe("light");

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: "unrelated", newValue: "navy" }));
    });
    expect(document.documentElement.dataset.theme).toBe("light");

    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: null }));
    });
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("removes its system-preference and storage listeners when unmounted", () => {
    const media = setMediaPreferences({ systemDark: false });
    const removeWindowListener = vi.spyOn(window, "removeEventListener");
    const { unmount } = render(<ThemeSwitcher initialTheme="navy" />);

    unmount();

    expect(media.systemQuery.removeEventListener).toHaveBeenCalledWith("change", expect.any(Function));
    expect(removeWindowListener).toHaveBeenCalledWith("storage", expect.any(Function));
  });

  it("supports and cleans up the legacy media-query listener API", () => {
    const media = setMediaPreferences({ legacySystem: true, systemDark: true });
    const { unmount } = render(<ThemeSwitcher initialTheme="navy" />);

    expect(media.systemQuery.addListener).toHaveBeenCalledWith(expect.any(Function));
    expect(document.documentElement.dataset.theme).toBe("dark");

    act(() => media.setSystemDark(false));
    expect(document.documentElement.dataset.theme).toBe("light");

    unmount();
    expect(media.systemQuery.removeListener).toHaveBeenCalledWith(expect.any(Function));
  });

  it("keeps theme changes functional when browser storage is unavailable", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("Storage unavailable");
    });

    render(<ThemeSwitcher initialTheme="navy" />);
    fireEvent.click(screen.getByRole("button", { name: /choose color theme/i }));
    fireEvent.click(screen.getByRole("button", { name: "Dark" }));

    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(screen.getByRole("button", { name: "Dark" })).toHaveAttribute("aria-pressed", "true");
  });

  it("uses a cancellable pointer-leave grace period before fading closed", () => {
    vi.useFakeTimers();
    const { container } = render(<ThemeSwitcher initialTheme="navy" />);
    const root = container.querySelector(".theme-switcher");
    const trigger = screen.getByRole("button", { name: /choose color theme/i });

    fireEvent.pointerEnter(root as Element, { pointerType: "mouse" });
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerLeave(root as Element, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(themeMenuCloseDelayMs - 1));
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerEnter(root as Element, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(themeMenuCloseDelayMs));
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerLeave(root as Element, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(themeMenuCloseDelayMs));
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("requires click on coarse pointers and supports Escape plus outside dismissal", () => {
    vi.useFakeTimers();
    setFinePointer(false);
    const { container } = render(<ThemeSwitcher initialTheme="navy" />);
    const root = container.querySelector(".theme-switcher");
    const trigger = screen.getByRole("button", { name: /choose color theme/i });

    fireEvent.pointerEnter(root as Element, { pointerType: "touch" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerLeave(root as Element, { pointerType: "touch" });
    act(() => vi.advanceTimersByTime(themeMenuCloseDelayMs));
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerDown(document.body);
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    fireEvent.focus(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    const lightOption = screen.getByRole("button", { name: "Light" });
    lightOption.focus();
    fireEvent.keyDown(lightOption, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("portals the popover above its trigger and refreshes fixed placement on resize", () => {
    vi.spyOn(window, "innerWidth", "get").mockReturnValue(390);
    vi.spyOn(window, "innerHeight", "get").mockReturnValue(844);
    render(<ThemeSwitcher initialTheme="navy" portalPopover />);
    const trigger = screen.getByRole("button", { name: /choose color theme/i });
    const triggerRect = vi.spyOn(trigger, "getBoundingClientRect").mockReturnValue({
      bottom: 808,
      height: 38,
      left: 312,
      right: 350,
      top: 770,
      width: 38,
      x: 312,
      y: 770,
      toJSON: vi.fn()
    });

    fireEvent.click(trigger);

    const popover = document.querySelector<HTMLDivElement>(".theme-switcher__popover--portal");
    expect(popover).not.toBeNull();
    expect(popover?.parentElement).toBe(document.body);
    expect(trigger).toHaveAttribute("aria-controls", popover?.id);
    expect(popover).toHaveAttribute("aria-hidden", "false");
    expect(popover).toHaveStyle({
      bottom: "74px",
      left: "auto",
      position: "fixed",
      right: "40px",
      top: "auto"
    });

    triggerRect.mockReturnValue({
      bottom: 748,
      height: 38,
      left: 365,
      right: 403,
      top: 710,
      width: 38,
      x: 365,
      y: 710,
      toJSON: vi.fn()
    });
    fireEvent(window, new Event("resize"));

    expect(popover).toHaveStyle({
      bottom: "134px",
      right: `${themeMenuPortalViewportGutterPx}px`
    });
  });

  it("treats the portaled panel as part of the disclosure for pointer and focus interactions", () => {
    vi.useFakeTimers();
    const { container } = render(<ThemeSwitcher initialTheme="navy" portalPopover />);
    const root = container.querySelector(".theme-switcher");
    const trigger = screen.getByRole("button", { name: /choose color theme/i });

    fireEvent.pointerEnter(root as Element, { pointerType: "mouse" });
    const popover = document.querySelector(".theme-switcher__popover--portal");
    const lightOption = screen.getByRole("button", { name: "Light" });

    fireEvent.pointerLeave(root as Element, { pointerType: "mouse" });
    fireEvent.pointerEnter(popover as Element, { pointerType: "mouse" });
    act(() => vi.advanceTimersByTime(themeMenuCloseDelayMs));
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.blur(trigger, { relatedTarget: lightOption });
    fireEvent.focus(lightOption, { relatedTarget: trigger });
    act(() => vi.advanceTimersByTime(themeMenuCloseDelayMs));
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerDown(lightOption);
    fireEvent.click(lightOption);
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.keyDown(lightOption, { key: "Escape" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("preserves controlled state and dismisses a portaled popover only through callbacks", () => {
    setFinePointer(false);
    const onOpenChange = vi.fn();
    const { rerender } = render(
      <ThemeSwitcher
        initialTheme="navy"
        onOpenChange={onOpenChange}
        open={false}
        portalPopover
      />
    );
    const trigger = screen.getByRole("button", { name: /choose color theme/i });

    fireEvent.click(trigger);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    rerender(
      <ThemeSwitcher
        initialTheme="navy"
        onOpenChange={onOpenChange}
        open
        portalPopover
      />
    );
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    fireEvent.pointerDown(screen.getByRole("button", { name: "Dark" }));
    expect(onOpenChange).toHaveBeenCalledTimes(1);

    fireEvent.pointerDown(document.body);
    expect(onOpenChange).toHaveBeenLastCalledWith(false);
    expect(trigger).toHaveAttribute("aria-expanded", "true");

    rerender(
      <ThemeSwitcher
        initialTheme="navy"
        onOpenChange={onOpenChange}
        open={false}
        portalPopover
      />
    );
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });

  it("removes portal placement listeners when the disclosure closes and unmounts", () => {
    const addWindowListener = vi.spyOn(window, "addEventListener");
    const removeWindowListener = vi.spyOn(window, "removeEventListener");
    const addDocumentListener = vi.spyOn(document, "addEventListener");
    const removeDocumentListener = vi.spyOn(document, "removeEventListener");
    const { unmount } = render(<ThemeSwitcher initialTheme="navy" open portalPopover />);

    expect(addWindowListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(addDocumentListener).toHaveBeenCalledWith("scroll", expect.any(Function), true);

    unmount();

    expect(removeWindowListener).toHaveBeenCalledWith("resize", expect.any(Function));
    expect(removeDocumentListener).toHaveBeenCalledWith("scroll", expect.any(Function), true);
    expect(document.querySelector(".theme-switcher__popover--portal")).not.toBeInTheDocument();
  });

  it("cleans up a pending close without notifying after unmount", () => {
    vi.useFakeTimers();
    const onOpenChange = vi.fn();
    const { container, unmount } = render(<ThemeSwitcher initialTheme="navy" onOpenChange={onOpenChange} />);
    const root = container.querySelector(".theme-switcher");

    fireEvent.pointerEnter(root as Element, { pointerType: "mouse" });
    fireEvent.pointerLeave(root as Element, { pointerType: "mouse" });
    unmount();
    act(() => vi.advanceTimersByTime(themeMenuCloseDelayMs));

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange).toHaveBeenLastCalledWith(true);
  });
});
