import type { ApiBody } from '@nestjs/swagger';

/**
 * Swagger's SchemaObject, derived from the public ApiBody signature (the package blocks deep
 * imports), minus `$ref` objects.
 */
export type OpenApiSchema = Exclude<
  NonNullable<Extract<Parameters<typeof ApiBody>[0], { schema?: unknown }>['schema']>,
  { $ref: string }
>;
