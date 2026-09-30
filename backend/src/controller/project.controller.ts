import { createRoute } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { createRouter } from '@http/app.js';
import { getAuthenticatedUserId } from '@http/identity.js';
import { projectService, type Project } from '@service/project.service.js';
import { ErrorResponseSchema } from '@schemas/error.schemas.js';
import { ProjectBodySchema, ProjectParamsSchema, ProjectResponseSchema } from '@schemas/project.schemas.js';

export const projectController = createRouter();

function serializeProject(project: Project) {
  return { id: project.id, name: project.name, color: project.color, createdAt: project.createdAt.toISOString() };
}

const list = createRoute({
  method: 'get',
  path: '/',
  tags: ['Projects'],
  summary: 'List projects',
  responses: {
    200: { content: { 'application/json': { schema: ProjectResponseSchema.array() } }, description: 'Projects' },
  },
});
projectController.openapi(list, async (c) =>
  c.json((await projectService.getProjects(getAuthenticatedUserId(c))).map(serializeProject), 200)
);

const create = createRoute({
  method: 'post',
  path: '/',
  tags: ['Projects'],
  summary: 'Create a project',
  request: { body: { content: { 'application/json': { schema: ProjectBodySchema } } } },
  responses: { 201: { content: { 'application/json': { schema: ProjectResponseSchema } }, description: 'Created' } },
});
projectController.openapi(create, async (c) => {
  const project: Project = {
    id: crypto.randomUUID(),
    userId: getAuthenticatedUserId(c),
    ...c.req.valid('json'),
    createdAt: new Date(),
  };
  await projectService.createProject(project);
  return c.json(serializeProject(project), 201);
});

const update = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Projects'],
  summary: 'Update a project',
  request: { params: ProjectParamsSchema, body: { content: { 'application/json': { schema: ProjectBodySchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: ProjectResponseSchema } }, description: 'Updated' },
    404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Not found' },
  },
});
projectController.openapi(update, async (c) => {
  const userId = getAuthenticatedUserId(c);
  const { id } = c.req.valid('param');
  if (!(await projectService.updateProject(id, userId, c.req.valid('json'))))
    throw new HTTPException(404, { message: 'Project not found' });
  const project = await projectService.getProject(id, userId);
  if (!project) throw new HTTPException(404, { message: 'Project not found' });
  return c.json(serializeProject(project), 200);
});

const remove = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Projects'],
  summary: 'Delete a project',
  request: { params: ProjectParamsSchema },
  responses: {
    204: { description: 'Deleted' },
    404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Not found' },
  },
});
projectController.openapi(remove, async (c) => {
  if (!(await projectService.deleteProject(c.req.valid('param').id, getAuthenticatedUserId(c))))
    throw new HTTPException(404, { message: 'Project not found' });
  return c.body(null, 204);
});
