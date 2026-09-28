import { sign } from 'hono/jwt';
import { createRoute } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';
import { createRouter } from '@http/app.js';
import { jwtAuth, getJwtSecret } from '@http/auth.js';
import { hashPassword, verifyPassword } from '@utils/password.js';
import { userService, type User } from '@service/user.service.js';
import {
  LoginBodySchema,
  RegisterUserBodySchema,
  TokenResponseSchema,
  UpdateUserBodySchema,
  UserParamsSchema,
  UserResponseSchema,
  UserExportResponseSchema,
  type UpdateUserBody,
} from '@schemas/user.schemas.js';
import { ErrorResponseSchema } from '@schemas/error.schemas.js';
import { requireOwnUser } from '@http/identity.js';

export const authController = createRouter();
export const userController = createRouter();

function serializeUser(user: User) {
  return { id: user.id, email: user.email, name: user.name, createdAt: user.createdAt.toISOString() };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function issueToken(user: User) {
  return sign({ sub: user.id, email: user.email, exp: Math.floor(Date.now() / 1000) + 60 * 60 }, getJwtSecret());
}

const register = createRoute({
  method: 'post',
  path: '/register',
  tags: ['Auth'],
  summary: 'Register a user',
  request: { body: { content: { 'application/json': { schema: RegisterUserBodySchema } } } },
  responses: {
    201: { content: { 'application/json': { schema: TokenResponseSchema } }, description: 'Created' },
    409: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Email exists' },
  },
});
authController.openapi(register, async (c) => {
  const body = c.req.valid('json');
  const email = normalizeEmail(body.email);
  if (await userService.getUserByEmail(email)) throw new HTTPException(409, { message: 'Email already registered' });
  const user: User = {
    id: crypto.randomUUID(),
    email,
    name: body.name,
    passwordHash: await hashPassword(body.password),
    createdAt: new Date(),
  };
  await userService.createUser(user);
  return c.json({ token: await issueToken(user), user: serializeUser(user) }, 201);
});

const login = createRoute({
  method: 'post',
  path: '/login',
  tags: ['Auth'],
  summary: 'Log in',
  request: { body: { content: { 'application/json': { schema: LoginBodySchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: TokenResponseSchema } }, description: 'Authenticated' },
    401: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Invalid credentials' },
  },
});
authController.openapi(login, async (c) => {
  const body = c.req.valid('json');
  const user = await userService.getUserByEmail(normalizeEmail(body.email));
  if (!user || !(await verifyPassword(body.password, user.passwordHash)))
    throw new HTTPException(401, { message: 'Invalid credentials' });
  return c.json({ token: await issueToken(user), user: serializeUser(user) }, 200);
});

userController.use('*', jwtAuth());

const list = createRoute({
  method: 'get',
  path: '/',
  tags: ['Users'],
  summary: 'Get the authenticated user',
  responses: { 200: { content: { 'application/json': { schema: UserResponseSchema.array() } }, description: 'User' } },
});
userController.openapi(list, async (c) => {
  const user = await userService.getUser((c.get('jwtPayload') as { sub: string }).sub);
  return c.json(user ? [serializeUser(user)] : [], 200);
});

const get = createRoute({
  method: 'get',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Get a user',
  request: { params: UserParamsSchema },
  responses: {
    200: { content: { 'application/json': { schema: UserResponseSchema } }, description: 'User' },
    404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Not found' },
  },
});
userController.openapi(get, async (c) => {
  const user = await userService.getUser(requireOwnUser(c, c.req.valid('param').id));
  if (!user) throw new HTTPException(404, { message: 'User not found' });
  return c.json(serializeUser(user), 200);
});

const update = createRoute({
  method: 'put',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Update a user',
  request: { params: UserParamsSchema, body: { content: { 'application/json': { schema: UpdateUserBodySchema } } } },
  responses: {
    200: { content: { 'application/json': { schema: UserResponseSchema } }, description: 'Updated user' },
    404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Not found' },
  },
});
userController.openapi(update, async (c) => {
  const id = requireOwnUser(c, c.req.valid('param').id);
  const body: UpdateUserBody = c.req.valid('json');
  const changed = await userService.updateUser(id, {
    email: body.email ? normalizeEmail(body.email) : undefined,
    name: body.name,
    passwordHash: body.password ? await hashPassword(body.password) : undefined,
  });
  if (!changed) throw new HTTPException(404, { message: 'User not found' });
  const user = await userService.getUser(id);
  if (!user) throw new HTTPException(404, { message: 'User not found' });
  return c.json(serializeUser(user), 200);
});

const remove = createRoute({
  method: 'delete',
  path: '/{id}',
  tags: ['Users'],
  summary: 'Delete a user',
  request: { params: UserParamsSchema },
  responses: {
    204: { description: 'Deleted' },
    404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Not found' },
  },
});
userController.openapi(remove, async (c) => {
  if (!(await userService.deleteUser(requireOwnUser(c, c.req.valid('param').id))))
    throw new HTTPException(404, { message: 'User not found' });
  return c.body(null, 204);
});

const exportData = createRoute({
  method: 'get',
  path: '/{id}/export',
  tags: ['Users'],
  summary: 'Export personal data',
  request: { params: UserParamsSchema },
  responses: {
    200: { content: { 'application/json': { schema: UserExportResponseSchema } }, description: 'Personal data export' },
    404: { content: { 'application/json': { schema: ErrorResponseSchema } }, description: 'Not found' },
  },
});
userController.openapi(exportData, async (c) => {
  const data = await userService.exportUserData(requireOwnUser(c, c.req.valid('param').id));
  if (!data) throw new HTTPException(404, { message: 'User not found' });
  return c.json({ user: serializeUser(data.user), projects: data.projects, items: data.items }, 200);
});
