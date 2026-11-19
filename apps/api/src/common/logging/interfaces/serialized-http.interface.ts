/** Shape pino-http hands to the `req` serializer (pino-std-serializers). */
export interface SerializedRequest {
  id: unknown;
  method: unknown;
  url: unknown;
  remoteAddress: unknown;
  headers: Record<string, unknown>;
}

/** Shape pino-http hands to the `res` serializer. */
export interface SerializedResponse {
  statusCode: unknown;
}
