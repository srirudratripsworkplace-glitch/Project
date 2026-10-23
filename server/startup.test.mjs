import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const entry = new URL('./local-api.mjs', import.meta.url);

it.each(['direct', 'imported by launcher'])(
  'production entry listens within three seconds when %s, with the database unavailable',
  async (mode) => {
    const reservation = createServer();
    reservation.listen(0, '127.0.0.1');
    await once(reservation, 'listening');
    const port = reservation.address().port;
    await new Promise((resolve) => reservation.close(resolve));
    // An empty working directory prevents dotenv from reading real local secrets.
    const cwd = await mkdtemp(join(tmpdir(), 'srirudra-startup-'));
    const env = Object.fromEntries(Object.entries(process.env).filter(([key]) =>
      /^(path|systemroot|windir|temp|tmp)$/i.test(key)));
    Object.assign(env, {
      NODE_ENV: 'production', PORT: String(port),
      DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/unavailable',
      CORS_ORIGINS: 'https://frontend.example',
      ADMIN_PASSWORD_HASH: `scrypt$16384$8$1$${'a'.repeat(32)}$${'b'.repeat(128)}`,
      ADMIN_SESSION_SECRET: 'test-only-secret-with-at-least-32-bytes',
    });
    const args = mode === 'direct' ? [fileURLToPath(entry)]
      : ['--input-type=module', '--eval', `import ${JSON.stringify(entry.href)};`];
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
    } finally {
      clearTimeout(timer);
      child.kill();
      await exited;
      await rm(cwd, { recursive: true, force: true });
    }
  }, 10000,
);
