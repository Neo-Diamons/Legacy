import { timingSafeEqual } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { prometheus } from '@hono/prometheus';
import { Counter, Registry } from 'prom-client';

export const registry = new Registry();

// HTTP request count/latency (http_requests_total, http_request_duration_seconds) + Node defaults.
export const { registerMetrics: httpMetrics } = prometheus({
  registry,
  prefix: 'legacy_',
  collectDefaultMetrics: true,
});

export const wsConnections = new Counter({
  name: 'legacy_ws_connections_total',
  help: 'WebSocket connections opened',
  registers: [registry],
});

export const wsDisconnections = new Counter({
  name: 'legacy_ws_disconnections_total',
  help: 'WebSocket connections closed',
  labelNames: ['reason'],
  registers: [registry],
});

export const wsTickets = new Counter({
  name: 'legacy_ws_tickets_total',
  help: 'WebSocket one-time tickets by outcome',
  labelNames: ['result'],
  registers: [registry],
});

export const eventsProduced = new Counter({
  name: 'legacy_events_produced_total',
  help: 'Item events produced by the API',
  labelNames: ['type'],
  registers: [registry],
});

export const eventsDelivered = new Counter({
  name: 'legacy_events_delivered_total',
  help: 'Item events delivered to WebSocket consumers',
  labelNames: ['type'],
  registers: [registry],
});

function tokenMatches(header: string | undefined, token: string) {
  const given = Buffer.from(header?.replace(/^Bearer /, '') ?? '');
  const expected = Buffer.from(token);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

export const metricsHandler: MiddlewareHandler = async (c) => {
  const token = process.env.METRICS_TOKEN;
  if (token && !tokenMatches(c.req.header('authorization'), token)) {
    return c.json({ message: 'Authentication required' }, 401);
  }
  return c.text(await registry.metrics(), 200, { 'Content-Type': registry.contentType });
};
