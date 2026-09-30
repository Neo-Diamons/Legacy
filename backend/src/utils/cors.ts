import { parsePort } from '@utils/port.js';

export function parseAllowedOrigins(value: string | undefined, frontendPort: number): string[] {
  const entries = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return [`http://localhost:${frontendPort}`, `http://127.0.0.1:${frontendPort}`];

  return entries.map((entry) => {
    let url: URL;
    try {
      url = new URL(entry);
    } catch {
      throw new Error(`Invalid CORS origin ${JSON.stringify(entry)}: expected e.g. https://app.example.com`);
    }
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error(`Invalid CORS origin ${JSON.stringify(entry)}: only http and https are allowed`);
    }
    if (url.pathname !== '/' || url.search || url.hash) {
      throw new Error(`Invalid CORS origin ${JSON.stringify(entry)}: no path, query or fragment allowed`);
    }
    return url.origin;
  });
}

export function resolveAllowedOrigins(env: NodeJS.ProcessEnv = process.env): string[] {
  return parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS, parsePort(env.FRONTEND_PORT, 5173));
}
