import { lookup } from 'node:dns/promises';
import https from 'node:https';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import sharp from 'sharp';

export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const IMAGE_TIMEOUT_MS = 10000;
const MIME_FORMATS = new Map([
  ['image/jpeg', 'jpeg'],
  ['image/png', 'png'],
  ['image/webp', 'webp'],
]);
const IMAGE_SIGNATURES = {
  jpeg: (buffer) => buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff,
  png: (buffer) => buffer.length >= 8 && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  webp: (buffer) => buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP',
};

export class ImageInputError extends Error {
  statusCode = 400;
}

export async function processImageReference(value, {
  resolveAddresses = resolvePublicAddresses,
  requestImage = requestPinnedHttpsImage,
} = {}) {
  if (typeof value !== 'string') throw new ImageInputError('Image must be a supported image file or HTTPS URL.');
  const url = parseExternalImageUrl(value);
  let currentUrl = url;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const addresses = await resolveAddresses(currentUrl.hostname);
    if (!Array.isArray(addresses) || addresses.length === 0 ||
        addresses.some(({ address }) => !isPublicAddress(address))) {
      throw new ImageInputError('The image URL resolves to a blocked address.');
    }
    const response = await requestImage(currentUrl, addresses[0]);
    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      if (redirectCount === MAX_REDIRECTS || typeof response.location !== 'string') {
        throw new ImageInputError('The image URL redirected too many times.');
      }
      try {
        currentUrl = parseExternalImageUrl(new URL(response.location, currentUrl).href);
      } catch (error) {
        if (error instanceof ImageInputError) throw error;
        throw new ImageInputError('The image URL returned an invalid redirect.');
      }
      continue;
    }
    if (response.statusCode !== 200) throw new ImageInputError('The image URL could not be downloaded.');
    if (!Buffer.isBuffer(response.body) || response.body.length > MAX_DOWNLOAD_BYTES) {
      throw new ImageInputError('The image exceeds the 20 MB download limit.');
    }

    const contentType = String(response.contentType || '').split(';', 1)[0].trim().toLowerCase();
    const format = MIME_FORMATS.get(contentType);
    if (!format || !isImageSignature(response.body, format)) {
      throw new ImageInputError('The URL must provide a valid JPEG, PNG, or WebP image.');
    }
    return storeImageBuffer(response.body, format);
  }

  throw new ImageInputError('The image URL could not be downloaded safely.');
}

export async function processImageDataUrl(value) {
  if (typeof value !== 'string') throw new ImageInputError('Image must be a supported image file.');
  const match = /^data:(image\/(?:jpeg|png|webp));base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/.exec(value);
  if (!match) throw new ImageInputError('The image data URL is malformed or uses an unsupported format.');
  const format = MIME_FORMATS.get(match[1]);
  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.toString('base64') !== match[2]) {
    throw new ImageInputError('The image data URL is malformed.');
  }
  if (buffer.length > MAX_IMAGE_BYTES) throw new ImageInputError('The image exceeds the 2 MB upload limit.');
  return storeImageBuffer(buffer, format);
}

export async function storeImageBuffer(buffer, expectedFormat) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0 || buffer.length > MAX_DOWNLOAD_BYTES) {
    throw new ImageInputError('The image is empty or exceeds the 20 MB download limit.');
  }
  if (!isImageSignature(buffer, expectedFormat)) {
    throw new ImageInputError('The image content does not match its declared file type.');
  }

  let metadata;
  try {
    metadata = await sharp(buffer, { limitInputPixels: 50_000_000 }).metadata();
    if (!metadata.width || !metadata.height || metadata.format !== expectedFormat) {
      throw new Error('Image format mismatch.');
    }
    await sharp(buffer, { limitInputPixels: 50_000_000 }).stats();
  } catch {
    throw new ImageInputError('The image is corrupt, unsupported, or too large to process.');
  }

  if (buffer.length <= MAX_IMAGE_BYTES) {
    return `data:${formatMimeType(expectedFormat)};base64,${buffer.toString('base64')}`;
  }

  let maxDimension = Math.min(4096, Math.max(metadata.width, metadata.height));
  const qualities = [88, 80, 72, 64, 56, 48, 40, 32];
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const pipeline = sharp(buffer, { limitInputPixels: 50_000_000 }).rotate();
    if (maxDimension < Math.max(metadata.width, metadata.height)) {
      pipeline.resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true });
    }

    for (const quality of qualities) {
      let output;
      try {
        output = await pipeline.clone().webp({ quality, effort: 4 }).toBuffer();
      } catch {
        throw new ImageInputError('The image could not be compressed.');
      }
      if (output.length <= MAX_IMAGE_BYTES) {
        return `data:image/webp;base64,${output.toString('base64')}`;
      }
    }

    if (maxDimension <= 128) break;
    maxDimension = Math.max(128, Math.floor(maxDimension * 0.8));
  }
  throw new ImageInputError('The image could not be compressed to 2 MB. Choose a smaller image.');
}

