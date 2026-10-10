import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { closeApiServer, createApiApp } from './local-api.mjs';
import { hashAdminPassword, isValidAdminPasswordHash, verifyAdminPassword } from './password.mjs';

const frontendOrigin = 'http://localhost:5173';
const adminPassword = 'local-test-password-12345';
const sessionSecret = 'test-only-session-secret-with-at-least-32-bytes';
const adminPasswordHash = await hashAdminPassword(adminPassword);

function makePool(queryImplementation) {
  return { query: vi.fn(queryImplementation), end: vi.fn(async () => {}) };
}

async function startTestApi({ pool = makePool(async (sql) => {
  if (sql === 'select 1') return { rows: [{ '?column?': 1 }] };
  if (sql.includes('insert into enquiries')) {
    return { rows: [{ id: 'enquiry-uuid', created_at: '2026-10-09T00:00:00.000Z' }] };
  }
  return { rows: [], rowCount: 1 };
}), sendEmailNotification = async () => 'disabled', sendWhatsAppNotification = async () => 'disabled' } = {}) {
  const app = createApiApp({
    pool,
    env: {
      NODE_ENV: 'test',
      ADMIN_PASSWORD_HASH: adminPasswordHash,
      ADMIN_SESSION_SECRET: sessionSecret,
      CORS_ORIGINS: frontendOrigin,
    },
    sendEmailNotification,
    sendWhatsAppNotification,
  });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  const address = server.address();
  return {
    pool,
    server,
    url: `http://127.0.0.1:${address.port}`,
  };
}

