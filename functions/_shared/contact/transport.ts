export type ReadJsonResponse = () => Promise<unknown | undefined>;

export async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response | undefined> {
  const controller = new AbortController();
  const deadline = createDeadline(controller, timeoutMs);

  try {
    return await fetchResponse(url, init, controller.signal, deadline.expired);
  } finally {
    deadline.clear();
  }
}

/**
 * Executes a fixed-provider JSON exchange under one deadline. The handler can
 * reject an HTTP response without consuming its body; when it does consume the
 * body, its JSON bytes share the same fetch deadline and an explicit byte cap.
 */
export async function fetchWithJsonTimeout<T>(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  maxResponseBytes: number,
  handleResponse: (response: Response, readJson: ReadJsonResponse) => Promise<T>
): Promise<T | undefined> {
  const controller = new AbortController();
  const deadline = createDeadline(controller, timeoutMs);

  try {
    const response = await fetchResponse(url, init, controller.signal, deadline.expired);
    if (!response) return undefined;

    let bodyRead = false;
    const readJson: ReadJsonResponse = async () => {
      if (bodyRead) return undefined;
      bodyRead = true;
      return readJsonResponse(response, maxResponseBytes, deadline.expired);
    };

    try {
      return await handleResponse(response, readJson);
    } finally {
      if (!bodyRead) discardResponseBody(response);
    }
  } catch {
    return undefined;
  } finally {
    deadline.clear();
  }
}

/** Cancels an unneeded body without making the caller wait for provider cleanup. */
export function discardResponseBody(response: Response | undefined): void {
  const body = response?.body;
  if (!body || body.locked) return;

  try {
    void body.cancel().catch(() => undefined);
  } catch {
    // A provider stream can reject cancellation after the response is already closed.
  }
}

export function cancelBodyReader(reader: ReadableStreamDefaultReader<Uint8Array>): void {
  try {
    void reader.cancel().catch(() => undefined);
  } catch {
    // The stream is already closed or errored.
  }
}

function createDeadline(controller: AbortController, timeoutMs: number): { expired: Promise<void>; clear: () => void } {
  let expire: () => void = () => undefined;
  const expired = new Promise<void>((resolve) => {
    expire = resolve;
  });
  const timeout = setTimeout(() => {
    controller.abort();
    expire();
  }, timeoutMs);

  return { expired, clear: () => clearTimeout(timeout) };
}

async function fetchResponse(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
  expired: Promise<void>
): Promise<Response | undefined> {
  const response = await Promise.race([
    Promise.resolve()
      .then(() => fetch(url, { ...init, redirect: "error", signal }))
      .catch(() => undefined),
    expired.then(() => undefined)
  ]);
  return response;
}

async function readJsonResponse(
  response: Response,
  maxResponseBytes: number,
  expired: Promise<void>
): Promise<unknown | undefined> {
  if (!Number.isSafeInteger(maxResponseBytes) || maxResponseBytes < 1) {
    discardResponseBody(response);
    return undefined;
  }

  const contentLength = response.headers.get("Content-Length");
  if (contentLength) {
    const declaredLength = Number(contentLength);
    if (!Number.isSafeInteger(declaredLength) || declaredLength < 0 || declaredLength > maxResponseBytes) {
      discardResponseBody(response);
      return undefined;
    }
  }

  if (!response.body) return undefined;

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let byteLength = 0;
  let completed = false;

  try {
    while (true) {
      const chunk = await Promise.race([
        reader.read().catch(() => undefined),
        expired.then(() => undefined)
      ]);
      if (!chunk) return undefined;
      if (chunk.done) {
        completed = true;
        break;
      }

      byteLength += chunk.value.byteLength;
      if (byteLength > maxResponseBytes) return undefined;
      chunks.push(chunk.value);
    }

    const bytes = new Uint8Array(byteLength);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  } finally {
    if (!completed) cancelBodyReader(reader);
  }
}
