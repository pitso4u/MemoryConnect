import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { trustProxy } from '../lib/trustProxy';

function ipEchoApp() {
  const app = express();
  app.set('trust proxy', trustProxy);
  app.get('/echo', (req, res) => {
    res.json({ ip: req.ip });
  });
  return app;
}

describe('trust proxy configuration (verified Cloudflare -> Traefik -> API chain)', () => {
  it('resolves the real client IP for Cloudflare traffic (X-Forwarded-For: <client>, <cf edge>)', async () => {
    // Traefik preserves Cloudflare's XFF and appends its own Cloudflare peer IP.
    const res = await request(ipEchoApp()).get('/echo').set('X-Forwarded-For', '196.25.45.7, 104.21.49.46');
    expect(res.body.ip).toBe('196.25.45.7');
  });

  it('resolves a real client over an IPv6 Cloudflare edge', async () => {
    const res = await request(ipEchoApp()).get('/echo').set('X-Forwarded-For', '196.25.45.7, 2606:4700::1234');
    expect(res.body.ip).toBe('196.25.45.7');
  });

  it('resolves the peer IP for a direct (non-Cloudflare) peer whose XFF was overwritten by Traefik', async () => {
    // Traefik does not trust forwarded headers from a direct origin, so it sets
    // X-Forwarded-For to the connection's real IP (single value here).
    const res = await request(ipEchoApp()).get('/echo').set('X-Forwarded-For', '5.6.7.8');
    expect(res.body.ip).toBe('5.6.7.8');
  });

  it('does not trust a non-Cloudflare hop in the middle of the chain', async () => {
    // Only Cloudflare ranges are trusted as intermediate hops; a forged non-CF
    // proxy IP is treated as the client.
    const res = await request(ipEchoApp()).get('/echo').set('X-Forwarded-For', '196.25.45.7, 203.0.113.9');
    expect(res.body.ip).toBe('203.0.113.9');
  });

  it('falls back to the socket address when there is no forwarded header', async () => {
    const res = await request(ipEchoApp()).get('/echo');
    expect(res.body.ip).toMatch(/127\.0\.0\.1/);
  });
});
