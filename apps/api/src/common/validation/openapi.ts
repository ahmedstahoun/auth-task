import type { ApiBody } from '@nestjs/swagger';
import { z } from 'zod';

/** Swagger's SchemaObject, derived from the public ApiBody signature (deep imports are blocked). */
export type OpenApiSchema = NonNullable<
  Extract<Parameters<typeof ApiBody>[0], { schema?: unknown }>['schema']
>;

type JsonSchema = z.core.JSONSchema.BaseSchema;

/**
 * JSON Schema and OpenAPI 3.0 SchemaObject differ slightly (e.g. `type` may be an array in JSON
 * Schema). This maps the subset our request schemas use, keeping both sides fully typed.
 */
function toOpenApi(schema: JsonSchema): OpenApiSchema {
  const type = Array.isArray(schema.type) ? schema.type[0] : schema.type;
  const result: OpenApiSchema = {};
  if (type !== undefined) result.type = type;
  if (schema.format !== undefined) result.format = schema.format;
  if (schema.pattern !== undefined) result.pattern = schema.pattern;
  if (schema.minLength !== undefined) result.minLength = schema.minLength;
  if (schema.maxLength !== undefined) result.maxLength = schema.maxLength;
  if (schema.description !== undefined) result.description = schema.description;
  if (schema.required !== undefined) result.required = schema.required;
  if (typeof schema.additionalProperties === 'boolean') {
    result.additionalProperties = schema.additionalProperties;
  }
  if (schema.properties !== undefined) {
    result.properties = Object.fromEntries(
      Object.entries(schema.properties).map(([key, value]) => [
        key,
        typeof value === 'boolean' ? {} : toOpenApi(value),
      ]),
    );
  }
  return result;
}

/** Generates Swagger docs from the shared zod schemas, so docs can't drift from validation. */
export function zodToOpenApi(schema: z.ZodType): OpenApiSchema {
  return toOpenApi(
    z.toJSONSchema(schema, { target: 'openapi-3.0', io: 'input', unrepresentable: 'any' }),
  );
}
