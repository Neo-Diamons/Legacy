import type { Context } from 'hono';
import { itemService } from '../service/item.service.js';

export default async (c: Context) => {
  const items = await itemService.getItems();
  return c.json(items);
};
