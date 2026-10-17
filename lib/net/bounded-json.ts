// Enforce a byte bound while consuming the stream, even if Content-Length is
// absent or dishonest. Do not retain/log payloads on malformed requests.
export async function readBoundedJson(request: Request, maxBytes: number): Promise<
  { ok: true; value: unknown } | { ok: false; status: 400 | 413 }
> {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxBytes) {
    void request.body?.cancel().catch(() => {});
    return { ok: false, status: 413 };
  }
  const reader = request.body?.getReader();
  if (!reader) return { ok: false, status: 400 };
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        void reader.cancel().catch(() => {});
        return { ok: false, status: 413 };
      }
      text += decoder.decode(value, { stream: true });
    }
    return { ok: true, value: JSON.parse(text + decoder.decode()) as unknown };
  } catch {
    return { ok: false, status: 400 };
  } finally {
    reader.releaseLock();
  }
}
