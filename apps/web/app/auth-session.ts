export type BrowserSession = {
  accessToken: string;
  expiresAt: string;
  user: {
    id: string;
    email: string | null;
    telegramUsername: string | null;
    displayName: string;
    authenticationMethod: "EMAIL" | "TELEGRAM";
  };
};

export type RefreshResult =
  | { kind: "ok"; session: BrowserSession }
  | { kind: "unauthorized" }
  | { kind: "network" };

let refreshInFlight: Promise<RefreshResult> | null = null;

/**
 * The access credential stays only in JavaScript memory. A durable, HttpOnly
 * refresh credential is scoped to /api/v1/auth by the server.
 */
export async function refreshBrowserSession(apiUrl: string): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const response = await fetch(`${apiUrl}/auth/session/refresh`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      if (response.status === 401) return { kind: "unauthorized" };
      if (!response.ok) return { kind: "network" };
      const session = (await response.json()) as BrowserSession;
      if (
        !session.accessToken ||
        !session.expiresAt ||
        !session.user?.id
      ) {
        return { kind: "network" };
      }
      return { kind: "ok", session };
    } catch {
      return { kind: "network" };
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

export async function logoutBrowserSession(apiUrl: string): Promise<void> {
  const response = await fetch(`${apiUrl}/auth/session/logout`, {
    method: "POST",
    credentials: "include",
    cache: "no-store",
  });
  if (!response.ok && response.status !== 401) {
    throw new Error("Could not end the current session.");
  }
}
