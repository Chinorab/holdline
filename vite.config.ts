/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import { readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { iwsdkDev } from '@iwsdk/vite-plugin-dev';
import { defineConfig, type Plugin } from 'vite';

const root = fileURLToPath(new URL('.', import.meta.url));

// Agent notes in public/ (AGENTS.md) are for the editor and coding agents, never for the
// published site: delete them from dist after the bundle is written.
function dropAgentNotes(): Plugin {
  return {
    name: 'holdline-drop-agent-notes',
    apply: 'build',
    closeBundle() {
      const walk = (dir: string) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const path = join(dir, entry.name);
          if (entry.isDirectory()) walk(path);
          else if (entry.name === 'AGENTS.md') rmSync(path);
        }
      };
      walk(join(root, 'dist'));
    },
  };
}

export default defineConfig({
  // HOLDLINE_HTTP=1 serves the dev build over http://localhost (a secure context for
  // WebXR) for local browsers that do not trust the generated certificate.
  plugins: [iwsdkDev(process.env.HOLDLINE_HTTP === '1' ? { https: false } : {}), dropAgentNotes()],
  server: { host: '0.0.0.0', port: 8081, open: false },
  build: {
    outDir: 'dist',
    sourcemap: false,
    target: 'esnext',
    rollupOptions: { input: { main: './index.html', privacy: './privacy.html' } },
  },
  esbuild: { target: 'esnext' },
  worker: { format: 'es' },
  // @drawcall/uikitml otherwise pulls a second three/@pmndrs/uikit graph
  // (its own three vs the app's super-three alias). Duplicate Component classes break
  // instanceof checks → "Only pmndrs/uikit components can be added as children".
  resolve: {
    dedupe: [
      'three',
      '@pmndrs/uikit',
      '@pmndrs/uikit-horizon',
      '@pmndrs/uikit-lucide',
    ],
  },
  optimizeDeps: {
    exclude: ['@babylonjs/havok'],
    include: [
      'three',
      '@pmndrs/uikit',
      '@pmndrs/uikit-horizon',
      '@pmndrs/uikit-lucide',
      '@drawcall/uikitml',
    ],
    esbuildOptions: { target: 'esnext' },
  },
  publicDir: 'public',
  base: './',
});
