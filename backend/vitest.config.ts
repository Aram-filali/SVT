import { defineConfig } from 'vitest/config';
import swc from 'unplugin-swc';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    globals: true,
    root: './',
    testTimeout: 30000,
  },
  plugins: [
    swc.vite({ module: { type: 'es6' } }),
    tsconfigPaths(),
  ],
});
