// @vitest-environment node
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock("node:child_process", () => ({ spawn: mocks.spawn }));
import { runWorkbookParser, safeWorkbookParserError } from "./workbookParserProcess";

function fakeChild() {
  const child = Object.assign(new EventEmitter(), { stdin: new PassThrough(), stdout: new PassThrough(), stderr: new PassThrough(), kill: vi.fn() });
  mocks.spawn.mockReturnValue(child);
  return child;
}
beforeEach(() => { vi.useRealTimers(); mocks.spawn.mockReset(); });

describe("workbook parser process boundary", () => {
  it("runs the fixed child with a heap limit and no inherited credentials", async () => {
    const child = fakeChild();
    const result = runWorkbookParser(new Uint8Array([1]));
    child.stdout.write(JSON.stringify({ error: "The workbook download is not a valid XLSX workbook" }));
    child.emit("close", 0, null);
    await expect(result).rejects.toThrow(/not a valid XLSX/);
    const [, args, options] = mocks.spawn.mock.calls[0]!;
    expect(args).toContain("--max-old-space-size=512");
    expect(args.at(-1)).toMatch(/scripts\/lib\/workbookParserChild\.ts$/);
    expect(options.env).toEqual({ NODE_ENV: "production" });
  });
  it("kills a stalled parser at its deadline", async () => {
    vi.useFakeTimers(); const child = fakeChild();
    const result = runWorkbookParser(new Uint8Array([1]));
    const assertion = expect(result).rejects.toThrow(/timed out/);
    await vi.advanceTimersByTimeAsync(15_000); await assertion;
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
  });
  it.each(["exit", "malformed", "stderr", "stdout"]) ("fails closed on %s without logging child data", async (scenario) => {
    const child = fakeChild(); const result = runWorkbookParser(new Uint8Array([1]));
    if (scenario === "exit") child.emit("close", 1, null);
    if (scenario === "malformed") { child.stdout.write('{"sheets":{}}'); child.emit("close", 0, null); }
    if (scenario === "stderr") child.stderr.write(Buffer.alloc(64 * 1024 + 1));
    if (scenario === "stdout") child.stdout.write(Buffer.alloc(64 * 1024 * 1024 + 1));
    await expect(result).rejects.toThrow("The XLSX workbook parser failed");
    expect(child.kill).toHaveBeenCalled();
  });
  it("redacts untrusted keys and unexpected error details", () => {
    expect(safeWorkbookParserError("The workbook profile tab contains an unknown key: secret-url")).toBe("The workbook profile tab contains an unknown key");
    expect(safeWorkbookParserError("secret-url")).toBe("The XLSX workbook could not be parsed");
  });
});
