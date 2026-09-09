import type { Context } from 'hono';
import { itemService } from '../service/item.service.js';
import { v4 as uuid } from 'uuid';

export default async (c: Context) => {
  const body = await c.req.json();
  const item = {
    id: uuid(),
    name: body.name,
    completed: false,
  };

  await itemService.storeItem(item);
  return c.json(item);
};
