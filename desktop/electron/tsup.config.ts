import { defineConfig } from 'tsup';

const isDev = process.env.NODE_ENV !== 'production';

export default defineConfig({
  entry: ['electron/main.ts', 'electron/preload.ts'],
  format: ['cjs'],
  sourcemap: isDev,
  clean: false,
  dts: false,
  minify: !isDev,
  target: 'node18',
  outDir: 'dist',
  platform: 'node',
  shims: false,
  external: ['electron', 'keytar'],
  noExternal: ['@modelcontextprotocol/sdk'],
  define: {
    __DEV__: JSON.stringify(isDev)
  },
  onSuccess: isDev ? 'echo "Main process rebuilt."' : undefined
});

