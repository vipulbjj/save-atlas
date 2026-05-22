import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  plugins: [
    {
      name: 'treat-js-files-as-jsx',
      async transform(code, id) {
        // Run esbuild transform on all Next.js JS files in the app folder to support JSX
        if (!id.endsWith('.js')) return null;
        if (!id.includes('/app/')) return null;

        const { transformWithEsbuild } = await import('vite');
        return transformWithEsbuild(code, id, {
          loader: 'jsx',
          jsx: 'automatic',
        });
      },
    },
  ],
  test: {
    environment: 'happy-dom',
    globals: true,
    exclude: ['**/node_modules/**', '**/e2e/**'],
    alias: {
      '@': path.resolve(__dirname, './'),
    },
  },
})
