import { z } from '@hono/zod-openapi';

export const ItemResponseSchema = z
  .object({
    id: z.uuid().openapi({ example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }),
    name: z.string().openapi({ example: 'Buy milk' }),
    completed: z.boolean().openapi({ example: false }),
  })
  .openapi('Item');
export type ItemResponse = z.infer<typeof ItemResponseSchema>;

export const ItemListSchema = z.array(ItemResponseSchema).openapi('ItemList');
export type ItemList = z.infer<typeof ItemListSchema>;

export const CreateItemBodySchema = z
  .object({
    name: z.string().openapi({ example: 'Buy milk' }),
  })
  .strict()
  .openapi('CreateItem');
export type CreateBodyItem = z.infer<typeof CreateItemBodySchema>;

export const UpdateItemBodySchema = z
  .object({
    name: z.string().openapi({ example: 'Buy milk' }),
    completed: z.boolean().openapi({ example: true }),
  })
  .strict()
  .openapi('UpdateItem');
export type UpdateBodyItem = z.infer<typeof UpdateItemBodySchema>;

export const ItemParamsSchema = z.object({
  id: z.uuid().openapi({ param: { name: 'id', in: 'path' }, example: '3fa85f64-5717-4562-b3fc-2c963f66afa6' }),
});
export type ItemParams = z.infer<typeof ItemParamsSchema>;
