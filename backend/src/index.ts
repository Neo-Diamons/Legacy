import { serve } from '@hono/node-server';
import { parsePort } from '@utils/port.js';
import { driver } from '@db';
import { createApp } from './app.js';

const { app, injectWebSocket } = createApp();

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
