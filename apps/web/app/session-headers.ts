/** Public share pages optionally identify the visitor using the existing login. */
export function sessionHeaders(storage: Pick<Storage, "getItem">): Record<string, string> {
  try {
    const session = JSON.parse(storage.getItem("flyae:session") ?? "null");
    if (
      typeof session?.accessToken === "string" && /^[A-Za-z0-9_.-]+$/.test(session.accessToken) &&
      typeof session.expiresAt === "string" && Date.parse(session.expiresAt) > Date.now()
    ) {
      return { Authorization: `Bearer ${session.accessToken}` };
    }
  } catch {
    // Missing, malformed or inaccessible storage must not block a public link.
  }
  return {};
}
