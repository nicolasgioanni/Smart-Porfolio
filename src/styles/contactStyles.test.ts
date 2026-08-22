import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const contactStyles = readFileSync(path.join(process.cwd(), "src", "styles", "contact.css"), "utf8");
const tokenStyles = readFileSync(path.join(process.cwd(), "src", "styles", "tokens.css"), "utf8");

describe("contact wizard styles", () => {
  it("shows invalid fields in the danger color without removing the focus ring", () => {
    expect(contactStyles).toMatch(
      /\.contact-field :is\(input, textarea\)\[aria-invalid="true"\]\s*{[^}]*border-color: var\(--color-danger\)[^}]*box-shadow: 0 0 0 1px var\(--color-danger\)/s
    );
    expect(contactStyles).toMatch(
      /\.contact-field :is\(input, textarea\)\[aria-invalid="true"\]:focus-visible\s*{[^}]*var\(--focus-ring\)[^}]*var\(--color-danger\)/s
    );
    expect(contactStyles).toMatch(/\.contact-field__error\s*{[^}]*color: var\(--color-danger\)/s);
  });

  it("provides checked, keyboard-focus, glass-disabled, and reduced-motion states", () => {
    expect(contactStyles).toMatch(/\.contact-consent-card:focus-within\s*{[^}]*var\(--focus-ring\)/);
    expect(contactStyles).toMatch(
      /\.contact-consent-card\[data-checked="true"\]\s*{[^}]*var\(--hover-base-1-selected-surface\)/s
    );
    expect(contactStyles).toMatch(
      /\.site-shell\[data-glass-effects="false"\] \.contact-field :is\(input, textarea\)[\s\S]*?backdrop-filter: none/
    );
    expect(contactStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.contact-field textarea,[\s\S]*?\.contact-consent-card\s*{[^}]*transition: none/
    );
    expect(contactStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.contact-notice\s*{[^}]*animation: none/s
    );
  });

  it("uses one focused, animated notice treatment for semantic error and success feedback", () => {
    expect(contactStyles).toMatch(
      /\.contact-notice\s*{[^}]*color: var\(--color-danger\)[^}]*background: var\(--color-danger-surface\)[^}]*animation: contact-notice-enter 200ms/s
    );
    expect(contactStyles).toMatch(
      /\.contact-notice\[data-tone="success"\]\s*{[^}]*border-color: var\(--color-success-border\)[^}]*color: var\(--color-success\)[^}]*background: var\(--color-success-surface\)/s
    );
    expect(contactStyles).toMatch(/\.contact-notice:focus-visible\s*{[^}]*var\(--focus-ring\)/s);
    expect(contactStyles).toMatch(
      /@keyframes contact-notice-enter[\s\S]*?opacity: 0[^}]*transform: translateY\(-0\.5rem\)[\s\S]*?opacity: 1[^}]*transform: translateY\(0\)/s
    );
    expect(tokenStyles.match(/--color-danger-surface:/g)).toHaveLength(3);
    expect(tokenStyles.match(/--color-success:/g)).toHaveLength(3);
    expect(tokenStyles.match(/--color-success-border:/g)).toHaveLength(3);
    expect(tokenStyles.match(/--color-success-surface:/g)).toHaveLength(3);
  });

  it("stacks controls and makes every action full width on narrow screens", () => {
    expect(contactStyles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.contact-step__actions\s*{[^}]*flex-direction: column-reverse/s
    );
    expect(contactStyles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.contact-action\s*{[^}]*width: 100%/s
    );
    expect(contactStyles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.contact-review > div\s*{[^}]*grid-template-columns: minmax\(0, 1fr\)/s
    );
  });

  it("allows long errors, review values, acknowledgments, notices, and fallback text to wrap safely", () => {
    expect(contactStyles).toMatch(/\.contact-field__error\s*{[^}]*overflow-wrap: anywhere/s);
    expect(contactStyles).toMatch(/\.contact-review dd\s*{[^}]*overflow-wrap: anywhere/s);
    expect(contactStyles).toMatch(/\.contact-consent-card\s*{[^}]*overflow-wrap: anywhere/s);
    expect(contactStyles).toMatch(/\.contact-submit-status\s*{[^}]*overflow-wrap: anywhere/s);
    expect(contactStyles).toMatch(/\.contact-notice\s*{[^}]*overflow-wrap: anywhere/s);
    expect(contactStyles).toMatch(/\.contact-email-fallback\s*{[^}]*overflow-wrap: anywhere/s);
  });
});
