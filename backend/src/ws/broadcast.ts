import { createNodeWebSocket } from '@hono/node-ws';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { WSContext } from 'hono/ws';
import type { ItemResponse } from '@schemas/item.schemas.js';
import { HTTPException } from 'hono/http-exception';
import { verifyToken } from '@http/auth.js';

declare module 'hono' {
  interface ContextVariableMap {
    wsOwnerId: string;
  }
}

export type ItemEvent =
  | { type: 'item.created'; item: ItemResponse }
  | { type: 'item.updated'; item: ItemResponse }
  | { type: 'item.deleted'; id: string };

export const clients = new Set<WSContext>();
export const clientOwners = new Map<WSContext, string>();

export function registerWebSocket(app: OpenAPIHono) {
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  app.get(
    '/ws',
    async (c, next) => {
      const token = c.req.query('token');
      if (!token) throw new HTTPException(401, { message: 'Authentication required' });
      try {
        c.set('wsOwnerId', await verifyToken(token));
      } catch {
        throw new HTTPException(401, { message: 'Invalid token' });
      }
      await next();
    },
    upgradeWebSocket((c) => {
      const ownerId = c.get('wsOwnerId');
      return {
        onOpen(_event, ws) {
          clients.add(ws);
          clientOwners.set(ws, ownerId);
        },
        onClose(_event, ws) {
          clients.delete(ws);
          clientOwners.delete(ws);
        },
      };
    })
  );

  return injectWebSocket;
}

export function broadcastItemEvent(event: ItemEvent, ownerId: string) {
  const payload = JSON.stringify(event);
  for (const client of clients) {
    if (clientOwners.get(client) === ownerId && client.readyState === 1) {
      client.send(payload);
    }
  }
}
