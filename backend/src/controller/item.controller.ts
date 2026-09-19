import { createRoute } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { itemService, type Item } from '@service/item.service.js';
import { createRouter } from '@http/app.js';
import {
  CreateItemBodySchema,
  ItemListResponseSchema,
  ItemParamsSchema,
  ItemResponseSchema,
  ListItemsQuerySchema,
  UpdateItemBodySchema,
  type CreateBodyItem,
  type ItemResponse,
  type UpdateBodyItem,
} from '@schemas/item.schemas.js';
import { ErrorResponseSchema } from '@schemas/error.schemas.js';
import { broadcastItemEvent } from '@ws/broadcast.js';

export const itemController = createRouter();

function serializeItem(item: Item): ItemResponse {
  return {
    ...item,
    dueDate: item.dueDate ? item.dueDate.toISOString() : null,
    overdue: !!item.dueDate && !item.completed && item.dueDate.getTime() < Date.now(),
    createdAt: item.createdAt.toISOString(),
  };
}

function normalizeCreateInput(body: CreateBodyItem) {
  return {
    name: body.name,
    description: body.description ?? null,
    priority: body.priority ?? ('medium' as const),
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
  };
}

function normalizeUpdateInput(body: UpdateBodyItem) {
  return {
    name: body.name,
    completed: body.completed,
    description: body.description ?? null,
    priority: body.priority ?? ('medium' as const),
    dueDate: body.dueDate ? new Date(body.dueDate) : null,
  };
}

const listItem = createRoute({
  method: 'get',
  path: '/',
  tags: ['Items'],
  summary: 'List all items',
  request: {
    query: ListItemsQuerySchema,
  },
  responses: {
    200: {
      content: { 'application/json': { schema: ItemListResponseSchema } },
      description: 'The list of items',
    },
    422: {
      content: { 'application/json': { schema: ErrorResponseSchema } },
      description: 'Validation failed',
    },
  },
});
itemController.openapi(listItem, async (c) => {
  const query = c.req.valid('query');
  const items = await itemService.getItems(query);
  return c.json(items.map(serializeItem), 200);
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
  const body = c.req.valid('json');
  const item: Item = {
    id: crypto.randomUUID(),
    completed: false,
    createdAt: new Date(),
    ...normalizeCreateInput(body),
  };

  await itemService.storeItem(item);
  const response = serializeItem(item);
  broadcastItemEvent({ type: 'item.created', item: response });
  return c.json(response, 201);
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
  const body = c.req.valid('json');

  const update = normalizeUpdateInput(body);
  const changed = await itemService.updateItem(id, update);
  if (!changed) {
    throw new HTTPException(404, { message: 'Item not found' });
  }

  const updated = await itemService.getItem(id);
  if (!updated) {
    throw new HTTPException(404, { message: 'Item not found' });
  }

  const response = serializeItem(updated);
  broadcastItemEvent({ type: 'item.updated', item: response });
  return c.json(response, 200);
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
  broadcastItemEvent({ type: 'item.deleted', id });
  return c.body(null, 204);
});
