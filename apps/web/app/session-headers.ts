/**
 * Public share pages never need durable JavaScript credentials. They remain
 * available to signed-out visitors; the main application restores a login via
 * its HttpOnly refresh cookie when needed.
 */
export function sessionHeaders(_storage?: Pick<Storage, "getItem">): Record<string, string> {
  return {};
}
