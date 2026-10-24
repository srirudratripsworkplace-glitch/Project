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
6. Run `npm test`, `npm run build`, and `npm run build:web` to validate the project.

The local API listens on `PORT`, then `LOCAL_API_PORT`, then `8787`. The Vite app uses port `5173` and connects to the local API by default. If using a different local frontend origin, add its exact origin to `CORS_ORIGINS`.
Before manually submitting enquiries in local development, unset SMTP and WhatsApp production credentials or replace them with test services. Automated tests inject notification failures and do not contact external providers.

## Supabase PostgreSQL

1. Take a database backup before applying schema changes.
2. Review and apply `supabase/schema.sql` through the Supabase SQL editor or a controlled migration runner for full setup. The DDL uses `CREATE TABLE IF NOT EXISTS` and replaces policies on the affected tables; it does not drop tables or delete rows.
3. Do not run `supabase/local-postgres.sql` or `supabase/seed-trips.sql` against production: the local setup script includes sample content.
4. Do not enable broad public table grants or expose a database/service-role credential to Vite. Public PostgREST access is restricted by the RLS policies in `schema.sql`; administrator JWTs must carry the trusted `app_metadata.role = "admin"` claim.

## Vercel frontend

- Framework: Vite
- Build command: `npm run build:web` (explicitly set in `vercel.json`)
- Output directory: `dist`
- Set `VITE_API_BASE_URL` to the HTTPS origin of the separately hosted API, for example `https://api.example.com`.
- Do not set passwords, database URLs, SMTP credentials, WhatsApp tokens, or Supabase service-role keys in any `VITE_` variable. Vite variables are public in the browser bundle.
- The included Vercel configuration serves `/admin` through the SPA and applies baseline browser security headers.
- `vercel.json` overrides the dashboard build command. Keep the Vercel project root
  at this repository's root so it reads this configuration. If deploying from
  another root or a custom CI workflow, set its build command to
  `npm run build:web` and output directory to `dist` before pushing. Ensure the
  frontend install includes development dependencies (`npm ci --include=dev`).

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

Use custom frontend and API hostnames under the same site (for example `www.example.com` and `api.example.com`) for reliable browser admin cookies. Production admin cookies are secure, HTTP-only, and `SameSite=None` for cross-origin API requests; browser privacy controls may block cookies when the frontend and API are on unrelated registrable domains. The API also returns a signed 12-hour admin token after successful login; the frontend keeps it in memory and sends it as a bearer token so admin requests still work when the browser blocks cookies. This fallback does not persist across page reloads, so the administrator must sign in again after a reload in browsers that block the cookie.

## Hostinger backend deployment

Keep the Vercel frontend and Supabase database as separate services. The API does not
serve `dist/`, import frontend code, or need TypeScript/Vite to start.

| Setting | Value |
| --- | --- |
| Application type | Express (Node.js web app) |
| Node.js version | 22.x, at least 22.12.0 |
| Root directory | Repository root (`./`) |
| Package manager | npm |
| Install command, if configurable | `npm ci --omit=dev` |
| Build command | `npm run build` (delegates to `build:api`) |
| Entry file, relative to root | `server/local-api.mjs` |
| Start command, if configurable | `npm start` |
| Output directory, if required | `.` (source application, not `dist`) |

The API build command checks backend syntax using Node.js; it does not compile or
launch the app. Include `server/`, `certs/`, `package.json`, and `package-lock.json`
in the runtime deployment. Install on Hostinger so native dependencies such as
`sharp` match its Linux runtime; do not upload Windows `node_modules/`.

`server/local-api.mjs` is the production bootstrap and starts the listener even
when imported by a hosting launcher. Do not configure `server/api-app.mjs` as the
entry: that module exports the factories for tests without starting a server.
The bootstrap logs loading, configuration validation, binding, and listening
phases with sanitized failures. It binds to `0.0.0.0` using Hostinger's `PORT`.
Database and SMTP connections are not awaited before listening. Required admin
and CORS configuration is still validated before the listener opens;
`/health/ready` checks PostgreSQL separately with a read-only query.

`tsc: command not found` means the frontend build ran without the TypeScript
development dependency available. Production installs can omit development
dependencies. Use the backend build command here; Vercel continues to use
`npm run build:web` with development dependencies installed (`npm ci --include=dev`).
The default `npm run build` is deliberately backend-only for Hostinger's automatic
build selection. TypeScript and Vite remain development dependencies.

Configure these values privately in Hostinger's runtime environment:

- `NODE_ENV=production`.
- `DATABASE_URL`: the Supabase PostgreSQL connection URI. The API does not read
  `.env.supabase`, `SUPABASE_DB_URL`, or individual `DB_*` settings. Prefer the
  Supabase session pooler if the hosting network cannot reach the direct IPv6
  database endpoint. Copy credentials from Supabase without logging them.
- `ADMIN_PASSWORD_HASH`: valid output of `npm run hash:admin-password`, preserving
  every literal `$` character; a plaintext password or placeholder prevents startup.
- `ADMIN_SESSION_SECRET`: a random secret of at least 32 bytes.
- `CORS_ORIGINS`: exact existing frontend origins, comma-separated with no trailing
  slash, path, or wildcard. Use the Vercel/custom frontend origins, not the API URL.
