import type { Context } from 'hono';
import { Hono } from 'hono';
import { v4 as uuid } from 'uuid';
import { itemService } from '@service/item.service.js';

const getItems = async (c: Context) => {
  const items = await itemService.getItems();
  return c.json(items);
};

const addItem = async (c: Context) => {
  const body = await c.req.json();
  const item = {
    id: uuid(),
    name: body.name,
    completed: false,
  };

  await itemService.storeItem(item);
  return c.json(item);
};

const updateItem = async (c: Context) => {
  const id = c.req.param('id')!;
  const body = await c.req.json();

  await itemService.updateItem(id, {
    name: body.name,
    completed: body.completed,
  });
  const item = await itemService.getItem(id);
  return c.json(item);
};

const deleteItem = async (c: Context) => {
  await itemService.removeItem(c.req.param('id')!);
  return c.body(null, 200);
};

const itemController = new Hono();

itemController.get('/', getItems);
itemController.post('/', addItem);
itemController.put('/:id', updateItem);
itemController.delete('/:id', deleteItem);

export { itemController };
