import { z } from '@hono/zod-openapi';

export const ErrorResponseSchema = z
  .object({
    message: z.string().openapi({ example: 'Item not found' }),
    issues: z
      .array(
        z.object({
          path: z.array(z.string()),
          message: z.string(),
        })
      )
      .optional()
      .openapi({ description: 'Present on validation failures (422)' }),
  })
  .openapi('ErrorResponse');

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
