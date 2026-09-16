import { createNodeWebSocket } from '@hono/node-ws';
import type { OpenAPIHono } from '@hono/zod-openapi';
import type { WSContext } from 'hono/ws';

export interface ItemPayload {
  id: string;
  name: string;
  completed: boolean;
}

export type ItemEvent =
  | { type: 'item.created'; item: ItemPayload }
  | { type: 'item.updated'; item: ItemPayload }
  | { type: 'item.deleted'; id: string };

export const clients = new Set<WSContext>();

export function registerWebSocket(app: OpenAPIHono) {
  const { injectWebSocket, upgradeWebSocket } = createNodeWebSocket({ app });

  app.get(
    '/ws',
    upgradeWebSocket(() => ({
      onOpen(_event, ws) {
        clients.add(ws);
      },
      onClose(_event, ws) {
        clients.delete(ws);
      },
    }))
  );

  return injectWebSocket;
}

export function broadcastItemEvent(event: ItemEvent) {
  const payload = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === 1) {
      client.send(payload);
    }
  }
}
