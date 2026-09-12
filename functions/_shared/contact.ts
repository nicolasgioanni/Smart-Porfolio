/**
 * Stable public contact boundary for Pages Function handlers and their tests.
 * Runtime domains live under `contact/` so provider, persistence, and delivery
 * dependencies stay independently reviewable.
 */
export * from "./contact/config";
export * from "./contact/contracts";
export * from "./contact/delivery";
export * from "./contact/dns";
export * from "./contact/payload";
export * from "./contact/request";
export * from "./contact/reservation";
export * from "./contact/ticket";
export * from "./contact/turnstile";
