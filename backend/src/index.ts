import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { Scalar } from '@scalar/hono-api-reference';
import { parsePort } from '@utils/port.js';
import '@db';
import { itemController } from '@controller/item.controller.js';
import { createRouter, registerErrorHandler } from '@http/app.js';

const app = createRouter();

const frontendPort = parsePort(process.env.FRONTEND_PORT, 5173);
const defaultOrigins = [`http://localhost:${frontendPort}`, `http://127.0.0.1:${frontendPort}`];

function parseAllowedOrigins(value: string | undefined): string[] {
  const entries = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return defaultOrigins;

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

const allowedOrigins = parseAllowedOrigins(process.env.CORS_ALLOWED_ORIGINS);

app.use(cors({ origin: allowedOrigins }));
app.use(logger());

app.route('/items', itemController);

registerErrorHandler(app);

app.doc('/doc', {
  openapi: '3.0.0',
  info: {
    version: '1.0.0',
    title: 'Legacy',
  },
});
app.get(
  '/scalar',
  Scalar({
    url: '/doc',
    hideClientButton: true,
    agent: {
      disabled: true,
    },
    mcp: {
      disabled: true,
    },
  })
);

serve(
  {
    fetch: app.fetch,
    port: parsePort(process.env.BACKEND_PORT, 3000),
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
