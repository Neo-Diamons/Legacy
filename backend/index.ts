import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serve } from '@hono/node-server';
import '@db';
import getItems from './routes/getItems.js';
import addItem from './routes/addItem.js';
import updateItem from './routes/updateItem.js';
import deleteItem from './routes/deleteItem.js';

const app = new Hono();

app.use(cors());

app.get('/items', getItems);
app.post('/items', addItem);
app.put('/items/:id', updateItem);
app.delete('/items/:id', deleteItem);

serve(
  {
    fetch: app.fetch,
    port: 3000,
  },
  (info) => {
    console.log(`Server is running on http://localhost:${info.port}`);
  }
);
