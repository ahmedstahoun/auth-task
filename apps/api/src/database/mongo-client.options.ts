import * as os from 'node:os';
import type { MongooseModuleOptions } from '@nestjs/mongoose';

/**
 * Options shared by every MongoDB connection (app, integration and e2e tests).
 *
 * `runtimeAdapters.os`: driver 7.8 otherwise loads `os` with a dynamic `import()` to build the
 * handshake metadata. Jest's CommonJS sandbox cannot run dynamic imports, the import fails
 * silently, the handshake goes out with an empty `client` document, and MongoDB 8 rejects it
 * ("Missing required sub-document 'driver'"). Passing the adapter explicitly is the public,
 * runtime-independent way to avoid that.
 */
export const BASE_MONGO_OPTIONS = {
  runtimeAdapters: { os },
  serverSelectionTimeoutMS: 5000,
} satisfies MongooseModuleOptions;
