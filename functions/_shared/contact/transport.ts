export type ReadJsonResponse = () => Promise<unknown | undefined>;

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
  operationDeadline?: Deadline
): Promise<Response | undefined> {
  if (operationDeadline?.isExpired()) return undefined;
  const controller = new AbortController();
  const deadline = createDeadline(timeoutMs, () => controller.abort());
  const removeOperationAbort = abortWhenExpired(operationDeadline, controller);

  try {
    return await fetchResponse(url, init, controller.signal, deadline, operationDeadline);
  } finally {
    removeOperationAbort();
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
  if (operationDeadline?.isExpired()) return undefined;
  const controller = new AbortController();
  const deadline = createDeadline(timeoutMs, () => controller.abort());
  const removeOperationAbort = abortWhenExpired(operationDeadline, controller);

  try {
    const response = await fetchResponse(url, init, controller.signal, deadline, operationDeadline);
    if (!response) return undefined;

    let bodyRead = false;
    const readJson: ReadJsonResponse = async () => {
      if (bodyRead) return undefined;
      bodyRead = true;
      return readJsonResponse(response, maxResponseBytes, deadline, operationDeadline);
    };

    try {
      return await awaitWithDeadlines(handleResponse(response, readJson), deadline, operationDeadline);
    } finally {
      if (!bodyRead) discardResponseBody(response);
    }
  } catch {
    return undefined;
  } finally {
    removeOperationAbort();
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
  remainingMs: () => number;
}

export function createDeadline(timeoutMs: number, onExpire?: () => void): Deadline {
  let deadlineExpired = false;
  let expire: () => void = () => undefined;
  const expired = new Promise<void>((resolve) => {
    expire = resolve;
  });
  const expiresAt = Date.now() + timeoutMs;
  const timeout = setTimeout(() => {
    deadlineExpired = true;
    try {
      onExpire?.();
    } finally {
      expire();
    }
  }, timeoutMs);

  return {
    expired,
    clear: () => clearTimeout(timeout),
    isExpired: () => deadlineExpired || Date.now() >= expiresAt,
    remainingMs: () => Math.max(0, expiresAt - Date.now())
  };
}

export async function awaitWithDeadline<T>(operation: Promise<T>, deadline: Deadline): Promise<T | undefined> {
  return Promise.race([operation.catch(() => undefined), deadline.expired.then(() => undefined)]);
}

export async function awaitWithDeadlines<T>(
  operation: Promise<T>,
  deadline: Deadline,
  operationDeadline?: Deadline
): Promise<T | undefined> {
  const deadlines: Promise<undefined>[] = [deadline.expired.then(() => undefined)];
  if (operationDeadline) deadlines.push(operationDeadline.expired.then(() => undefined));
  return Promise.race([operation.catch(() => undefined), ...deadlines]);
}

export async function startWithinDeadlines<T>(
  operation: () => Promise<T>,
  deadline: Deadline,
  operationDeadline?: Deadline
): Promise<T | undefined> {
  if (deadline.isExpired() || operationDeadline?.isExpired()) return undefined;
  const pending = Promise.resolve().then(() =>
    deadline.isExpired() || operationDeadline?.isExpired() ? undefined : operation()
  );
  const result = await awaitWithDeadlines(pending, deadline, operationDeadline);
  return deadline.isExpired() || operationDeadline?.isExpired() ? undefined : result;
}

async function fetchResponse(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
  deadline: Deadline,
  operationDeadline?: Deadline
): Promise<Response | undefined> {
  const responsePromise = Promise.resolve()
    // workerd rejects redirect: "error" before issuing a request. Manual mode
    // lets us reject redirects without forwarding provider credentials.
    .then(() => fetch(url, { ...init, redirect: "manual", signal }))
    .then(
      (response) => {
        if (deadline.isExpired() || operationDeadline?.isExpired() || (response.status >= 300 && response.status < 400)) {
          discardResponseBody(response);
          return undefined;
        }
        return response;
      },
      () => undefined
    );
  const response = await awaitWithDeadlines(responsePromise, deadline, operationDeadline);
  if (!response || deadline.isExpired() || operationDeadline?.isExpired()) {
    if (response) discardResponseBody(response);
    return undefined;
  }
  return response;
}

function abortWhenExpired(deadline: Deadline | undefined, controller: AbortController): () => void {
  if (!deadline) return () => undefined;
  if (deadline.isExpired()) {
    controller.abort();
    return () => undefined;
  }
  let active = true;
  void deadline.expired.then(() => {
    if (active) controller.abort();
  });
  return () => {
    active = false;
  };
}

async function readJsonResponse(
  response: Response,
  maxResponseBytes: number,
  deadline: Deadline,
  operationDeadline?: Deadline
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
      const chunk = await awaitWithDeadlines(reader.read(), deadline, operationDeadline);
      if (!chunk || deadline.isExpired() || operationDeadline?.isExpired()) return undefined;
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

    if (deadline.isExpired() || operationDeadline?.isExpired()) return undefined;
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    const value = JSON.parse(text) as unknown;
    return deadline.isExpired() || operationDeadline?.isExpired() ? undefined : value;
  } catch {
    return undefined;
  } finally {
    if (!completed) cancelBodyReader(reader);
  }
}
