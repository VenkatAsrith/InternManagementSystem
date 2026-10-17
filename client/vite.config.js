import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const here = path.dirname(fileURLToPath(import.meta.url));

// The API target and dev port are configurable so the QA stack (API :5100, UI :3100) never collides with
// a developer's own stack (API :5000, UI :3000):  VITE_API_PROXY=http://localhost:5100 VITE_PORT=3100 vite
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, here, '');
  const target = env.VITE_API_URL || env.VITE_API_PROXY || 'https://internmanagementsystem-xm84.onrender.com';
  const port = Number(env.VITE_PORT || 3000);
  const proxy = {
    '/api': { target, changeOrigin: true, secure: false },
    '/uploads': { target, changeOrigin: true, secure: false },
    '/socket.io': { target, ws: true, changeOrigin: true, secure: false }
  };
  return {
    base: '/',
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(here, './src'),
        '@shared': path.resolve(here, '../shared')
      }
    },
    server: { port, strictPort: true, proxy, fs: { allow: [path.resolve(here, '..')] } },
    preview: { port, strictPort: true, proxy }
  };
});
