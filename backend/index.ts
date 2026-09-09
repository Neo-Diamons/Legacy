import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import '@db';
import { itemController } from '@controller/item.controller.js';

const app = new Hono();

app.use(cors());

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
