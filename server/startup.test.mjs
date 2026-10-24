import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const entry = new URL('./local-api.mjs', import.meta.url);

function productionEnv(port) {
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
    /^(path|systemroot|windir|temp|tmp)$/i.test(key)));
  return Object.assign(env, {
    NODE_ENV: 'production', PORT: String(port), LOCAL_API_PORT: 'invalid-fallback-port',
    DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/unavailable',
    CORS_ORIGINS: 'https://frontend.example',
    ADMIN_PASSWORD_HASH: `scrypt$16384$8$1$${'a'.repeat(32)}$${'b'.repeat(128)}`,
    ADMIN_SESSION_SECRET: 'test-only-secret-with-at-least-32-bytes',
    // Even a configured, unreachable SMTP service must not delay listening.
    SMTP_HOST: '127.0.0.1', SMTP_PORT: '1', SMTP_USER: 'test-user', SMTP_PASS: 'test-only-smtp-secret',
    ENQUIRY_FROM_EMAIL: 'sender@example.com', ENQUIRY_TO_EMAIL: 'recipient@example.com',
  });
}

it.each(['direct', 'imported by launcher', 'required by Node 22 launcher'])(
  'production entry listens within three seconds when %s, with the database unavailable',
  async (mode) => {
    const reservation = createServer();
    reservation.listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    // An empty working directory prevents dotenv from reading real local secrets.
    const cwd = await mkdtemp(join(tmpdir(), 'srirudra-startup-'));
    const env = productionEnv(port);
    // A launcher may inspect listen() as soon as loading the entry completes.
    // A detached dynamic import lets entry loading finish before listen is called.
    const loadEntry = mode === 'required by Node 22 launcher'
      ? `createRequire(import.meta.url)(${JSON.stringify(fileURLToPath(entry))});`
      : `await import(${JSON.stringify(entry.href)});`;
    const args = mode === 'direct' ? [fileURLToPath(entry)]
      : ['--input-type=module', '--eval', `
        import { Server } from 'node:net';
        import { createRequire } from 'node:module';
        const originalListen = Server.prototype.listen;
        let listenCalled = false;
        Server.prototype.listen = function (...args) {
          listenCalled = args[0] === Number(process.env.PORT) && args[1] === '0.0.0.0';
          return Reflect.apply(originalListen, this, args);
        };
        ${loadEntry}
        if (!listenCalled) throw new Error('Entry loading completed before listen() on the hosting port.');
      `];
    const startedAt = performance.now();
    const child = spawn(process.execPath, args, { cwd, env, stdio: ['ignore', 'pipe', 'pipe'] });
    const exited = once(child, 'exit');
    let output = '';
    let timer;
    try {
      await new Promise((resolve, reject) => {
        timer = setTimeout(() => reject(new Error('Production entry did not listen within 3 seconds.')), 3000);
        child.stdout.on('data', (chunk) => {
          output += chunk;
          if (output.includes(`API startup: listening on 0.0.0.0:${port}.`)) resolve();
        });
        child.stderr.on('data', (chunk) => { output += chunk; });
        child.once('error', reject);
        child.once('exit', () => reject(new Error(`Entry exited before listening: ${output}`)));
      });
      expect(performance.now() - startedAt).toBeLessThan(3000);
      clearTimeout(timer);
      const base = `http://127.0.0.1:${port}`;
      const live = await fetch(`${base}/health/live`, { signal: AbortSignal.timeout(2000) });
      expect(live.status).toBe(200);
      expect(await live.json()).toEqual({ ok: true });
      const ready = await fetch(`${base}/health/ready`, { signal: AbortSignal.timeout(2000) });
      expect(ready.status).toBe(503);
      expect(await ready.json()).toEqual({ ok: false, error: 'Service temporarily unavailable.' });
      expect(output).not.toContain(env.DATABASE_URL);
      expect(output).not.toContain(env.ADMIN_PASSWORD_HASH);
      expect(output).not.toContain(env.ADMIN_SESSION_SECRET);
      expect(output).not.toContain(env.SMTP_PASS);
    } finally {
      clearTimeout(timer);
      child.kill();
      await exited;
      await rm(cwd, { recursive: true, force: true });
    }
  }, 10000,
);

it.each([
  ['DATABASE_URL', '', 'DATABASE_URL must be configured.'],
  ['CORS_ORIGINS', '', 'CORS_ORIGINS must list the production frontend origin.'],
  ['ADMIN_PASSWORD_HASH', 'test-only-invalid-hash', 'Configure a valid ADMIN_PASSWORD_HASH'],
  ['ADMIN_SESSION_SECRET', 'test-only-short-secret', 'Configure a valid ADMIN_PASSWORD_HASH'],
  ['PORT', 'invalid-port', 'PORT must be a valid TCP port.'],
])('production entry exits without listening when %s is invalid', async (key, value, message) => {
  const cwd = await mkdtemp(join(tmpdir(), 'srirudra-startup-'));
  const env = { ...productionEnv(8787), [key]: value };
  const child = spawn(process.execPath, [fileURLToPath(entry)], {
    cwd, env, stdio: ['ignore', 'pipe', 'pipe'],
  });
  const exited = once(child, 'exit');
  let output = '';
  let timer;
  child.stdout.on('data', (chunk) => { output += chunk; });
  child.stderr.on('data', (chunk) => { output += chunk; });
  try {
    const [code] = await Promise.race([
      exited,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('Invalid configuration did not terminate startup.')), 3000);
      }),
    ]);
    expect(code).toBe(1);
    expect(output).toContain('API startup failed.');
    expect(output).toContain(message);
    expect(output).not.toContain('API startup: listening');
    for (const secret of [env.DATABASE_URL, env.ADMIN_PASSWORD_HASH, env.ADMIN_SESSION_SECRET, env.SMTP_PASS]) {
      if (secret) expect(output).not.toContain(secret);
    }
  } finally {
    clearTimeout(timer);
    if (child.exitCode === null) child.kill();
    await exited;
    await rm(cwd, { recursive: true, force: true });
  }
}, 10000);
