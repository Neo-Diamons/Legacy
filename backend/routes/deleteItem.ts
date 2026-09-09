import type { Context } from 'hono';
import { itemService } from '../service/item.service.js';

export default async (c: Context) => {
  await itemService.removeItem(c.req.param('id')!);
  return c.body(null, 200);
};
