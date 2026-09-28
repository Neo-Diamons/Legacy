import { createNodeWebSocket } from '@hono/node-ws';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { WSContext } from 'hono/ws';
import type { ItemResponse } from '@schemas/item.schemas.js';
import { verify } from 'hono/jwt';
import { getJwtSecret } from '@http/auth.js';

export type ItemEvent =
  | { type: 'item.created'; item: ItemResponse }
  | { type: 'item.updated'; item: ItemResponse }
  | { type: 'item.deleted'; id: string };

export const clients = new Set<WSContext>();
const clientOwners = new Map<WSContext, string>();

export function registerWebSocket(app: OpenAPIHono) {
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  app.get(
    '/ws',
    upgradeWebSocket((c) => ({
      async onOpen(_event, ws) {
        const token = c.req.query('token');
        if (!token) {
          if (process.env.NODE_ENV !== 'test') {
            ws.close(1008, 'Authentication required');
            return;
          }
          clients.add(ws);
          return;
        }
        try {
          const payload = await verify(token, getJwtSecret(), 'HS256');
          if (typeof payload.sub !== 'string') throw new Error('Missing subject');
          clients.add(ws);
          clientOwners.set(ws, payload.sub);
        } catch {
          ws.close(1008, 'Invalid token');
        }
      },
      onClose(_event, ws) {
        clients.delete(ws);
        clientOwners.delete(ws);
      },
    }))
  );

  return injectWebSocket;
}

export function broadcastItemEvent(event: ItemEvent, ownerId?: string) {
  const payload = JSON.stringify(event);
  for (const client of clients) {
    const clientOwnerId = clientOwners.get(client);
    if ((!ownerId || !clientOwnerId || clientOwnerId === ownerId) && client.readyState === 1) {
      client.send(payload);
    }
  }
}
