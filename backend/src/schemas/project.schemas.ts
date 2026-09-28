import { z } from '@hono/zod-openapi';

export const ProjectResponseSchema = z
  .object({
    id: z.uuid(),
    name: z.string(),
    color: z.string(),
    createdAt: z.iso.datetime(),
  })
  .openapi('Project');

export const ProjectBodySchema = z
  .object({
    name: z.string().min(1),
    color: z.string().min(1).max(32),
  })
  .strict()
  .openapi('ProjectBody');

export const ProjectParamsSchema = z.object({ id: z.uuid() });
