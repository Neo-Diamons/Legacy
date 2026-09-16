import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

const repoRoot = fileURLToPath(new URL('..', import.meta.url));

function parsePort(value: string | undefined, fallback: number): number {
  if (value == null || value.trim() === '') return fallback;
  const trimmed = value.trim();
  const port = Number.parseInt(trimmed, 10);
  if (!Number.isInteger(port) || String(port) !== trimmed || port < 1 || port > 65535) {
    throw new Error(`Invalid port ${JSON.stringify(value)}: expected an integer between 1 and 65535`);
  }
  return port;
}

export default defineConfig(({ mode }) => {
  const env = {
    ...process.env,
    ...loadEnv(mode, repoRoot, ['BACKEND_PORT', 'FRONTEND_PORT', 'BACKEND_URL']),
  };
  const backendPort = parsePort(env.BACKEND_PORT, 3000);
  const backendUrl = env.BACKEND_URL?.trim() || `http://localhost:${backendPort}`;

  const proxy = {
    '/items': backendUrl,
    '/ws': { target: backendUrl, ws: true },
  };

  return {
    plugins: [react()],
    server: {
      port: parsePort(env.FRONTEND_PORT, 5173),
      proxy,
    },
    preview: {
      port: parsePort(env.FRONTEND_PORT, 4173),
      proxy,
    },
  };
});
