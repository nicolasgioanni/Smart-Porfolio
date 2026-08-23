export function serializeJsonLd(value: unknown): string {
  const serializedValue = JSON.stringify(value);

  if (serializedValue === undefined) {
    throw new TypeError("JSON-LD data must be JSON serializable.");
  }

  return serializedValue
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}