export function validateImageDataUrl(value) {
  if (typeof value !== 'string') return false;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,((?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?)$/.exec(value);
  if (!match) return false;
  const format = MIME_FORMATS.get(match[1]);
  const buffer = Buffer.from(match[2], 'base64');
  return buffer.length > 0 && buffer.length <= MAX_IMAGE_BYTES &&
    buffer.toString('base64') === match[2] && isImageSignature(buffer, format);
}

export function isPublicAddress(address) {
  if (typeof address !== 'string' || !isIP(address)) return false;
  try {
    return ipaddr.process(address).range() === 'unicast';
  } catch {
    return false;
  }
}

function isImageSignature(buffer, format) {
  return Buffer.isBuffer(buffer) && IMAGE_SIGNATURES[format]?.(buffer) === true;
}

function formatMimeType(format) {
  return format === 'jpeg' ? 'image/jpeg' : `image/${format}`;
}

function parseExternalImageUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new ImageInputError('Enter a valid HTTPS image URL.');
  }
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (url.protocol !== 'https:' || url.username || url.password ||
      (url.port && url.port !== '443') || !hostname ||
      hostname === 'localhost' || hostname.endsWith('.localhost') ||
      hostname.endsWith('.local') || hostname.endsWith('.internal')) {
    throw new ImageInputError('Only public HTTPS image URLs are allowed.');
  }
  return url;
}

async function resolvePublicAddresses(hostname) {
  const plainHostname = hostname.replace(/^\[|\]$/g, '');
  if (isIP(plainHostname)) return [{ address: plainHostname }];

  let addresses;
  let timeout;
  try {
    addresses = await Promise.race([
      lookup(plainHostname, { all: true, verbatim: true }),
      new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new ImageInputError('The image URL host lookup timed out.')), 5000);
      }),
    ]);
  } catch {
    throw new ImageInputError('The image URL host could not be resolved.');
  } finally {
    clearTimeout(timeout);
  }
  if (addresses.length === 0 || addresses.some(({ address }) => !isPublicAddress(address))) {
    throw new ImageInputError('The image URL resolves to a blocked address.');
  }
  return addresses;
}

function requestPinnedHttpsImage(url, address) {
  return new Promise((resolve, reject) => {
    const family = isIP(address.address);
    const agent = new https.Agent({
      keepAlive: false,
      lookup: (_hostname, options, callback) => {
        if (options?.all) callback(null, [{ address: address.address, family }]);
        else callback(null, address.address, family);
      },
    });
    const request = https.request(url, {
      agent,
      headers: { Accept: 'image/jpeg,image/png,image/webp' },
      method: 'GET',
      timeout: IMAGE_TIMEOUT_MS,
    }, (response) => {
      response.once('error', (error) => {
        agent.destroy();
        reject(error instanceof ImageInputError
          ? error
          : new ImageInputError('The image download was interrupted.'));
      });
      const statusCode = response.statusCode || 0;
      const location = response.headers.location;
      if ([301, 302, 303, 307, 308].includes(statusCode)) {
        response.destroy();
        agent.destroy();
        resolve({ statusCode, location });
        return;
      }
      if (statusCode !== 200) {
        response.destroy();
        agent.destroy();
        resolve({ statusCode });
        return;
      }

      const contentLengthHeader = response.headers['content-length'];
      const contentLength = contentLengthHeader === undefined ? null : Number(contentLengthHeader);
      if (contentLengthHeader !== undefined &&
          (!Number.isSafeInteger(contentLength) || contentLength < 0 || contentLength > MAX_DOWNLOAD_BYTES)) {
        response.destroy(new ImageInputError('The image response has an invalid or oversized content length.'));
        agent.destroy();
        return;
      }
      const chunks = [];
      let downloadedBytes = 0;
      response.on('data', (chunk) => {
        downloadedBytes += chunk.length;
        if (downloadedBytes > MAX_DOWNLOAD_BYTES) {
          response.destroy(new ImageInputError('The image exceeds the 20 MB download limit.'));
          return;
        }
        chunks.push(chunk);
      });
      response.once('end', () => {
        agent.destroy();
        resolve({
          statusCode,
          contentType: response.headers['content-type'],
          body: Buffer.concat(chunks, downloadedBytes),
        });
      });
    });
    const timeout = setTimeout(() => request.destroy(new ImageInputError('The image download timed out.')), IMAGE_TIMEOUT_MS);
    request.once('close', () => clearTimeout(timeout));
    request.once('error', (error) => {
      agent.destroy();
      reject(error instanceof ImageInputError
        ? error
        : new ImageInputError('The image URL could not be downloaded safely.'));
    });
    request.end();
  });
}
