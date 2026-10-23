import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import nodemailer from 'nodemailer';
import pg from 'pg';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { ImageInputError, processImageDataUrl, processImageReference, validateImageDataUrl } from './images.mjs';
import { isValidAdminPasswordHash, verifyAdminPassword } from './password.mjs';

dotenv.config({ path: '.env.local', quiet: true });
dotenv.config({ quiet: true });

const { Pool } = pg;
const defaultLocalOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'http://127.0.0.1:4173',
];
function toCustomerReview(row) {
  return {
    id: row.id,
    name: row.name,
    trip: row.trip || '',
    text: row.review,
    image: row.image || '',
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
  };
}

function validateCustomerReview(value) {
  if (!isPlainObject(value) || !isText(value.name, 120, true) || !isText(value.text, 2000, true)) return null;
  if (typeof value.image !== 'string' || (value.image && !isSafeImage(value.image))) return null;
  if (!isText(value.trip ?? '', 160) || typeof (value.isActive ?? true) !== 'boolean') return null;

  return {
    name: value.name.trim().slice(0, 120),
    trip: typeof value.trip === 'string' ? value.trip.trim().slice(0, 160) : '',
    review: value.text.trim(),
    image: value.image,
    isActive: value.isActive !== false,
  };
}

export function createApiApp({
  pool,
  env = process.env,
  sendEmailNotification,
  sendWhatsAppNotification,
  processImage = processImageReference,
} = {}) {
  if (!pool) throw new Error('A database pool is required to create the API.');
  const app = express();
  const isProduction = env.NODE_ENV === 'production';
  const allowedOrigins = parseOrigins(env.CORS_ORIGINS, isProduction);
  const adminPasswordHash = env.ADMIN_PASSWORD_HASH;
  const sessionSecret = env.ADMIN_SESSION_SECRET;
  const cookieName = isProduction ? '__Host-srirudra-admin' : 'srirudra-admin';
  const smtpPort = Number(env.SMTP_PORT);
  const enquiryToEmail = env.ENQUIRY_TO_EMAIL || 'srirudratripsworkplace@gmail.com';
  const whatsappBusinessNumber = (env.WHATSAPP_BUSINESS_NUMBER || '447405958896').replace(/\D/g, '');
  const emailNotificationsConfigured = Boolean(
    env.SMTP_HOST &&
    Number.isInteger(smtpPort) &&
    smtpPort > 0 &&
    env.SMTP_USER &&
    env.SMTP_PASS &&
    isValidEmail(env.ENQUIRY_FROM_EMAIL) &&
    isValidEmail(enquiryToEmail),
  );
  const whatsappNotificationsConfigured = Boolean(
    env.WHATSAPP_ACCESS_TOKEN &&
    env.WHATSAPP_PHONE_NUMBER_ID &&
    /^\d{8,15}$/.test(whatsappBusinessNumber) &&
    env.WHATSAPP_TEMPLATE_NAME &&
    env.WHATSAPP_API_VERSION,
  );
  const mailer = emailNotificationsConfigured
    ? nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 15000,
    })
    : null;

  if (!isValidAdminPasswordHash(adminPasswordHash) ||
      !sessionSecret || Buffer.byteLength(sessionSecret) < 32) {
    throw new Error('Configure a valid ADMIN_PASSWORD_HASH and an ADMIN_SESSION_SECRET of at least 32 characters.');
  }

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY === 'true' ? 1 : false);
  app.use((_request, response, next) => {
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('X-Frame-Options', 'DENY');
    response.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (isProduction) response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    next();
  });
  app.use(cors({
    origin(origin, callback) {
      if (!origin) return callback(null, false);
      return callback(null, allowedOrigins.has(origin));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use((request, response, next) => {
    const bodyLimit = request.method === 'POST' && request.path === '/api/destinations' ? '18mb'
      : request.path === '/api/enquiries' ? '16kb'
      : request.path === '/api/admin/login' ? '2kb'
        : '8mb';
    express.json({ limit: bodyLimit, strict: true })(request, response, next);
  });
  app.use((request, _response, next) => {
    request.cookies = parseCookies(request.get('cookie'));
    next();
  });
  app.use((request, response, next) => {
    if (['POST', 'PUT', 'DELETE'].includes(request.method)) {
      const origin = request.get('origin');
      if (!origin || !allowedOrigins.has(origin)) {
        return response.status(403).json({ error: 'Request origin is not allowed.' });
      }
    }
    next();
  });
  const requireAdmin = createAdminMiddleware({ sessionSecret, cookieName });
  const loginLimiter = createRateLimiter({ limit: 8, windowMs: 15 * 60 * 1000 });
  const enquiryLimiter = createRateLimiter({ limit: 5, windowMs: 15 * 60 * 1000 });


app.get('/health/live', (_request, response) => {
  response.json({ ok: true });
});

app.get('/health', (_request, response) => {
  response.json({ ok: true });
});

app.get('/health/ready', async (_request, response) => {
  try {
    await pool.query('select 1');
    response.json({ ok: true });
  } catch (error) {
    logError('Database readiness check failed.', error);
    response.status(503).json({ ok: false, error: 'Service temporarily unavailable.' });
  }
});

app.post('/api/admin/login', loginLimiter, async (request, response, next) => {
  const password = request.body?.password;
  if (typeof password !== 'string' || password.length > 256) {
    return response.status(401).json({ error: 'Invalid credentials.' });
  }

  try {
    if (!await verifyAdminPassword(password, adminPasswordHash)) {
      return response.status(401).json({ error: 'Invalid credentials.' });
    }
  } catch (error) {
    return next(error);
  }

  const token = createSessionToken(sessionSecret);
  response.setHeader('Set-Cookie', serializeCookie(cookieName, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: 12 * 60 * 60 * 1000,
  }));
  response.json({ authenticated: true, token });
});

app.get('/api/admin/session', (request, response) => {
  response.json({ authenticated: isValidSession(getAdminSessionToken(request, cookieName), sessionSecret) });
});

app.post('/api/admin/logout', (_request, response) => {
  response.setHeader('Set-Cookie', serializeCookie(cookieName, '', {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    path: '/',
    maxAge: 0,
  }));
  response.status(204).end();
});

app.get('/api/trip-data', async (_request, response, next) => {
  try {
    const [categories, destinations] = await Promise.all([
      pool.query('select * from trip_categories where is_active = true order by sort_order asc, title asc'),
      pool.query('select * from destinations where is_active = true order by sort_order asc, name asc'),
    ]);

    response.json({
      categories: categories.rows.map(toCategory),
      destinations: destinations.rows.map(toDestination),
    });
  } catch (error) {
    next(error);
  }
});

app.get('/api/special-trips', async (_request, response, next) => {
  try {
    const result = await pool.query(
      `select id, title, description, image, from_location, destination,
        trip_date::text as trip_date, trip_time::text as trip_time,
        price::text as price, seats, badge, is_active
       from public.special_trips
       where is_active = true
       order by trip_date asc nulls last, created_at desc`,
    );
    response.json(result.rows.map(toSpecialTrip));
  } catch (error) {
    next(error);
  }
});

app.get('/api/customer-reviews', async (_request, response, next) => {
  try {
    const result = await pool.query(
      `select id, name, trip, review, image, is_active, created_at
       from public.customer_reviews
       where is_active = true
       order by created_at desc`,
    );
    response.json(result.rows.map(toCustomerReview));
  } catch (error) {
    next(error);
  }
});

app.get('/api/admin-data', requireAdmin, async (_request, response, next) => {
  try {
    const [categories, destinations, enquiries, specialTrips, customerReviews] = await Promise.all([
      pool.query('select * from trip_categories order by sort_order asc, title asc'),
      pool.query('select * from destinations order by sort_order asc, name asc'),
      pool.query('select * from enquiries order by created_at desc'),
      pool.query(
        `select id, title, description, image, from_location, destination,
          trip_date::text as trip_date, trip_time::text as trip_time,
          price::text as price, seats, badge, is_active
         from public.special_trips
         order by trip_date asc nulls last, created_at desc`,
      ),
      pool.query(
        `select id, name, trip, review, image, is_active, created_at
         from public.customer_reviews
         order by created_at desc`,
      ),
    ]);

    response.json({
      categories: categories.rows.map(toCategory),
      destinations: destinations.rows.map(toDestination),
      enquiries: enquiries.rows.map(toEnquiry),
      specialTrips: specialTrips.rows.map(toSpecialTrip),
      customerReviews: customerReviews.rows.map(toCustomerReview),
    });
  } catch (error) {
    next(error);
  }
});

app.post('/api/enquiries', enquiryLimiter, async (request, response, next) => {
  try {
    const payload = request.body;
    if (!isValidEnquiry(payload)) {
      return response.status(400).json({ error: 'A name, valid mobile number, and trip or service are required.' });
    }
    const phone = payload.phone.trim().replace(/[\s()-]/g, '');

    const result = await pool.query(
      `insert into enquiries (name, phone, email, destination, travellers, travel_date, message)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id, created_at`,
      [
        payload.name.trim(),
        phone,
        typeof payload.email === 'string' && payload.email.trim() ? payload.email.trim() : null,
        payload.destination.trim(),
        String(payload.travellers),
        payload.travelDate || null,
        typeof payload.message === 'string' && payload.message.trim() ? payload.message.trim() : null,
      ],
    );
    const enquiry = result.rows[0];
    if (!enquiry) {
      throw new Error('Enquiry was inserted, but its saved record could not be retrieved.');
    }

    const savedEnquiry = {
      id: enquiry.id,
      name: payload.name.trim(),
      phone,
      email: typeof payload.email === 'string' && payload.email.trim() ? payload.email.trim() : '',
      destination: payload.destination.trim(),
      travelDate: payload.travelDate || '',
      travellers: String(payload.travellers),
      message: typeof payload.message === 'string' ? payload.message.trim() : '',
      createdAt: enquiry.created_at,
    };
    const notifications = await Promise.all([
      Promise.resolve().then(() => (sendEmailNotification || sendEnquiryEmail)(savedEnquiry)).catch(() => 'failed'),
      Promise.resolve().then(() => (sendWhatsAppNotification || sendEnquiryWhatsApp)(savedEnquiry)).catch(() => 'failed'),
    ]);
    response.status(201).json({
      ok: true,
      enquiry: { id: enquiry.id, createdAt: enquiry.created_at },
      notifications: {
        email: notifications[0],
        whatsapp: notifications[1],
      },
    });
  } catch (error) {
    next(error);
  }
});

app.delete('/api/enquiries/:id', requireAdmin, validateReviewId, async (request, response, next) => {
  try {
    await pool.query('delete from enquiries where id = $1', [request.params.id]);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/customer-reviews', requireAdmin, async (request, response, next) => {
  try {
    const reviewInput = isPlainObject(request.body)
      ? { ...request.body, image: await normalizeImageInput(request.body.image, processImage) }
      : request.body;
    const review = validateCustomerReview(reviewInput);
    if (!review) return response.status(400).json({ error: 'Enter a customer name and review, and upload a valid image.' });

    const result = await pool.query(
      `insert into public.customer_reviews (name, trip, review, image, is_active)
       values ($1, $2, $3, $4, $5)
       returning id, name, trip, review, image, is_active, created_at`,
      [review.name, review.trip, review.review, review.image, review.isActive],
    );
    response.status(201).json(toCustomerReview(result.rows[0]));
  } catch (error) {
    if (respondToImageError(error, response)) return;
    next(error);
  }
});

app.put('/api/customer-reviews/:id', requireAdmin, validateReviewId, async (request, response, next) => {
  try {
    const reviewInput = isPlainObject(request.body)
      ? { ...request.body, image: await normalizeImageInput(request.body.image, processImage) }
      : request.body;
    const review = validateCustomerReview(reviewInput);
    if (!review) return response.status(400).json({ error: 'Enter a customer name and review, and upload a valid image.' });

    const result = await pool.query(
      `update public.customer_reviews
       set name = $2, trip = $3, review = $4, image = $5, is_active = $6, updated_at = now()
       where id = $1
       returning id, name, trip, review, image, is_active, created_at`,
      [request.params.id, review.name, review.trip, review.review, review.image, review.isActive],
    );
    if (result.rowCount === 0) return response.status(404).json({ error: 'Customer review not found.' });
    response.json(toCustomerReview(result.rows[0]));
  } catch (error) {
    if (respondToImageError(error, response)) return;
    next(error);
  }
});

app.delete('/api/customer-reviews/:id', requireAdmin, validateReviewId, async (request, response, next) => {
  try {
    await pool.query('delete from public.customer_reviews where id = $1', [request.params.id]);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/special-trips', requireAdmin, async (request, response, next) => {
  try {
    const tripInput = isPlainObject(request.body)
      ? { ...request.body, image: await normalizeImageInput(request.body.image, processImage) }
      : request.body;
    const trip = validateSpecialTrip(tripInput);
    if (!trip) return response.status(400).json({ error: 'Enter a title, destination, and valid trip details.' });

    await pool.query(
      `insert into public.special_trips (
        id, title, description, image, from_location, destination, trip_date,
        trip_time, price, seats, badge, is_active
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      on conflict (id) do update set
        title = excluded.title,
        description = excluded.description,
        image = excluded.image,
        from_location = excluded.from_location,
        destination = excluded.destination,
        trip_date = excluded.trip_date,
        trip_time = excluded.trip_time,
        price = excluded.price,
        seats = excluded.seats,
        badge = excluded.badge,
        is_active = excluded.is_active,
        updated_at = now()`,
      specialTripValues(trip),
    );
    response.status(201).json({ ok: true });
  } catch (error) {
    if (respondToImageError(error, response)) return;
    next(error);
  }
});

app.put('/api/special-trips/:id', requireAdmin, validatePathId, async (request, response, next) => {
  try {
    const tripInput = isPlainObject(request.body)
      ? { ...request.body, id: request.params.id, image: await normalizeImageInput(request.body.image, processImage) }
      : request.body;
    const trip = validateSpecialTrip(tripInput);
    if (!trip) return response.status(400).json({ error: 'Enter a title, destination, and valid trip details.' });

    const result = await pool.query(
      `update public.special_trips set
        title = $2,
        description = $3,
        image = $4,
        from_location = $5,
        destination = $6,
        trip_date = $7,
        trip_time = $8,
        price = $9,
        seats = $10,
        badge = $11,
        is_active = $12,
        updated_at = now()
      where id = $1`,
      specialTripValues(trip),
    );
    if (result.rowCount === 0) return response.status(404).json({ error: 'Special trip not found.' });
    response.status(200).json({ ok: true });
  } catch (error) {
    if (respondToImageError(error, response)) return;
    next(error);
  }
});

app.delete('/api/special-trips/:id', requireAdmin, validatePathId, async (request, response, next) => {
  try {
    await pool.query('delete from public.special_trips where id = $1', [request.params.id]);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/api/trip-categories', requireAdmin, async (request, response, next) => {
  try {
    const categoryInput = isPlainObject(request.body)
      ? { ...request.body, image: await normalizeImageInput(request.body.image, processImage) }
      : request.body;
    const category = validateCategory(categoryInput);
    if (!category) return response.status(400).json({ error: 'Enter valid category details.' });
    await pool.query(
      `insert into trip_categories (id, title, subtitle, tagline, image, icon_name, accent_color, sort_order, is_active)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       on conflict (id) do update set
        title = excluded.title,
        subtitle = excluded.subtitle,
        tagline = excluded.tagline,
        image = excluded.image,
        icon_name = excluded.icon_name,
        accent_color = excluded.accent_color,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active`,
      [
        category.id,
        category.title,
        category.subtitle || '',
        category.tagline || '',
        category.image || '',
        category.iconName || 'map',
        category.accentColor || '#0b5960',
        Number(category.sortOrder) || 0,
        Boolean(category.isActive),
      ],
    );
    response.status(204).end();
  } catch (error) {
    if (respondToImageError(error, response)) return;
    next(error);
  }
});

app.post('/api/destinations', requireAdmin, async (request, response, next) => {
  try {
    const destinationInput = await normalizeDestinationImages(request.body, processImage);
    const destination = validateDestination(destinationInput);
    if (!destination) return response.status(400).json({ error: 'Enter valid destination details.' });
    await pool.query(
      `insert into destinations (
        id, category_id, name, image, short_description, overview, duration,
        places_to_visit, highlights, extra_info, sort_order, is_active
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      on conflict (id) do update set
        category_id = excluded.category_id,
        name = excluded.name,
        image = excluded.image,
        short_description = excluded.short_description,
        overview = excluded.overview,
        duration = excluded.duration,
        places_to_visit = excluded.places_to_visit,
        highlights = excluded.highlights,
        extra_info = excluded.extra_info,
        sort_order = excluded.sort_order,
        is_active = excluded.is_active`,
      [
        destination.id,
        destination.categoryId,
        destination.name,
        serializeDestinationImages(destination),
        destination.shortDescription || '',
        destination.overview || '',
        destination.duration || '',
        destination.placesToVisit || [],
        destination.highlights || [],
        destination.extraInfo || '',
        Number(destination.sortOrder) || 0,
        Boolean(destination.isActive),
      ],
    );
    response.status(204).end();
  } catch (error) {
    if (respondToImageError(error, response)) return;
    next(error);
  }
});

app.delete('/api/trip-categories/:id', requireAdmin, validatePathId, async (request, response, next) => {
  try {
    await pool.query('delete from trip_categories where id = $1', [request.params.id]);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.delete('/api/destinations/:id', requireAdmin, validatePathId, async (request, response, next) => {
  try {
    await pool.query('delete from destinations where id = $1', [request.params.id]);
    response.status(204).end();
  } catch (error) {
    next(error);
  }
});

async function sendEnquiryEmail(enquiry) {
  if (!mailer) return 'disabled';

  try {
    await mailer.sendMail({
      from: env.ENQUIRY_FROM_EMAIL,
      to: enquiryToEmail,
      subject: 'New Sri Rudra Trips enquiry',
      text: [
        `Enquiry ID: ${enquiry.id}`,
        `Submitted: ${new Date(enquiry.createdAt).toISOString()}`,
        `Customer name: ${enquiry.name}`,
        `Customer phone: ${enquiry.phone}`,
        `Customer email: ${enquiry.email || 'Not provided'}`,
        `Destination: ${enquiry.destination}`,
        `Travel date: ${enquiry.travelDate || 'Not specified'}`,
        `Travellers: ${enquiry.travellers}`,
        `Message: ${enquiry.message || 'Not provided'}`,
      ].join('\n'),
    });
    return 'sent';
  } catch (error) {
    console.error('Enquiry email notification failed.', {
      errorCode: error?.code || error?.responseCode || error?.name || 'unknown',
    });
    return 'failed';
  }
}

async function sendEnquiryWhatsApp(enquiry) {
  if (!whatsappNotificationsConfigured) return 'disabled';

  try {
    const apiVersion = env.WHATSAPP_API_VERSION.replace(/^\/+|\/+$/g, '');
    const response = await fetch(
      `https://graph.facebook.com/${apiVersion}/${encodeURIComponent(env.WHATSAPP_PHONE_NUMBER_ID)}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: whatsappBusinessNumber,
          type: 'template',
          template: {
            name: env.WHATSAPP_TEMPLATE_NAME,
            language: { code: 'en' },
            components: [{
              type: 'body',
              parameters: [
                enquiry.name,
                enquiry.phone,
                enquiry.email || 'Not provided',
                enquiry.destination,
                enquiry.travelDate || 'Not specified',
                enquiry.travellers,
                enquiry.message || 'Not provided',
                new Date(enquiry.createdAt).toISOString(),
                enquiry.id,
              ].map((text) => ({ type: 'text', text: String(text) })),
            }],
          },
        }),
      },
    );
    if (!response.ok) {
      console.error('Enquiry WhatsApp notification failed.', {
        httpStatus: response.status,
      });
      return 'failed';
    }
    return 'accepted';
  } catch (error) {
    console.error('Enquiry WhatsApp notification failed.', {
      errorCode: error?.code || error?.name || 'unknown',
    });
    return 'failed';
  }
}

app.use((_request, response) => {
  response.status(404).json({ error: 'Not found.' });
});

app.use((error, _request, response, _next) => {
  logError('API request failed.', error);
  const status = error?.type === 'entity.too.large' ? 413
    : error?.type === 'entity.parse.failed' ? 400
      : 500;
  const message = status === 413 ? 'Request body too large.'
    : status === 400 ? 'Invalid JSON request body.'
      : 'Service temporarily unavailable.';
  response.status(status).json({ error: message });
});

return app;
}

export async function startApiServer({ env = process.env } = {}) {
  console.log('API startup: validating configuration.');
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL must be configured.');
  if (env.NODE_ENV === 'production' && !env.CORS_ORIGINS) {
    throw new Error('CORS_ORIGINS must list the production frontend origin.');
  }
  const port = Number(env.PORT || env.LOCAL_API_PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT must be a valid TCP port.');

const pool = new Pool({
  connectionString: env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  idleTimeoutMillis: 30000,
  max: Number(env.PG_POOL_MAX || 10),
  statement_timeout: 15000,
  ssl: env.NODE_ENV === 'production'
    ? {
        ca: readFileSync(
          new URL('../certs/supabase-prod-ca-2021.crt', import.meta.url),
          'utf8'
        ),
        rejectUnauthorized: true,
      }
    : undefined,
});

  pool.on('error', (error) => logError('Unexpected database pool error.', error));
  let app;
  try {
    app = createApiApp({ pool, env });
  } catch (error) {
    await pool.end();
    throw error;
  }
  // Pool construction and SMTP transport setup are local and lazy. Do not wait
  // for external services here; /health/ready performs the database check.
  console.log('API startup: configuration validated; binding HTTP listener.');
  const server = app.listen(port, '0.0.0.0');
  try {
    await once(server, 'listening');
  } catch (error) {
    await pool.end();
    throw error;
  }
  console.log(`API startup: listening on 0.0.0.0:${port}.`);
  server.headersTimeout = 15_000;
  server.requestTimeout = 30_000;
  server.keepAliveTimeout = 5_000;

  let shutdownStarted = false;
  const shutdown = async (signal) => {
    if (shutdownStarted) return;
    shutdownStarted = true;
    console.log(`Received ${signal}; shutting down API.`);
    try {
      await closeApiServer(server, pool);
    } catch {
      console.error('Could not close the API server and database pool cleanly.');
      process.exitCode = 1;
    }
  };
  process.once('SIGTERM', () => { void shutdown('SIGTERM'); });
  process.once('SIGINT', () => { void shutdown('SIGINT'); });

  return { app, pool, server, shutdown };
}

export async function closeApiServer(server, pool) {
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  await pool.end();
}

function toCategory(row) {
  return {
    id: row.id,
    title: row.title,
    subtitle: row.subtitle || '',
    tagline: row.tagline || '',
    image: row.image || '',
    iconName: row.icon_name || 'map',
    accentColor: row.accent_color || '#0b5960',
    sortOrder: row.sort_order || 0,
    isActive: row.is_active ?? true,
  };
}

function parseOrigins(configuredOrigins, isProduction) {
  const rawOrigins = configuredOrigins
    ? configuredOrigins.split(',').map((origin) => origin.trim()).filter(Boolean)
    : isProduction ? [] : defaultLocalOrigins;
  const origins = new Set();
  for (const origin of rawOrigins) {
    let parsed;
    try {
      parsed = new URL(origin);
    } catch {
      throw new Error('CORS_ORIGINS must contain valid origin URLs.');
    }
    if (!['http:', 'https:'].includes(parsed.protocol) || parsed.origin !== origin || origin === '*') {
      throw new Error('CORS_ORIGINS must contain exact HTTP or HTTPS origins only.');
    }
    origins.add(origin);
  }
  if (isProduction && origins.size === 0) throw new Error('CORS_ORIGINS must include the production frontend origin.');
  return origins;
}

function parseCookies(header = '') {
  return Object.fromEntries(header.split(';').map((part) => {
    const separator = part.indexOf('=');
    if (separator < 0) return ['', ''];
    const key = part.slice(0, separator).trim();
    try {
      return [key, decodeURIComponent(part.slice(separator + 1).trim())];
    } catch {
      return [key, ''];
    }
  }).filter(([key]) => key));
}

function serializeCookie(name, value, { httpOnly, secure, sameSite, path, maxAge }) {
  return [
    `${name}=${encodeURIComponent(value)}`,
    `Path=${path}`,
    `SameSite=${sameSite[0].toUpperCase()}${sameSite.slice(1)}`,
    ...(httpOnly ? ['HttpOnly'] : []),
    ...(secure ? ['Secure'] : []),
    `Max-Age=${Math.floor(maxAge / 1000)}`,
  ].join('; ');
}

function createSessionToken(secret) {
  const payload = Buffer.from(JSON.stringify({
    role: 'admin',
    exp: Date.now() + 12 * 60 * 60 * 1000,
  })).toString('base64url');
  const signature = createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

function isValidSession(token, secret) {
  if (typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const expected = createHmac('sha256', secret).update(parts[0]).digest();
  let actual;
  try {
    actual = Buffer.from(parts[1], 'base64url');
  } catch {
    return false;
  }
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) return false;
  try {
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString('utf8'));
    return payload.role === 'admin' && Number.isFinite(payload.exp) &&
      payload.exp > Date.now() && payload.exp <= Date.now() + 12 * 60 * 60 * 1000 + 5000;
  } catch {
    return false;
  }
}

function createAdminMiddleware({ sessionSecret, cookieName }) {
  return (request, response, next) => {
    if (!isValidSession(getAdminSessionToken(request, cookieName), sessionSecret)) {
      return response.status(401).json({ error: 'Authentication required.' });
    }
    next();
  };
}

function getAdminSessionToken(request, cookieName) {
  const authorization = request.get('authorization');
  const bearerToken = typeof authorization === 'string'
    ? /^Bearer\s+(\S+)$/i.exec(authorization)?.[1]
    : undefined;
  return request.cookies?.[cookieName] || bearerToken;
}

function validatePathId(request, response, next) {
  if (!isValidId(request.params.id)) return response.status(400).json({ error: 'Invalid record identifier.' });
  next();
}

function validateReviewId(request, response, next) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(request.params.id)) {
    return response.status(400).json({ error: 'Invalid record identifier.' });
  }
  next();
}

function createRateLimiter({ limit, windowMs }) {
  const attempts = new Map();
  return (request, response, next) => {
    const now = Date.now();
    const key = request.ip || request.socket.remoteAddress || 'unknown';
    let entry = attempts.get(key);
    if (!entry || entry.resetAt <= now) {
      entry = { count: 0, resetAt: now + windowMs };
      attempts.set(key, entry);
    }
    entry.count += 1;
    if (attempts.size > 4096) {
      for (const [address, value] of attempts) {
        if (value.resetAt <= now) attempts.delete(address);
      }
      while (attempts.size > 4096) {
        attempts.delete(attempts.keys().next().value);
      }
    }
    if (entry.count > limit) {
      response.setHeader('Retry-After', String(Math.max(1, Math.ceil((entry.resetAt - now) / 1000))));
      return response.status(429).json({ error: 'Too many requests. Please try again later.' });
    }
    next();
  };
}

function logError(message, error) {
  console.error(message, {
    errorCode: typeof error?.code === 'string' ? error.code : 'unknown',
  });
}

async function normalizeImageInput(value, processImage) {
  if (typeof value !== 'string' || value === '') return value;
  if (value.startsWith('data:')) return processImageDataUrl(value);
  if (value.startsWith('/')) return value;
  if (value.length > 4096) throw new ImageInputError('The image URL is too long.');
  return processImage(value);
}

async function normalizeDestinationImages(value, processImage) {
  if (!isPlainObject(value)) return value;
  const sourceImages = Array.isArray(value.images) ? value.images : value.image ? [value.image] : [];
  if (sourceImages.length > 6) throw new ImageInputError('A destination can have up to 6 images.');
  const images = [];
  for (const image of sourceImages) {
    images.push(await normalizeImageInput(image, processImage));
  }
  return { ...value, images, image: images[0] || '' };
}

function respondToImageError(error, response) {
  if (!(error instanceof ImageInputError)) return false;
  response.status(error.statusCode).json({ error: error.message });
  return true;
}

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value, maxLength, required = false) {
  return typeof value === 'string' && value.length <= maxLength && (!required || value.trim().length > 0);
}

function isValidEnquiry(value) {
  if (!isPlainObject(value)) return false;
  if (!isText(value.name, 120, true) || !isValidPhone(value.phone) ||
      !isText(value.destination, 160, true) || !isPassengerCount(value.travellers)) return false;
  if (value.email != null && value.email !== '' &&
      (!isText(value.email, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.email.trim()))) return false;
  if (value.message != null && !isText(value.message, 2000)) return false;
  return value.travelDate == null || value.travelDate === '' || isUpcomingOptionalDate(value.travelDate);
}

function isValidEmail(value) {
  return typeof value === 'string' && value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isSafeImage(value, maxLength = 4096) {
  if (typeof value !== 'string') return false;
  if (!value) return true;
  if (value.startsWith('data:')) return validateImageDataUrl(value);
  if (value.length > maxLength) return false;
  if (value.startsWith('/')) return !value.startsWith('//') && !value.includes('\\') && !/\s/.test(value);
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password &&
      (!url.port || url.port === '443') &&
      !['localhost'].includes(url.hostname.toLowerCase()) &&
      !url.hostname.toLowerCase().endsWith('.localhost') &&
      !url.hostname.toLowerCase().endsWith('.local') &&
      !url.hostname.toLowerCase().endsWith('.internal');
  } catch {
    return false;
  }
}

function validateCategory(value) {
  if (!isPlainObject(value) || !isValidId(value.id) || !isText(value.title, 120, true)) return null;
  if (!isText(value.subtitle ?? '', 180) || !isText(value.tagline ?? '', 100) ||
      !isSafeImage(value.image ?? '') || !isText(value.iconName ?? 'map', 40) ||
      !/^#[0-9a-f]{6}$/i.test(value.accentColor ?? '#0b5960') ||
      !isSortOrder(value.sortOrder ?? 0) || typeof (value.isActive ?? true) !== 'boolean') return null;
  return {
    ...value,
    title: value.title.trim(),
    subtitle: (value.subtitle ?? '').trim(),
    tagline: (value.tagline ?? '').trim(),
    image: value.image ?? '',
    iconName: value.iconName ?? 'map',
    accentColor: value.accentColor ?? '#0b5960',
    sortOrder: value.sortOrder ?? 0,
    isActive: value.isActive ?? true,
  };
}

function validateDestination(value) {
  if (!isPlainObject(value) || !isValidId(value.id) || !isValidId(value.categoryId) ||
      !isText(value.name, 120, true)) return null;
  const images = Array.isArray(value.images) ? value.images : value.image ? [value.image] : [];
  if (images.length > 6 || !images.every((image) => isSafeImage(image))) return null;
  if (!isText(value.shortDescription ?? '', 300) || !isText(value.overview ?? '', 4000) ||
      !isText(value.duration ?? '', 80) || !isStringList(value.placesToVisit ?? [], 50, 200) ||
      !isStringList(value.highlights ?? [], 50, 200) || !isText(value.extraInfo ?? '', 2000) ||
      !isSortOrder(value.sortOrder ?? 0) || typeof (value.isActive ?? true) !== 'boolean') return null;
  return {
    ...value,
    name: value.name.trim(),
    images,
    image: images[0] || '',
    shortDescription: value.shortDescription ?? '',
    overview: value.overview ?? '',
    duration: value.duration ?? '',
    placesToVisit: value.placesToVisit ?? [],
    highlights: value.highlights ?? [],
    extraInfo: value.extraInfo ?? '',
    sortOrder: value.sortOrder ?? 0,
    isActive: value.isActive ?? true,
  };
}

function isValidId(value) {
  return typeof value === 'string' && value.length <= 120 && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
}

function isSortOrder(value) {
  return Number.isInteger(value) && value >= 0 && value <= 100000;
}

function isStringList(value, maxItems, maxLength) {
  return Array.isArray(value) && value.length <= maxItems &&
    value.every((item) => isText(item, maxLength));
}

function toDestination(row) {
  const storedImage = row.image || '';
  let images = [storedImage].filter(Boolean);
  if (storedImage.startsWith('[')) {
    try {
      const parsedImages = JSON.parse(storedImage);
      if (Array.isArray(parsedImages) && parsedImages.every((image) => typeof image === 'string')) {
        images = parsedImages.filter(Boolean);
      }
    } catch {
      images = [storedImage];
    }
  }

  return {
    id: row.id,
    categoryId: row.category_id,
    name: row.name,
    image: images[0] || '',
    images,
    shortDescription: row.short_description || '',
    overview: row.overview || '',
    duration: row.duration || '',
    placesToVisit: row.places_to_visit || [],
    highlights: row.highlights || [],
    extraInfo: row.extra_info || '',
    sortOrder: row.sort_order || 0,
    isActive: row.is_active ?? true,
  };
}

function serializeDestinationImages(destination) {
  const images = Array.isArray(destination.images)
    ? destination.images.filter((image) => typeof image === 'string' && image.trim()).map((image) => image.trim())
    : [];
  if (images.length > 1) return JSON.stringify(images);
  return images[0] || (typeof destination.image === 'string' ? destination.image.trim() : '');
}

function toEnquiry(row) {
  return {
    id: row.id,
    name: row.name,
    phone: row.phone,
    email: row.email || '',
    destination: row.destination,
    travellers: row.travellers || '',
    travelDate: row.travel_date || '',
    message: row.message || '',
    createdAt: row.created_at,
  };
}

function toSpecialTrip(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || '',
    image: row.image || '',
    fromLocation: row.from_location || '',
    destination: row.destination,
    tripDate: row.trip_date || '',
    tripTime: row.trip_time ? String(row.trip_time).slice(0, 5) : '',
    price: row.price === null ? '' : String(row.price),
    seats: row.seats,
    badge: row.badge || '',
    isActive: row.is_active ?? true,
  };
}

function validateSpecialTrip(value) {
  if (!isPlainObject(value) || !isValidId(value.id) || !isText(value.title, 120, true) ||
      !isText(value.destination, 160, true)) return null;
  if (!isOptionalDate(value.tripDate) || !isOptionalTime(value.tripTime)) return null;
  if (!isOptionalNonNegativeNumber(value.price) || !isOptionalNonNegativeInteger(value.seats)) return null;
  if (!isText(value.description ?? '', 2000) || !isSafeImage(value.image ?? '') ||
      !isText(value.fromLocation ?? '', 120) || !isText(value.badge ?? '', 80) ||
      typeof (value.isActive ?? false) !== 'boolean') return null;

  return {
    id: value.id.trim(),
    title: value.title.trim(),
    description: (value.description ?? '').trim(),
    image: value.image ?? '',
    fromLocation: (value.fromLocation ?? '').trim(),
    destination: value.destination.trim(),
    tripDate: value.tripDate || null,
    tripTime: value.tripTime || null,
    price: value.price === '' || value.price == null ? null : String(value.price),
    seats: value.seats === '' || value.seats == null ? null : Number(value.seats),
    badge: (value.badge ?? '').trim(),
    isActive: value.isActive === true,
  };
}

function specialTripValues(trip) {
  return [
    trip.id,
    trip.title,
    trip.description,
    trip.image,
    trip.fromLocation,
    trip.destination,
    trip.tripDate,
    trip.tripTime,
    trip.price,
    trip.seats,
    trip.badge,
    trip.isActive,
  ];
}

function isNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function isValidPhone(value) {
  if (typeof value !== 'string') return false;
  const normalized = value.trim().replace(/[\s()-]/g, '');
  if (!/^\+\d{11,13}$/.test(normalized)) return false;

  const digits = normalized.slice(1);
  const callingCodes = ['971', '353', '64', '65', '61', '27', '44', '91', '1'];
  const callingCode = callingCodes.find((code) => digits.startsWith(code));
  return Boolean(callingCode && digits.slice(callingCode.length).length === 10);
}

function isPassengerCount(value) {
  if (typeof value === 'string') return /^[1-6]$/.test(value);
  return Number.isInteger(value) && value >= 1 && value <= 6;
}

function isOptionalDate(value) {
  if (value === '' || value == null) return true;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function isUpcomingOptionalDate(value) {
  return isOptionalDate(value) && (value === '' || value == null || value >= new Date().toISOString().slice(0, 10));
}

function isOptionalTime(value) {
  return value === '' || value == null || (typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value));
}

function isOptionalNonNegativeNumber(value) {
  if (value === '' || value == null) return true;
  return Number.isFinite(Number(value)) && Number(value) >= 0 && /^\d+(\.\d{1,2})?$/.test(String(value));
}

function isOptionalNonNegativeInteger(value) {
  if (value === '' || value == null) return true;
  return Number.isInteger(Number(value)) && Number(value) >= 0;
}
