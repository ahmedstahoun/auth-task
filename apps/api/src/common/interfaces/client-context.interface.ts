/** Caller details recorded on sessions and audit events. */
export interface ClientContext {
  ip: string | null;
  userAgent: string | null;
}
