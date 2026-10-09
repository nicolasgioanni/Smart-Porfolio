export type ReadJsonResponse = () => Promise<unknown | undefined>;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  operationDeadline?: Deadline
): Promise<Response | undefined> {
  const controller = new AbortController();
  const deadline = createDeadline(timeoutMs, () => controller.abort(), operationDeadline);

  try {
    if (operationDeadline?.isExpired()) return undefined;
    return await fetchResponse(url, init, controller.signal, deadline);
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
  handleResponse: (response: Response, readJson: ReadJsonResponse) => Promise<T>,
  operationDeadline?: Deadline
): Promise<T | undefined> {
  const controller = new AbortController();
  const deadline = createDeadline(timeoutMs, () => controller.abort(), operationDeadline);

  try {
    if (operationDeadline?.isExpired()) return undefined;
    const response = await fetchResponse(url, init, controller.signal, deadline);
    if (!response || deadline.isExpired()) return undefined;

    let bodyRead = false;
    const readJson: ReadJsonResponse = async () => {
      if (bodyRead) return undefined;
      bodyRead = true;
      return readJsonResponse(response, maxResponseBytes, deadline);
    };

    try {
      return await awaitWithDeadline(handleResponse(response, readJson), deadline);
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

export interface Deadline {
  expired: Promise<void>;
  clear: () => void;
  isExpired: () => boolean;
}

export function createDeadline(timeoutMs: number, onExpire?: () => void, parent?: Deadline): Deadline {
  let deadlineExpired = false;
  let expire: () => void = () => undefined;
  const expired = new Promise<void>((resolve) => {
    expire = resolve;
  });
  const expireDeadline = () => {
    if (deadlineExpired) return;
    deadlineExpired = true;
    try { onExpire?.(); } finally { expire(); }
  };
  const timeout = setTimeout(expireDeadline, timeoutMs);
  void parent?.expired.then(expireDeadline);

  return { expired, clear: () => clearTimeout(timeout), isExpired: () => deadlineExpired };
}

export async function awaitWithDeadline<T>(operation: Promise<T>, deadline: Deadline): Promise<T | undefined> {
  // Keep a rejection observer attached even when a deadline wins, so a
  // non-cooperative provider cannot produce an unhandled late rejection.
  const guarded = operation.then(
    (value) => value,
    () => undefined
  );
  return Promise.race([guarded, deadline.expired.then(() => undefined)]);
}

async function fetchResponse(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
  deadline: Deadline
): Promise<Response | undefined> {
  const responsePromise = Promise.resolve()
    // workerd rejects redirect: "error" before issuing a request. Manual mode
    // lets us reject redirects without forwarding provider credentials.
    .then(() => fetch(url, { ...init, redirect: "manual", signal }))
    .then(
      (response) => {
        if (deadline.isExpired() || (response.status >= 300 && response.status < 400)) {
          discardResponseBody(response);
          return undefined;
        }
        return response;
      },
      () => undefined
    );
  const response = await Promise.race([responsePromise, deadline.expired.then(() => undefined)]);
  if (!response || deadline.isExpired()) {
    if (response) discardResponseBody(response);
    return undefined;
  }
  return response;
}

async function readJsonResponse(
  response: Response,
  maxResponseBytes: number,
  deadline: Deadline
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
      const chunk = await awaitWithDeadline(reader.read(), deadline);
      if (!chunk || deadline.isExpired()) return undefined;
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

    if (deadline.isExpired()) return undefined;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const value = JSON.parse(text) as unknown;
    return deadline.isExpired() ? undefined : value;
  } catch {
    return undefined;
  } finally {
    if (!completed) cancelBodyReader(reader);
  }
}
