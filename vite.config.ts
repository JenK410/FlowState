import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const disableHmr = process.env.DISABLE_HMR === 'true';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
  build: {
    outDir: 'dist',
  },
  server: {
    host: '0.0.0.0',
    port: 3001,
    strictPort: true,

    // Allows public tunnel links like https://something.loca.lt
    allowedHosts: [
      '.loca.lt',
      'localhost',
      '127.0.0.1',
    ],

    // Keeps HMR from using the busy 24678 port and helps with public tunnel viewing.
    hmr: disableHmr
      ? false
      : {
          protocol: 'wss',
          clientPort: 443,
          port: 24679,
        },

    // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
    watch: disableHmr ? null : {},
  },
});
