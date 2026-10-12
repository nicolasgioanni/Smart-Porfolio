export type ContactApiResult = { error?: string; ok?: boolean };

type AbortControllerRef = { current: AbortController | undefined };

const maxContactApiResponseBytes = 16_384;

async function awaitWithAbort<T>(operation: Promise<T>, signal: AbortSignal): Promise<T | undefined> {
  if (signal.aborted) return undefined;
  return new Promise((resolve) => {
    const onAbort = () => resolve(undefined);
    signal.addEventListener("abort", onAbort, { once: true });
    void operation.then(
      (value) => resolve(value),
      () => resolve(undefined)
    ).finally(() => signal.removeEventListener("abort", onAbort));
  });
}

export async function readContactApiResult(response: Response, signal: AbortSignal): Promise<ContactApiResult | null> {
  const contentLength = response.headers.get("Content-Length");
  if (contentLength) {
    const length = Number(contentLength);
    if (!Number.isSafeInteger(length) || length < 0 || length > maxContactApiResponseBytes) return null;
  }
  if (!response.body) return null;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  let completed = false;
  try {
    while (true) {
      const chunk = await awaitWithAbort(reader.read(), signal);
      if (!chunk) return null;
      if (chunk.done) {
        completed = true;
        break;
      }
      length += chunk.value.byteLength;
      if (length > maxContactApiResponseBytes) return null;
      chunks.push(chunk.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    const result = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as unknown;
    return result && typeof result === "object" ? (result as ContactApiResult) : null;
  } catch {
    return null;
  } finally {
    try {
      if (!completed) void reader.cancel();
    } catch {
      // The browser may already have closed the bounded response stream.
    }
  }
}

export async function requestContactApi(
  path: "/api/contact/verify" | "/api/contact",
  body: string,
  controllerRef: AbortControllerRef,
  timeoutMs: number
): Promise<{ response?: Response; result: ContactApiResult | null }> {
  controllerRef.current?.abort();
  const controller = new AbortController();
  controllerRef.current = controller;
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      method: "POST",
      credentials: "same-origin",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body,
      signal: controller.signal
    });
    return { response, result: await readContactApiResult(response, controller.signal) };
  } catch {
    return { result: null };
  } finally {
    window.clearTimeout(timeout);
    if (controllerRef.current === controller) controllerRef.current = undefined;
  }
}
