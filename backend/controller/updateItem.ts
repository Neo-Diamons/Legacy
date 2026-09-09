import type { Context } from 'hono';
import { itemService } from '@service/item.service.js';

export default async (c: Context) => {
  const id = c.req.param('id')!;
  const body = await c.req.json();

  await itemService.updateItem(id, {
    name: body.name,
    completed: body.completed,
  });
  const item = await itemService.getItem(id);
  return c.json(item);
};
