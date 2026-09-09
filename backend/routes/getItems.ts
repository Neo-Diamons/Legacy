import type { Context } from 'hono';
import { getItems } from '../persistence/index.js';

export default async (c: Context) => {
  const items = await getItems();
  return c.json(items);
};
