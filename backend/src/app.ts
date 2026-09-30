import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { Scalar } from '@scalar/hono-api-reference';
import { itemController } from '@controller/item.controller.js';
import { projectController } from '@controller/project.controller.js';
import { authController, userController } from '@controller/user.controller.js';
import { createRouter, registerErrorHandler } from '@http/app.js';
import { jwtAuth } from '@http/auth.js';
import { resolveAllowedOrigins } from '@utils/cors.js';
import { registerWebSocket } from '@ws/broadcast.js';

export function createApp({ log = true }: { log?: boolean } = {}) {
  const app = createRouter();

  app.use(cors({ origin: resolveAllowedOrigins() }));
  if (log) app.use(logger());

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.use('/items/*', jwtAuth());
  app.use('/items', jwtAuth());
  app.route('/items', itemController);
  app.route('/auth', authController);
  app.route('/users', userController);
  app.use('/projects/*', jwtAuth());
  app.use('/projects', jwtAuth());
  app.route('/projects', projectController);

  const injectWebSocket = registerWebSocket(app);

  registerErrorHandler(app);

  app.use('/doc', jwtAuth());
  app.doc('/doc', {
    openapi: '3.0.0',
    info: {
      version: '1.0.0',
      title: 'Legacy',
    },
  });
  app.use('/scalar', jwtAuth());
  app.get(
    '/scalar',
    Scalar({
      url: '/doc',
      hideClientButton: true,
      agent: {
        disabled: true,
      },
      mcp: {
        disabled: true,
      },
    })
  );

  return { app, injectWebSocket };
}
