import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  // Cleaning in watch mode would briefly delete dist while the API/web dev servers read it.
  clean: !options.watch,
  sourcemap: true,
  target: 'es2023',
}));