async function apiRequest(url, path, { method = 'GET', body, cookie, origin = frontendOrigin } = {}) {
  return fetch(`${url}${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function signIn(url, password = adminPassword) {
  const response = await apiRequest(url, '/api/admin/login', { method: 'POST', body: { password } });
  return {
    response,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
  };
}

async function closeApi(server) {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
}

describe('public API access controls and validation', () => {
  let api;
  afterEach(async () => {
    if (api) await closeApi(api.server);
    api = undefined;
    vi.restoreAllMocks();
  });

  it('serves public active data but not private enquiry data', async () => {
    api = await startTestApi();
    for (const path of ['/health/live', '/api/trip-data', '/api/special-trips', '/api/customer-reviews']) {
      expect((await apiRequest(api.url, path)).status).toBe(200);
    }
    expect((await apiRequest(api.url, '/api/admin-data')).status).toBe(401);
    expect((await apiRequest(api.url, '/api/enquiries')).status).toBe(404);
  });

  it('rejects unauthenticated admin reads and all management operations', async () => {
    api = await startTestApi();
    const requests = [
      ['/api/admin-data', 'GET'],
      ['/api/special-trips', 'POST', {}],
      ['/api/special-trips/test-trip', 'PUT', {}],
      ['/api/special-trips/test-trip', 'DELETE'],
      ['/api/trip-categories', 'POST', {}],
      ['/api/trip-categories/test-category', 'DELETE'],
      ['/api/destinations', 'POST', {}],
      ['/api/destinations/test-place', 'DELETE'],
      ['/api/customer-reviews', 'POST', {}],
      ['/api/customer-reviews/test-review', 'PUT', {}],
      ['/api/customer-reviews/test-review', 'DELETE'],
    ];
    for (const [path, method, body] of requests) {
      const response = await apiRequest(api.url, path, { method, body });
      expect(response.status, `${method} ${path}`).toBe(401);
    }
    expect(api.pool.query).not.toHaveBeenCalled();
  });

  it('rejects wrong admin credentials and allows authenticated administrators', async () => {
    api = await startTestApi();
    expect((await signIn(api.url, 'incorrect-password')).response.status).toBe(401);
    const { response, cookie } = await signIn(api.url);
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect((await apiRequest(api.url, '/api/admin-data', { cookie })).status).toBe(200);
    await expect((await apiRequest(api.url, '/api/admin/session', { cookie })).json()).resolves.toEqual({ authenticated: true });
  });

  it('requires a valid scrypt password hash in server configuration', () => {
    const pool = makePool(async () => ({ rows: [] }));
    expect(isValidAdminPasswordHash(adminPasswordHash)).toBe(true);
    expect(() => createApiApp({
      pool,
      env: {
        NODE_ENV: 'test',
        ADMIN_PASSWORD_HASH: adminPassword,
        ADMIN_SESSION_SECRET: sessionSecret,
        CORS_ORIGINS: frontendOrigin,
      },
    })).toThrow(/ADMIN_PASSWORD_HASH/);
  });

  it('allows an authenticated administrator to create valid content', async () => {
    api = await startTestApi();
    const { cookie } = await signIn(api.url);
    const response = await apiRequest(api.url, '/api/trip-categories', {
      method: 'POST',
      cookie,
      body: {
        id: 'test-category',
        title: 'Test category',
        subtitle: '',
        tagline: '',
        image: '',
        iconName: 'map',
        accentColor: '#0b5960',
        sortOrder: 1,
        isActive: true,
      },
    });
    expect(response.status).toBe(204);
    expect(api.pool.query).toHaveBeenCalledWith(expect.stringContaining('insert into trip_categories'), expect.any(Array));
  });

  it('rejects invalid admin content before database writes', async () => {
    api = await startTestApi();
    const { cookie } = await signIn(api.url);
    const response = await apiRequest(api.url, '/api/trip-categories', {
      method: 'POST',
      cookie,
      body: { id: '../private', title: 'Invalid category' },
    });
    expect(response.status).toBe(400);
    expect(api.pool.query).not.toHaveBeenCalled();
  });

  it('sets production admin cookies as secure, HTTP-only and cross-origin capable', async () => {
    const pool = makePool(async () => ({ rows: [] }));
    const app = createApiApp({
      pool,
      env: {
        NODE_ENV: 'production',
        ADMIN_PASSWORD_HASH: adminPasswordHash,
        ADMIN_SESSION_SECRET: sessionSecret,
        CORS_ORIGINS: 'https://www.example.com',
      },
    });
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    api = { server, url: `http://127.0.0.1:${server.address().port}` };
    const response = await apiRequest(api.url, '/api/admin/login', {
      method: 'POST',
      origin: 'https://www.example.com',
      body: { password: adminPassword },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toContain('Secure');
    expect(response.headers.get('set-cookie')).toContain('HttpOnly');
    expect(response.headers.get('set-cookie')).toContain('SameSite=None');
  });

  it('rejects non-allowlisted request origins', async () => {
    api = await startTestApi();
    const response = await apiRequest(api.url, '/api/enquiries', {
      method: 'POST',
      origin: 'https://attacker.example',
      body: {},
    });
    expect(response.status).toBe(403);
  });

  it('rejects malformed and excessive enquiry input before database writes', async () => {
    const invalidRequests = [
      {},
      { name: 'Customer', phone: '+447911123456', destination: 'Bath', travellers: '0' },
      { name: 'Customer', phone: '+447911123456', destination: 'Bath', travellers: '2.0' },
      { name: 'Customer', phone: '+447911123456', destination: 'Bath', travellers: '2', email: 'not-an-email' },
      { name: 'Customer', phone: '+447911123456', destination: 'Bath', travellers: '2', message: 'x'.repeat(2001) },
      { name: 'x'.repeat(121), phone: '+447911123456', destination: 'Bath', travellers: '2' },
    ];
    for (const body of invalidRequests) {
      api = await startTestApi();
      expect((await apiRequest(api.url, '/api/enquiries', { method: 'POST', body })).status).toBe(400);
      expect(api.pool.query).not.toHaveBeenCalled();
      await closeApi(api.server);
      api = undefined;
    }
  });

  it('rejects malformed JSON and oversized request bodies with safe status codes', async () => {
    api = await startTestApi();
    const malformed = await fetch(`${api.url}/api/enquiries`, {
      method: 'POST',
      headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
      body: '{invalid json',
    });
    expect(malformed.status).toBe(400);
    expect(await malformed.json()).toEqual({ error: 'Invalid JSON request body.' });

    const oversized = await fetch(`${api.url}/api/enquiries`, {
      method: 'POST',
      headers: { Origin: frontendOrigin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'x'.repeat(8 * 1024 * 1024) }),
    });
    expect(oversized.status).toBe(413);
    expect(await oversized.json()).toEqual({ error: 'Request body too large.' });
    expect(api.pool.query).not.toHaveBeenCalled();
  });

  it('rate limits repeated public enquiries', async () => {
    api = await startTestApi();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      expect((await apiRequest(api.url, '/api/enquiries', { method: 'POST', body: {} })).status).toBe(400);
    }
    expect((await apiRequest(api.url, '/api/enquiries', { method: 'POST', body: {} })).status).toBe(429);
  });

  it('returns safe errors when database calls fail', async () => {
    const errorLog = vi.spyOn(console, 'error').mockImplementation(() => {});
    api = await startTestApi({ pool: makePool(async () => { throw Object.assign(new Error('private SQL details'), { code: 'XX000' }); }) });
    const response = await apiRequest(api.url, '/api/trip-data');
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Service temporarily unavailable.' });
    expect(errorLog).not.toHaveBeenCalledWith(expect.stringContaining('private SQL details'), expect.anything());
  });

  it('reports database readiness failures without exposing database errors', async () => {
    api = await startTestApi({ pool: makePool(async () => { throw Object.assign(new Error('private database details'), { code: 'ECONNREFUSED' }); }) });
    const response = await apiRequest(api.url, '/health/ready');
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({ ok: false, error: 'Service temporarily unavailable.' });
  });

  it('saves valid enquiries even when both notification providers fail', async () => {
    api = await startTestApi({
      sendEmailNotification: async () => { throw new Error('mail credentials must not escape'); },
      sendWhatsAppNotification: async () => 'failed',
    });
    const response = await apiRequest(api.url, '/api/enquiries', {
      method: 'POST',
      body: {
        name: 'Test Customer',
        phone: '+447911123456',
        destination: 'Bath',
        travellers: '2',
        email: '',
        travelDate: null,
        message: '',
      },
    });
    expect(response.status).toBe(201);
    expect(api.pool.query).toHaveBeenCalledWith(expect.stringContaining('insert into enquiries'), expect.any(Array));
    expect((await response.json()).notifications).toEqual({ email: 'failed', whatsapp: 'failed' });
  });

  it('closes the HTTP listener before releasing the database pool', async () => {
    api = await startTestApi();
    const { server, pool } = api;
    await closeApiServer(server, pool);
    api = undefined;
    expect(pool.end).toHaveBeenCalledOnce();
    expect(server.listening).toBe(false);
  });

  it('refuses production app configuration without explicit CORS origins', () => {
    const pool = makePool(async () => ({ rows: [] }));
    expect(() => createApiApp({
      pool,
      env: { NODE_ENV: 'production', ADMIN_PASSWORD_HASH: adminPasswordHash, ADMIN_SESSION_SECRET: sessionSecret },
    })).toThrow(/CORS_ORIGINS/);
  });
});

