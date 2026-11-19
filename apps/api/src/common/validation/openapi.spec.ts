import { signUpSchema } from '@auth/shared';
import { z } from 'zod';
import { zodToOpenApi } from './openapi';

describe('zodToOpenApi', () => {
  it('documents the shared sign-up schema', () => {
    const schema = zodToOpenApi(signUpSchema);
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(['email', 'name', 'password']);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties?.['password']).toMatchObject({
      type: 'string',
      minLength: 8,
      maxLength: 128,
    });
  });

  it('collapses nullable union types to a single OpenAPI type', () => {
    expect(zodToOpenApi(z.object({ a: z.string().nullable() })).properties?.['a']).toBeDefined();
  });
});
