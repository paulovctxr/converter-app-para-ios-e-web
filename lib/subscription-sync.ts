import type { Access } from "./plans";

// Only the authenticated server response determines access. A failed request
// preserves the last confirmed state; it must not erase an open nutrition draft.
export function createSubscriptionSync(
  read: (signal: AbortSignal) => Promise<Access>,
  onAccess: (access: Access, previous: Access | null) => void,
) {
  let disposed = false;
  let controller: AbortController | null = null;
  let previous: Access | null = null;
  let signature = "";
  let timeout: ReturnType<typeof setTimeout> | undefined;

  async function refresh() {
    if (disposed || controller) return;
    const current = new AbortController();
    controller = current;
    timeout = setTimeout(() => current.abort(), 10000);
    try {
      const access = await read(current.signal);
      if (disposed || current.signal.aborted || !access) return;
      // server_time changes on every check, even if the subscription did not.
      const { server_time: _serverTime, ...state } = access;
      const nextSignature = JSON.stringify(state);
      if (signature !== nextSignature) {
        const old = previous;
        previous = access;
        signature = nextSignature;
        onAccess(access, old);
      }
    } catch {
      // The next visible/online check retries without granting new privileges.
    } finally {
      clearTimeout(timeout);
      controller = null;
    }
  }

  function dispose() {
    disposed = true;
    clearTimeout(timeout);
    controller?.abort();
  }

  return { refresh, dispose };
}
