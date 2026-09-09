import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { serve } from '@hono/node-server';
import '@db';
import { itemController } from '@controller/item.controller.js';

const app = new Hono();

app.use(cors());
app.use(logger());

app.route('/items', itemController);

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
