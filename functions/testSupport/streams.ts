export function stalledJsonResponse(onCancel: () => void, status = 200): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      pull: () => new Promise<void>(() => undefined),
      cancel: () => {
        onCancel();
        return new Promise<void>(() => undefined);
      }
    }),
    { status, headers: { "Content-Type": "application/json" } }
  );
}

export function oversizedJsonResponse(onCancel: () => void): Response {
  return new Response(
    new ReadableStream<Uint8Array>({
      start: (controller) => controller.enqueue(new Uint8Array(128 * 1_024)),
      cancel: onCancel
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}
