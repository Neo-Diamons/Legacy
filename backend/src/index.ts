import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import '@db';
import { itemController } from '@controller/item.controller.js';
import { createRouter, registerErrorHandler } from '@http/app.js';

const app = createRouter();

app.use(cors());
app.use(logger());

app.route('/items', itemController);

registerErrorHandler(app);

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
