import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import { Scalar } from '@scalar/hono-api-reference';
import { parsePort } from '@utils/port.js';
import '@db';
import { itemController } from '@controller/item.controller.js';
import { createRouter, registerErrorHandler } from '@http/app.js';

const app = createRouter();

app.use(cors());
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
