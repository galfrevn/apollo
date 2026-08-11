export const APOLLO_DEVICE_PROTOCOL_VERSION = '1.0';

// The specification pins a `hello` without a `protocol` field to 1.0 — the
// version that predates negotiation — not to whatever this server speaks now.
const IMPLICIT_HELLO_PROTOCOL_VERSION = '1.0';

export function resolveDeclaredProtocolVersion(
  declaredProtocolVersion: string | undefined,
): string {
  return declaredProtocolVersion ?? IMPLICIT_HELLO_PROTOCOL_VERSION;
}
