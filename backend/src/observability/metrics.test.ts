import { app, call, seedUser } from '../test/fixtures.js';
import { resetDb } from '../test/db.js';
import { wsTickets } from './metrics.js';

beforeEach(resetDb);
afterEach(() => vi.unstubAllEnvs());

describe('GET /metrics', () => {
  it('exposes prometheus text with http and websocket metrics', async () => {
    const alice = await seedUser('alice@example.com');
    await call(alice, 'POST', '/ws/ticket');

    const res = await app.request('/metrics');
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/plain');
    expect(body).toMatch(/legacy_http_requests_total\{[^}]*route="\/ws\/ticket"/);
    expect(body).toContain('legacy_ws_active_connections 0');
    expect(body).toContain('legacy_ws_connected_users 0');
    expect(body).toContain('legacy_ws_tickets_total{result="issued"}');
    expect(body).toContain('legacy_process_cpu_user_seconds_total');
  });

  it('counts rejected tickets', async () => {
    await app.request('/ws?ticket=nope');
    expect(await wsTickets.get()).toMatchObject({
      values: expect.arrayContaining([expect.objectContaining({ labels: { result: 'rejected' } })]),
    });
  });

  it('requires the bearer token when METRICS_TOKEN is set', async () => {
    vi.stubEnv('METRICS_TOKEN', 'scrape-secret');
    expect((await app.request('/metrics')).status).toBe(401);
    expect((await app.request('/metrics', { headers: { Authorization: 'Bearer wrong' } })).status).toBe(401);
    expect((await app.request('/metrics', { headers: { Authorization: 'Bearer scrape-secret' } })).status).toBe(200);
  });
});
