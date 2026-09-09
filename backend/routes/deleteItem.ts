import type { Context } from 'hono';
import { removeItem } from '../persistence/index.js';

export default async (c: Context) => {
  await removeItem(c.req.param('id')!);
  return c.body(null, 200);
};
