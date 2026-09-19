import { z } from '@hono/zod-openapi';
import { PRIORITIES } from '@model/priority.js';

export const PriorityEnum = z.enum(PRIORITIES).openapi('Priority');
export type PriorityValue = z.infer<typeof PriorityEnum>;

export const ItemResponseSchema = z
  .object({
    id: z.uuid().openapi({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }),
    name: z.string().openapi({ example: 'Buy milk' }),
    description: z.string().nullable().openapi({ example: 'Whole or oat milk, whichever is cheaper' }),
    completed: z.boolean().openapi({ example: false }),
    priority: PriorityEnum.openapi({ example: 'medium' }),
    dueDate: z.iso.datetime().nullable().openapi({ example: '2026-09-20T15:00:00.000Z' }),
    overdue: z.boolean().openapi({ example: false }),
    createdAt: z.iso.datetime().openapi({ example: '2026-09-18T10:00:00.000Z' }),
  })
  .openapi('Item');
export type ItemResponse = z.infer<typeof ItemResponseSchema>;

export const ItemListResponseSchema = z.array(ItemResponseSchema).openapi('ItemListResponse');
export type ItemListResponse = z.infer<typeof ItemListResponseSchema>;

export const ItemParamsSchema = z.object({
  id: z.uuid().openapi({ param: { name: 'id', in: 'path' }, example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }),
});
export type ItemParams = z.infer<typeof ItemParamsSchema>;

export const ListItemsQuerySchema = z
  .object({
    sortBy: z.enum(['name', 'priority', 'dueDate']).optional().openapi({ example: 'dueDate' }),
    sortOrder: z.enum(['asc', 'desc']).optional().openapi({ example: 'asc' }),
    priority: PriorityEnum.optional(),
    filter: z.enum(['today', 'week', 'overdue']).optional().openapi({ example: 'today' }),
  })
  .strict()
  .openapi('ListItemsQuery');
export type ListItemsQuery = z.infer<typeof ListItemsQuerySchema>;

export const CreateItemBodySchema = z
  .object({
    name: z.string().openapi({ example: 'Buy milk' }),
    description: z.string().nullable().optional().openapi({ example: 'Whole or oat milk, whichever is cheaper' }),
    priority: PriorityEnum.optional().openapi({ example: 'medium' }),
    dueDate: z.iso.datetime().nullable().optional().openapi({ example: '2026-09-20T15:00:00.000Z' }),
  })
  .strict()
  .openapi('CreateItem');
export type CreateBodyItem = z.infer<typeof CreateItemBodySchema>;

export const UpdateItemBodySchema = z
  .object({
    name: z.string().openapi({ example: 'Buy milk' }),
    description: z.string().nullable().optional().openapi({ example: 'Whole or oat milk, whichever is cheaper' }),
    completed: z.boolean().openapi({ example: true }),
    priority: PriorityEnum.optional().openapi({ example: 'urgent' }),
    dueDate: z.iso.datetime().nullable().optional().openapi({ example: null }),
  })
  .strict()
  .openapi('UpdateItem');
export type UpdateBodyItem = z.infer<typeof UpdateItemBodySchema>;