- Let Hostinger supply `PORT`; the API honors it before `LOCAL_API_PORT` and its
  local default. Do not copy the local `.env.example` port into hosting settings.
- `PG_POOL_MAX`: optional, default `10`; choose within the Supabase connection budget.
- `TRUST_PROXY=true` only after confirming exactly one trusted proxy hop.
- Optional SMTP: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
  `ENQUIRY_FROM_EMAIL`, `ENQUIRY_TO_EMAIL`. Port 465 uses implicit TLS;
  `SMTP_SECURE` is not read by the API.
- Optional WhatsApp: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_BUSINESS_NUMBER`, `WHATSAPP_TEMPLATE_NAME`, `WHATSAPP_API_VERSION`.

Production PostgreSQL connections verify TLS against
`certs/supabase-prod-ca-2021.crt`. Keep that file in the deployment. Avoid SSL
query parameters such as `sslmode`, `sslcert`, `sslkey`, and `sslrootcert` in
`DATABASE_URL`: node-postgres can use them to replace the explicit SSL object.
Do not disable certificate verification to bypass a connection failure.

### Generate the admin password hash safely

Run `npm run hash:admin-password` in your own interactive terminal (use
`npm.cmd run hash:admin-password` in Windows PowerShell if execution policy blocks
`npm.ps1`). Enter a unique password of 14 to 256 characters at the masked prompt.
Do not pass the password as a command-line argument or paste it into chat.

The generated value has this exact format:

```text
scrypt$16384$8$1$<32 hexadecimal salt characters>$<128 hexadecimal key characters>
```

The generator uses a cryptographically random 16-byte salt and Node.js scrypt with
N=16384, r=8, p=1 and a 64-byte derived key. Paste only the value after
`ADMIN_PASSWORD_HASH=` into hPanel's variable value field, with no surrounding
quotes. Preserve literal `$` characters and keep the generated hash private.
The API does not accept bcrypt, plaintext passwords, or arbitrary hash formats.

Generate `ADMIN_SESSION_SECRET` privately with
`node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`
and paste the result into its separate hPanel variable. Do not commit either value.

### Manual hPanel redeployment

1. Before pushing, inspect which GitHub branch this Hostinger application deploys.
   The local branch name alone does not prove which branch is configured in hPanel.
   Obtain explicit approval for the commit, push, and production redeployment.
   A push to a connected branch can deploy automatically.
2. In hPanel, open **Websites**, then **Dashboard** beside
   `white-hare-614328.hostingersite.com`. Open **Deployments** and select the failed
   deployment to inspect its build logs. Open **Runtime logs** for startup errors.
3. Open **Environment variables** and set the required runtime values listed above.
   Paste values without quotes, click **Apply changes**, and verify that the saved
   names and special characters are correct. Never use public `VITE_` variables for
   backend credentials. Applying runtime variables may restart the production app;
   do this only after approval.
4. After the approved commit is pushed, choose **Deployments > Redeploy**. Confirm
   the GitHub source repository and production branch, then set the build settings
   from the table above. Keep the root at the repository root so the entry can find
   `certs/` and the root package manifest. Do not select the Vite framework or `dist`.
5. Confirm the settings and click **Redeploy** (or **Save and Redeploy**). GitHub
   deployments use the latest code from the selected branch. Check the deployed
   commit against the pushed commit and wait for the build to finish.
6. Review **Runtime logs** for the listening message and run the read-only endpoint
   checks below. If the dashboard logs are unavailable, use **File Manager** to open
   `domains/white-hare-614328.hostingersite.com/hbuilds/current/nodejs/stderr.log`.

Hostinger references: [redeployment](https://www.hostinger.com/support/how-to-redeploy-a-node-js-application/),
[environment variables](https://www.hostinger.com/support/how-to-edit-or-add-environment-variables-after-deployment/),
and [runtime logs](https://www.hostinger.com/support/how-to-use-node-js-runtime-logs-at-hostinger/).

Before deploying, review build logs in hPanel under Deployments and runtime logs
in its runtime log view or `domains/<domain>/hbuilds/current/nodejs/stderr.log`.
A successful build alone does not establish that the process started. A 503 needs
runtime evidence: check the entry file, required environment values, listener
errors, dependencies, and hosting limits. `/` intentionally returns JSON 404;
use `/health/live` for process health.

After explicit deployment approval, verify the temporary URL:

1. `GET https://white-hare-614328.hostingersite.com/health/live`: HTTP 200, `{"ok":true}`.
2. `GET /health/ready`: HTTP 200 after a read-only `select 1` database check.
3. `GET /api/trip-data`, `/api/special-trips`, `/api/customer-reviews`: HTTP 200.
4. `GET /api/admin-data` without authentication: HTTP 401.
5. Check CORS using an allowed frontend Origin header and inspect runtime logs.

Do not submit enquiries or management requests as production smoke tests. Do not
run migration/seed scripts, stop Render, or change `VITE_API_BASE_URL` during this
verification. Pushing GitHub changes or redeploying requires approval because a
connected branch may trigger automatic deployments.

## Database and deployment safety

No deployment, database migration, seed, or production write is run by this project setup. Review and back up the target database before manually applying the schema. `supabase/seed-trips.sql` is sample/local content and must not be run against production unless explicitly reviewed and approved.
