import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { Scalar } from '@scalar/hono-api-reference';
import { parsePort } from '@utils/port.js';
import { driver } from '@db';
import { itemController } from '@controller/item.controller.js';
import { createRouter, registerErrorHandler } from '@http/app.js';
import { registerWebSocket } from '@ws/broadcast.js';

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

const injectWebSocket = registerWebSocket(app);

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

const backendPort = parsePort(process.env.BACKEND_PORT, 3000);

const server = serve(
  {
    fetch: app.fetch,
    port: backendPort,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);

injectWebSocket(server);

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${backendPort} is already in use`);
  } else {
    console.error('HTTP server error', err);
  }
  process.exit(1);
});

let shuttingDown = false;

async function shutdown(signal: NodeJS.Signals) {
  if (shuttingDown) return;
  shuttingDown = true;

  console.error(`Received ${signal}, shutting down...`);

  setTimeout(() => {
    console.error('Shutdown timed out, forcing exit');
    if ('closeAllConnections' in server) server.closeAllConnections();
    process.exit(1);
  }, 5_000).unref();

  await new Promise<void>((resolve) => {
    server.close((err) => {
      if (err) {
        console.error('Error closing HTTP server', err);
        process.exitCode = 1;
      }
      resolve();
    });
    if ('closeIdleConnections' in server) server.closeIdleConnections();
  });

  try {
    await driver.teardown();
  } catch (err) {
    console.error('Error during database teardown', err);
    process.exitCode = 1;
  }

  process.exit(process.exitCode ?? 0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
