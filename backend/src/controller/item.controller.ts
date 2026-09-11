import { createRoute } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { itemService } from '@service/item.service.js';
import { createRouter } from '@http/app.js';
import {
  CreateItemBodySchema,
  ItemListResponseSchema,
  ItemParamsSchema,
  ItemResponseSchema,
  UpdateItemBodySchema,
} from '@schemas/item.schemas.js';
import { ErrorResponseSchema } from '@schemas/error.schemas.js';

export const itemController = createRouter();

const listItem = createRoute({
  method: 'get',
  path: '/',
  tags: ['Items'],
  summary: 'List all items',
  responses: {
    200: {
      content: { 'application/json': { schema: ItemListResponseSchema } },
      description: 'The list of items',
    },
  },
});
itemController.openapi(listItem, async (c) => {
  const items = await itemService.getItems();
  return c.json(items, 200);
});

const createItem = createRoute({
  method: 'post',
  path: '/',
  tags: ['Items'],
  summary: 'Create an item',
  request: {
    body: {
      content: { 'application/json': { schema: CreateItemBodySchema } },
    },
  },
  responses: {
    201: {
      content: { 'application/json': { schema: ItemResponseSchema } },
      description: 'The created item',
    },
    422: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation failed',
    },
  },
});
itemController.openapi(createItem, async (c) => {
  const { name } = c.req.valid('json');
  const item = {
    id: crypto.randomUUID(),
    name,
    completed: false,
  };

  await itemService.storeItem(item);
  return c.json(item, 201);
});

const updateItem = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Items'],
  summary: 'Update an item',
  request: {
    params: ItemParamsSchema,
    body: {
      content: { 'application/json': { schema: UpdateItemBodySchema } },
    },
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ItemResponseSchema } },
      description: 'The updated item',
    },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Item not found',
    },
    422: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation failed',
    },
  },
});
itemController.openapi(updateItem, async (c) => {
  const { id } = c.req.valid('param');
  const { name, completed } = c.req.valid('json');

  const changed = await itemService.updateItem(id, { name, completed });
  if (!changed) {
    throw new HTTPException(404, { message: 'Item not found' });
  }
  return c.json({ id, name, completed }, 200);
});

const deleteItem = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Items'],
  summary: 'Delete an item',
  request: {
    params: ItemParamsSchema,
  },
  responses: {
    204: { description: 'Item deleted' },
    404: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Item not found',
    },
    422: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation failed',
    },
  },
});
itemController.openapi(deleteItem, async (c) => {
  const { id } = c.req.valid('param');
  const removed = await itemService.removeItem(id);
  if (!removed) {
    throw new HTTPException(404, { message: 'Item not found' });
  }
  return c.body(null, 204);
});
