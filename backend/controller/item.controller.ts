import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import { itemService } from '@service/item.service.js';

const itemController = new Hono();

itemController.get('/', async (c) => {
  const items = await itemService.getItems();
  return c.json(items);
});

itemController.post('/', async (c) => {
  const body = await c.req.json();
  const item = {
    id: uuid(),
    name: body.name,
    completed: false,
  };

  await itemService.storeItem(item);
  return c.json(item);
});

itemController.put('/:id', async (c) => {
  const id = c.req.param('id');
  const body = await c.req.json();

  await itemService.updateItem(id, {
    name: body.name,
    completed: body.completed,
  });
  const item = await itemService.getItem(id);
  return c.json(item);
});

itemController.delete('/:id', async (c) => {
  await itemService.removeItem(c.req.param('id'));
  return c.body(null, 200);
});

export { itemController };