describe('Supabase policy configuration', () => {
  it('replaces all existing policies before defining restricted public and admin access', async () => {
    const sql = await readFile(new URL('../supabase/schema.sql', import.meta.url), 'utf8');
    expect(sql).toContain('on public.enquiries for insert to anon, authenticated');
    expect(sql).toContain('on public.enquiries for select to authenticated');
    expect(sql).toContain("auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'");
    expect(sql).toContain('from pg_policies');
    expect(sql).toContain("'drop policy %I on %I.%I'");
    expect(sql).not.toMatch(/using\s*\(\s*true\s*\)/i);
    expect(sql).toMatch(/revoke all on public\.trip_categories, public\.destinations, public\.enquiries,/i);
  });
});

describe('admin password hashing', () => {
  it('verifies credentials with a salted scrypt hash and rejects invalid inputs', async () => {
    expect(adminPasswordHash).not.toContain(adminPassword);
    expect(await verifyAdminPassword(adminPassword, adminPasswordHash)).toBe(true);
    expect(await verifyAdminPassword('incorrect-password', adminPasswordHash)).toBe(false);
    expect(await verifyAdminPassword(adminPassword, 'plaintext-password')).toBe(false);
    await expect(hashAdminPassword('too-short')).rejects.toThrow(/14 and 256/);
  });
});
