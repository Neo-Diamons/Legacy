import { createNodeWebSocket } from '@hono/node-ws';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { WSContext } from 'hono/ws';
import type { ItemResponse } from '@schemas/item.schemas.js';
import { HTTPException } from 'hono/http-exception';
import { jwtAuth } from '@http/auth.js';
import { issueWsTicket, redeemWsTicket } from '@ws/ticket.js';

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

  app.post('/ws/ticket', jwtAuth(), (c) => {
    const { sub, tv } = c.get('jwtPayload') as { sub: string; tv: number };
    return c.json({ ticket: issueWsTicket(sub, tv) }, 200);
  });

  app.get(
    '/ws',
    async (c, next) => {
      const ticket = c.req.query('ticket');
      if (!ticket) throw new HTTPException(401, { message: 'Authentication required' });

      const ownerId = await redeemWsTicket(ticket);
      if (!ownerId) throw new HTTPException(401, { message: 'Invalid ticket' });

      c.set('wsOwnerId', ownerId);
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

export function disconnectUser(ownerId: string) {
  for (const [client, owner] of clientOwners) {
    if (owner !== ownerId) continue;
    clients.delete(client);
    clientOwners.delete(client);
    client.close(1008, 'Session revoked');
  }
}
