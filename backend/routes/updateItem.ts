import type { Context } from 'hono';
import { updateItem, getItem } from '../persistence/index.js';

export default async (c: Context) => {
  const id = c.req.param('id')!;
  const body = await c.req.json();

  await updateItem(id, {
    name: body.name,
    completed: body.completed,
  });
  const item = await getItem(id);
  return c.json(item);
};
