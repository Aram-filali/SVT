import { defineConfig } from 'vitest/config';
import * as swc from '@swc/wasm';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  esbuild: false,
  test: {
    include: ['test/**/*.e2e-spec.ts'],
    globals: true,
    root: './',
    testTimeout: 30000,
    fileParallelism: false,
    setupFiles: ['./test/setup.ts'],
  },
  plugins: [
    {
      name: 'swc-wasm',
      enforce: 'pre',
      transform(code, id) {
        if (!/\.(ts|tsx)$/.test(id) || id.includes('node_modules')) return;
        const result = swc.transformSync(code, {
          filename: id,
          jsc: {
            parser: {
              syntax: 'typescript',
              decorators: true,
              dynamicImport: true,
            },
            transform: {
              legacyDecorator: true,
              decoratorMetadata: true,
            },
            target: 'es2022',
          },
          module: {
            type: 'es6',
          },
        });
        return {
          code: result.code,
          map: result.map,
        };
      },
    },
    tsconfigPaths(),
  ],
});