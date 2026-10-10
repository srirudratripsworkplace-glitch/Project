# Deployment guide

## Architecture

- The React/Vite site is a static Vercel deployment built into `dist/`.
- The Express API runs as a separate Node.js service using `server/local-api.mjs`.
- The API connects to Supabase PostgreSQL with the server-only `DATABASE_URL`.
- Enquiries are committed to PostgreSQL before email or WhatsApp notifications are attempted.
- Admin sign-in is checked by the API. Its signed, HTTP-only session cookie is not a Vite environment variable.

## Local development

1. Install the locked dependencies with `npm ci`.
2. Run `npm run hash:admin-password` in an interactive terminal and enter a unique password of at least 14 characters. Put the resulting `ADMIN_PASSWORD_HASH` in `.env.local` or `.env`, along with `DATABASE_URL` and a random `ADMIN_SESSION_SECRET` (at least 32 characters). Configure the optional SMTP and WhatsApp values on the server only.
3. For a disposable local PostgreSQL instance, use `supabase/local-postgres.sql` (it creates and seeds local sample content). For a Supabase development project, apply `supabase/schema.sql` and run `supabase/seed-trips.sql` only if sample content is wanted. Schema application is explicit; the API does not create tables or seed data during startup.
4. In one terminal run `npm run start:api`.
5. In another terminal run `npm run dev`.
6. Run `npm test` and `npm run build` to validate the project.

The local API listens on `PORT`, then `LOCAL_API_PORT`, then `8787`. The Vite app uses port `5173` and connects to the local API by default. If using a different local frontend origin, add its exact origin to `CORS_ORIGINS`.
Before manually submitting enquiries in local development, unset SMTP and WhatsApp production credentials or replace them with test services. Automated tests inject notification failures and do not contact external providers.

## Supabase PostgreSQL

1. Take a database backup before applying schema changes.
2. Review and apply `supabase/schema.sql` through the Supabase SQL editor or a controlled migration runner. The DDL uses `CREATE TABLE IF NOT EXISTS` and replaces policies on the affected tables; it does not drop tables or delete rows.
3. Do not run `supabase/local-postgres.sql` or `supabase/seed-trips.sql` against production: the local setup script includes sample content.
4. Do not enable broad public table grants or expose a database/service-role credential to Vite. Public PostgREST access is restricted by the RLS policies in `schema.sql`; administrator JWTs must carry the trusted `app_metadata.role = "admin"` claim.

## Vercel frontend

- Framework: Vite
- Build command: `npm run build`
- Output directory: `dist`
- Set `VITE_API_BASE_URL` to the HTTPS origin of the separately hosted API, for example `https://api.example.com`.
- Do not set passwords, database URLs, SMTP credentials, WhatsApp tokens, or Supabase service-role keys in any `VITE_` variable. Vite variables are public in the browser bundle.
- The included Vercel configuration serves `/admin` through the SPA and applies baseline browser security headers.

## Node.js API service

- Runtime: Node.js 22.12.0 or newer (declared in `package.json`)
- Install command: `npm ci`
- Start command: `npm run start:api`
- Configure `DATABASE_URL`, `ADMIN_PASSWORD_HASH`, `ADMIN_SESSION_SECRET`, and `CORS_ORIGINS` in the hosting provider's server-side environment settings.
- Generate the password hash with `npm run hash:admin-password` in a trusted interactive terminal. Set a new strong password and `ADMIN_SESSION_SECRET` for production rather than reusing the previous frontend admin password; the old frontend build mechanism could publish that value in its JavaScript bundle. Store only the generated hash in the API environment.
- `CORS_ORIGINS` is a comma-separated list of exact frontend origins, including scheme and host, with no paths or wildcard. Production startup fails without it.
- `PORT` is assigned by the hosting provider. Set `TRUST_PROXY=true` only when the service is behind exactly one trusted reverse proxy.
- Use an HTTPS database connection and set an appropriate `PG_POOL_MAX` for the service's database connection budget.
- Set optional SMTP and WhatsApp credentials only in this API service's environment.
- Configure liveness at `/health/live` and readiness at `/health/ready`; readiness checks database connectivity without returning database details.

Use custom frontend and API hostnames under the same site (for example `www.example.com` and `api.example.com`) for reliable browser admin cookies. Production admin cookies are secure, HTTP-only, and `SameSite=None` for cross-origin API requests; browser privacy controls may block cookies when the frontend and API are on unrelated registrable domains.

## Database and deployment safety

No deployment, database migration, seed, or production write is run by this project setup. Review and back up the target database before manually applying the schema. `supabase/seed-trips.sql` is sample/local content and must not be run against production unless explicitly reviewed and approved.
