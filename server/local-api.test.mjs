import { afterEach, describe, expect, it, vi } from 'vitest';
import { readFile } from 'node:fs/promises';
import { randomFillSync } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:net';
import sharp from 'sharp';
import { closeApiServer, createApiApp, startApiServer } from './api-app.mjs';
import { ImageInputError } from './images.mjs';
import { hashAdminPassword, isValidAdminPasswordHash, verifyAdminPassword } from './password.mjs';

const frontendOrigin = 'http://localhost:5173';
const adminPassword = 'local-test-password-12345';
const sessionSecret = 'test-only-session-secret-with-at-least-32-bytes';
const adminPasswordHash = await hashAdminPassword(adminPassword);
const smallImage = await sharp({
  create: { width: 2, height: 2, channels: 3, background: { r: 40, g: 90, b: 120 } },
}).png().toBuffer();
const imageDataUrl = `data:image/png;base64,${smallImage.toString('base64')}`;

function makePool(queryImplementation) {
  return {
    query: vi.fn(queryImplementation),
    connect: vi.fn(async () => ({
      query: vi.fn(queryImplementation),
      release: vi.fn(),
    })),
    end: vi.fn(async () => {}),
  };
}

async function startTestApi({ pool = makePool(async (sql) => {
  if (sql === 'select 1') return { rows: [{ '?column?': 1 }] };
  if (sql.includes('insert into enquiries')) {
    return { rows: [{ id: 'enquiry-uuid', created_at: '2026-10-09T00:00:00.000Z' }] };
  }
  return { rows: [], rowCount: 1 };
}), sendEmailNotification, sendWhatsAppNotification, processImage, createEmailTransport, env: envOverrides = {} } = {}) {
  const app = createApiApp({
    pool,
    env: {
      NODE_ENV: 'test',
      ADMIN_PASSWORD_HASH: adminPasswordHash,
      ADMIN_SESSION_SECRET: sessionSecret,
      CORS_ORIGINS: frontendOrigin,
      ...envOverrides,
    },
    sendEmailNotification,
    sendWhatsAppNotification,
    processImage,
    createEmailTransport,
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

async function apiRequest(url, path, { method = 'GET', body, cookie, authorization, origin = frontendOrigin } = {}) {
  return fetch(`${url}${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(cookie ? { Cookie: cookie } : {}),
      ...(authorization ? { Authorization: authorization } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

async function signIn(url, password = adminPassword) {
  const response = await apiRequest(url, '/api/admin/login', { method: 'POST', body: { password } });
  return {
    response,
    cookie: response.headers.get('set-cookie')?.split(';')[0],
    token: (await response.clone().json()).token,
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
      ['/api/manual-trip-notes', 'POST', {}],
      ['/api/manual-trip-notes/00000000-0000-4000-8000-000000000001', 'PUT', {}],
      ['/api/manual-trip-notes/00000000-0000-4000-8000-000000000001', 'DELETE'],
      ['/api/enquiries/00000000-0000-4000-8000-000000000001', 'DELETE'],
      ['/api/enquiries/confirmation', 'PUT', { ids: ['00000000-0000-4000-8000-000000000001'], isConfirmed: true }],
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

  it('allows the signed login token when browser cookie storage is unavailable', async () => {
    api = await startTestApi();
    const { response, token } = await signIn(api.url);
    expect(response.status).toBe(200);
    expect(token).toEqual(expect.any(String));

    const session = await apiRequest(api.url, '/api/admin/session', {
      authorization: `Bearer ${token}`,
    });
    await expect(session.json()).resolves.toEqual({ authenticated: true });

    const adminData = await apiRequest(api.url, '/api/admin-data', {
      authorization: `Bearer ${token}`,
    });
    expect(adminData.status).toBe(200);
    expect(api.pool.query).toHaveBeenCalledWith(expect.stringContaining('from enquiries'));
  });

  it('permits the authorization header in cross-origin admin request preflights', async () => {
    api = await startTestApi();
    const response = await fetch(`${api.url}/api/admin-data`, {
      method: 'OPTIONS',
      headers: {
        Origin: frontendOrigin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization',
      },
    });

    expect(response.status).toBe(204);
    expect(response.headers.get('access-control-allow-headers')).toContain('Authorization');
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

  it('accepts a 2 MB base64 image and rejects an image larger than 2 MB', async () => {
    api = await startTestApi();
    const { cookie } = await signIn(api.url);
    const category = {
      id: 'image-size-test',
      title: 'Image size test',
      image: imageDataUrl,
    };
    expect((await apiRequest(api.url, '/api/trip-categories', { method: 'POST', cookie, body: category })).status).toBe(204);

    const oversizedImage = await sharp({
      create: { width: 1024, height: 1024, channels: 3, background: { r: 40, g: 90, b: 120 } },
    }).png({ compressionLevel: 0 }).toBuffer();
    expect(oversizedImage.length).toBeGreaterThan(2 * 1024 * 1024);
    const oversizedResponse = await apiRequest(api.url, '/api/trip-categories', {
      method: 'POST',
      cookie,
      body: { ...category, id: 'oversized-image-test', image: `data:image/png;base64,${oversizedImage.toString('base64')}` },
    });
    expect(oversizedResponse.status).toBe(400);
    expect(api.pool.query).toHaveBeenCalledOnce();
  });

  it('allows destination requests containing multiple images larger than the general JSON limit', async () => {
    api = await startTestApi();
    const { cookie } = await signIn(api.url);
    const pixels = randomFillSync(Buffer.alloc(600 * 600 * 3));
    const image = `data:image/png;base64,${(await sharp(pixels, { raw: { width: 600, height: 600, channels: 3 } }).png().toBuffer()).toString('base64')}`;
    const body = {
      id: 'large-images-test',
      categoryId: 'test-category',
      name: 'Large images test',
      images: [image, image, image, image, image, image],
    };
    expect(Buffer.byteLength(JSON.stringify(body))).toBeGreaterThan(8 * 1024 * 1024);
    const response = await apiRequest(api.url, '/api/destinations', { method: 'POST', cookie, body });
    expect(response.status).toBe(204);
    expect(api.pool.query).toHaveBeenCalledWith(expect.stringContaining('insert into destinations'), expect.any(Array));
  });

  it('replaces removed destination images in the saved database field', async () => {
    api = await startTestApi({ processImage: async (image) => image });
    const { cookie } = await signIn(api.url);
    const firstImage = 'https://images.example/first.webp';
    const secondImage = 'https://images.example/second.webp';
    const thirdImage = 'https://images.example/third.webp';
    const destination = {
      id: 'image-removal-test',
      categoryId: 'test-category',
      name: 'Image removal test',
      images: [firstImage, secondImage, thirdImage],
    };

    expect((await apiRequest(api.url, '/api/destinations', { method: 'POST', cookie, body: destination })).status).toBe(204);
    expect((await apiRequest(api.url, '/api/destinations', {
      method: 'POST',
      cookie,
      body: { ...destination, images: [firstImage, thirdImage] },
    })).status).toBe(204);
    expect(api.pool.query.mock.calls.at(-1)[1][3]).toBe(JSON.stringify([firstImage, thirdImage]));
  });

  it('normalizes submitted HTTPS image URLs before storing them', async () => {
    const processImage = vi.fn(async () => imageDataUrl);
    api = await startTestApi({ processImage });
    const { cookie } = await signIn(api.url);
    const response = await apiRequest(api.url, '/api/trip-categories', {
      method: 'POST',
      cookie,
      body: { id: 'external-image-test', title: 'External image test', image: 'https://images.example/photo' },
    });
    expect(response.status).toBe(204);
    expect(processImage).toHaveBeenCalledWith('https://images.example/photo');
    expect(api.pool.query.mock.calls.at(-1)[1][4]).toBe(imageDataUrl);
  });

  it('returns a clear client error and does not save unsafe image URLs', async () => {
    const processImage = vi.fn(async () => { throw new ImageInputError('Only public HTTPS image URLs are allowed.'); });
    api = await startTestApi({ processImage });
    const { cookie } = await signIn(api.url);
    const response = await apiRequest(api.url, '/api/trip-categories', {
      method: 'POST',
      cookie,
      body: { id: 'unsafe-image-test', title: 'Unsafe image test', image: 'http://127.0.0.1/private.png' },
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Only public HTTPS image URLs are allowed.' });
    expect(api.pool.query).not.toHaveBeenCalled();
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

  it('allows administrators to delete enquiries and rejects malformed identifiers', async () => {
    api = await startTestApi();
    const { cookie } = await signIn(api.url);
    const invalidResponse = await apiRequest(api.url, '/api/enquiries/not-a-uuid', { method: 'DELETE', cookie });
    expect(invalidResponse.status).toBe(400);
    expect(api.pool.query).not.toHaveBeenCalled();

    const id = '00000000-0000-4000-8000-000000000001';
    const response = await apiRequest(api.url, `/api/enquiries/${id}`, { method: 'DELETE', cookie });
    expect(response.status).toBe(204);
    expect(api.pool.query).toHaveBeenCalledWith('delete from enquiries where id = $1', [id]);
  });

  it('allows administrators to create, update, and delete manual trip notes', async () => {
    const row = {
      id: '00000000-0000-4000-8000-000000000001',
      trip_date: '2026-10-20',
      customer_name: 'Test Customer',
      destination: 'Bath',
      reached_location: 'Bath city centre',
      reached_date: '2026-10-20',
      amount: '125.50',
      notes: 'Customer paid in full.',
      created_at: '2026-10-20T09:00:00.000Z',
    };
    api = await startTestApi({
      pool: makePool(async (sql) => {
        if (sql.includes('insert into public.manual_trip_notes') || sql.includes('update public.manual_trip_notes')) {
          return { rows: [row], rowCount: 1 };
        }
        return { rows: [], rowCount: 1 };
      }),
    });
    const { cookie } = await signIn(api.url);
    const body = {
      tripDate: row.trip_date,
      customerName: row.customer_name,
      destination: row.destination,
      reachedLocation: row.reached_location,
      reachedDate: row.reached_date,
      amount: row.amount,
      notes: row.notes,
    };

    const created = await apiRequest(api.url, '/api/manual-trip-notes', { method: 'POST', cookie, body });
    expect(created.status).toBe(201);
    expect(await created.json()).toMatchObject({
      id: row.id,
      tripDate: row.trip_date,
      customerName: row.customer_name,
      reachedLocation: row.reached_location,
      reachedDate: row.reached_date,
      amount: row.amount,
      notes: row.notes,
    });
    expect(api.pool.query).toHaveBeenCalledWith(
      expect.stringContaining('insert into public.manual_trip_notes'),
      [row.trip_date, row.customer_name, row.destination, row.reached_location, row.reached_date, row.amount, row.notes],
    );

    const updated = await apiRequest(api.url, `/api/manual-trip-notes/${row.id}`, { method: 'PUT', cookie, body });
    expect(updated.status).toBe(200);
    expect(api.pool.query).toHaveBeenLastCalledWith(
      expect.stringContaining('update public.manual_trip_notes'),
      [row.id, row.trip_date, row.customer_name, row.destination, row.reached_location, row.reached_date, row.amount, row.notes],
    );

    const deleted = await apiRequest(api.url, `/api/manual-trip-notes/${row.id}`, { method: 'DELETE', cookie });
    expect(deleted.status).toBe(204);
    expect(api.pool.query).toHaveBeenLastCalledWith(
      'delete from public.manual_trip_notes where id = $1',
      [row.id],
    );
  });

  it('rejects invalid manual trip notes before database writes', async () => {
    api = await startTestApi();
    const { cookie } = await signIn(api.url);
    const invalidBodies = [
      { tripDate: '', customerName: 'Test Customer', destination: 'Bath' },
      { tripDate: '2026-02-30', customerName: 'Test Customer', destination: 'Bath' },
      { tripDate: '2026-10-20', customerName: 'Test Customer', destination: 'Bath', amount: '-1' },
      { tripDate: '2026-10-20', customerName: 'Test Customer', destination: 'Bath', amount: '100000000' },
      { tripDate: '2026-10-20', customerName: 'Test Customer', destination: 'Bath', reachedDate: 'not-a-date' },
    ];
    for (const body of invalidBodies) {
      const response = await apiRequest(api.url, '/api/manual-trip-notes', { method: 'POST', cookie, body });
      expect(response.status).toBe(400);
    }
    expect(api.pool.query).not.toHaveBeenCalled();
  });

  it('allows administrators to confirm and unconfirm selected enquiries', async () => {
    const ids = [
      '00000000-0000-4000-8000-000000000001',
      '00000000-0000-4000-8000-000000000002',
    ];
    api = await startTestApi({
      pool: makePool(async (sql) => sql.includes('update public.enquiries')
        ? { rows: ids.map((id) => ({ id })), rowCount: ids.length }
        : { rows: [], rowCount: 1 }),
    });
    const { cookie } = await signIn(api.url);

    for (const isConfirmed of [true, false]) {
      const response = await apiRequest(api.url, '/api/enquiries/confirmation', {
        method: 'PUT',
        cookie,
        body: { ids, isConfirmed },
      });
      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual({ updated: ids.length });
      expect(api.pool.query).toHaveBeenLastCalledWith(
        expect.stringContaining('update public.enquiries'),
        [ids, isConfirmed],
      );
    }
  });

  it('rejects invalid enquiry confirmation requests before database writes', async () => {
    api = await startTestApi();
    const { cookie } = await signIn(api.url);
    const invalidBodies = [
      { ids: [], isConfirmed: true },
      { ids: ['invalid-id'], isConfirmed: true },
      { ids: ['00000000-0000-4000-8000-000000000001'], isConfirmed: 'yes' },
      { ids: Array.from({ length: 101 }, () => '00000000-0000-4000-8000-000000000001'), isConfirmed: true },
    ];
    for (const body of invalidBodies) {
      const response = await apiRequest(api.url, '/api/enquiries/confirmation', {
        method: 'PUT',
        cookie,
        body,
      });
      expect(response.status).toBe(400);
    }
    expect(api.pool.query).not.toHaveBeenCalled();
  });

  it('returns saved confirmation details in admin enquiries', async () => {
    const enquiry = {
      id: '00000000-0000-4000-8000-000000000001',
      name: 'Confirmed Customer',
      phone: '+447911123456',
      email: 'customer@example.com',
      destination: 'Bath',
      travellers: '2',
      travel_date: '2026-12-20',
      message: 'Please confirm our trip.',
      created_at: '2026-10-09T00:00:00.000Z',
      is_confirmed: true,
      confirmed_at: '2026-10-10T00:00:00.000Z',
    };
    api = await startTestApi({
      pool: makePool(async (sql) => sql.includes('from enquiries')
        ? { rows: [enquiry], rowCount: 1 }
        : { rows: [], rowCount: 1 }),
    });
    const { cookie } = await signIn(api.url);
    const response = await apiRequest(api.url, '/api/admin-data', { cookie });
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.enquiries[0]).toMatchObject({
      id: enquiry.id,
      isConfirmed: true,
      confirmedAt: enquiry.confirmed_at,
    });
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

  it('sends email notifications to the configured enquiry recipient', async () => {
    const sendMail = vi.fn(async () => ({ messageId: 'test-message' }));
    const createEmailTransport = vi.fn(() => ({ sendMail }));
    const pool = makePool(async (sql) => sql.includes('insert into enquiries')
      ? { rows: [{ id: 'enquiry-uuid', created_at: '2026-10-09T00:00:00.000Z' }] }
      : { rows: [], rowCount: 1 });
    api = await startTestApi({
      pool,
      createEmailTransport,
      env: {
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'smtp-user',
        SMTP_PASS: 'smtp-test-password',
        ENQUIRY_FROM_EMAIL: 'sender@example.com',
        ENQUIRY_TO_EMAIL: 'trips@example.com',
      },
    });
    const response = await apiRequest(api.url, '/api/enquiries', {
      method: 'POST',
      body: {
        name: 'Test Customer',
        phone: '+447911123456',
        destination: 'Bath',
        travellers: '2',
      },
    });

    expect(response.status).toBe(201);
    expect((await response.json()).notifications.email).toBe('sent');
    expect(createEmailTransport).toHaveBeenCalledWith(expect.objectContaining({
      host: 'smtp.example.com',
      port: 587,
      secure: false,
    }));
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      from: 'sender@example.com',
      to: 'trips@example.com',
      text: expect.stringContaining('Destination: Bath'),
      html: expect.stringContaining('<th scope="col"'),
    }));
  });

  it('includes the customer reply address and escapes email content in the HTML notification', async () => {
    const sendMail = vi.fn(async () => ({ messageId: 'test-message' }));
    const pool = makePool(async (sql) => sql.includes('insert into enquiries')
      ? { rows: [{ id: 'enquiry-uuid', created_at: '2026-10-09T00:00:00.000Z' }] }
      : { rows: [], rowCount: 1 });
    api = await startTestApi({
      pool,
      createEmailTransport: () => ({ sendMail }),
      env: {
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '465',
        SMTP_USER: 'smtp-user',
        SMTP_PASS: 'smtp-test-password',
        ENQUIRY_FROM_EMAIL: 'sender@example.com',
      },
    });
    const response = await apiRequest(api.url, '/api/enquiries', {
      method: 'POST',
      body: {
        name: '<Customer>',
        phone: '+447911123456',
        email: 'customer@example.com',
        destination: 'Bath & <Wells>',
        travellers: '2',
        message: 'Please call <me>.',
      },
    });

    expect(response.status).toBe(201);
    expect((await response.json()).notifications.email).toBe('sent');
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      replyTo: 'customer@example.com',
      html: expect.stringContaining('&lt;Customer&gt;'),
    }));
    const html = sendMail.mock.calls[0][0].html;
    expect(html).toContain('Bath &amp; &lt;Wells&gt;');
    expect(html).toContain('Please call &lt;me&gt;.');
    expect(html).not.toContain('<Customer>');
  });

  it('prevents administrators from adding more than 10 customer reviews', async () => {
    api = await startTestApi({
      pool: makePool(async (sql) => {
        if (sql.includes('count(*)') && sql.includes('public.customer_reviews')) return { rows: [{ count: 10 }] };
        if (sql === 'select 1') return { rows: [{ '?column?': 1 }] };
        return { rows: [], rowCount: 1 };
      }),
    });
    const { cookie } = await signIn(api.url);
    const response = await apiRequest(api.url, '/api/customer-reviews', {
      method: 'POST',
      cookie,
      body: { name: 'Test Customer', text: 'A lovely trip.', image: imageDataUrl },
    });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: 'A maximum of 10 customer reviews can be added. Delete a review before adding another.',
    });
    const client = await api.pool.connect.mock.results[0].value;
    expect(client.query).toHaveBeenCalledWith('select pg_advisory_xact_lock(771, 10)');
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('insert into public.customer_reviews'), expect.any(Array));
    expect(client.query).toHaveBeenCalledWith('rollback');
    expect(client.release).toHaveBeenCalledOnce();
  });

  it('creates a customer review when fewer than 10 exist', async () => {
    api = await startTestApi({
      pool: makePool(async (sql) => {
        if (sql.includes('count(*)') && sql.includes('public.customer_reviews')) return { rows: [{ count: 9 }] };
        if (sql.includes('insert into public.customer_reviews')) {
          return {
            rows: [{
              id: 'review-uuid',
              name: 'Test Customer',
              trip: 'Bath',
              review: 'A lovely trip.',
              image: imageDataUrl,
              is_active: true,
              created_at: '2026-10-09T00:00:00.000Z',
            }],
            rowCount: 1,
          };
        }
        if (sql === 'select 1') return { rows: [{ '?column?': 1 }] };
        return { rows: [], rowCount: 1 };
      }),
    });
    const { cookie } = await signIn(api.url);
    const response = await apiRequest(api.url, '/api/customer-reviews', {
      method: 'POST',
      cookie,
      body: { name: 'Test Customer', trip: 'Bath', text: 'A lovely trip.', image: imageDataUrl },
    });
    expect(response.status).toBe(201);
    expect((await response.json()).id).toBe('review-uuid');
    const client = await api.pool.connect.mock.results[0].value;
    expect(client.query).toHaveBeenCalledWith('select pg_advisory_xact_lock(771, 10)');
    expect(client.query).toHaveBeenCalledWith('commit');
    expect(client.release).toHaveBeenCalledOnce();
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

describe('API startup', () => {
  it('rejects a listener failure instead of reporting successful startup', async () => {
    const listener = createServer();
    listener.listen(0, '0.0.0.0');
    await once(listener, 'listening');
    try {
      await expect(startApiServer({ env: {
        NODE_ENV: 'test',
        DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
        PORT: String(listener.address().port),
        ADMIN_PASSWORD_HASH: adminPasswordHash,
        ADMIN_SESSION_SECRET: sessionSecret,
      } })).rejects.toMatchObject({ code: 'EADDRINUSE' });
    } finally {
      await closeApi(listener);
    }
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
    expect(sql).toContain('on public.manual_trip_notes for all to authenticated');
    expect(sql).toContain('public.manual_trip_notes from public, anon, authenticated');
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
