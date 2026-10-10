import { randomFillSync } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it, vi } from 'vitest';
import {
  MAX_IMAGE_BYTES,
  ImageInputError,
  isPublicAddress,
  processImageDataUrl,
  processImageReference,
  storeImageBuffer,
} from './images.mjs';

async function makePng(width = 4, height = 4, noisy = false) {
  const pixels = noisy
    ? randomFillSync(Buffer.alloc(width * height * 3))
    : Buffer.alloc(width * height * 3, 120);
  return sharp(pixels, { raw: { width, height, channels: 3 } }).png(noisy ? { compressionLevel: 0 } : {}).toBuffer();
}

describe('admin image processing', () => {
  it('keeps valid images under 2 MB and accepts correctly encoded Base64', async () => {
    const image = await makePng();
    const result = await storeImageBuffer(image, 'png');
    expect(result).toBe(`data:image/png;base64,${image.toString('base64')}`);
    await expect(processImageDataUrl(result)).resolves.toBe(result);
  });

  it('rejects malformed, mislabeled, and oversized Base64 images', async () => {
    const validImage = await makePng();
    await expect(processImageDataUrl('data:image/png;base64,not-base64!')).rejects.toThrow(/malformed|unsupported/i);
    await expect(processImageDataUrl(`data:image/jpeg;base64,${validImage.toString('base64')}`)).rejects.toThrow(/match|corrupt/i);
    const oversized = Buffer.concat([validImage, Buffer.alloc(MAX_IMAGE_BYTES)]);
    await expect(processImageDataUrl(`data:image/png;base64,${oversized.toString('base64')}`)).rejects.toThrow(/2 MB/);
  });

  it('compresses a valid oversized image and verifies the final binary size', async () => {
    const largeImage = await makePng(1024, 1024, true);
    expect(largeImage.length).toBeGreaterThan(MAX_IMAGE_BYTES);
    const dataUrl = await storeImageBuffer(largeImage, 'png');
    const [header, encoded] = dataUrl.split(',');
    const finalImage = Buffer.from(encoded, 'base64');
    expect(header).toBe('data:image/webp;base64');
    expect(finalImage.length).toBeLessThanOrEqual(MAX_IMAGE_BYTES);
    await expect(sharp(finalImage).metadata()).resolves.toMatchObject({ format: 'webp' });
  });

  it('compresses oversized HTTPS image downloads before storing them', async () => {
    const image = await makePng(1024, 1024, true);
    const dataUrl = await processImageReference('https://images.example/large.png', {
      resolveAddresses: async () => [{ address: '93.184.216.34', family: 4 }],
      requestImage: async () => ({ statusCode: 200, contentType: 'image/png', body: image }),
    });
    const [header, encoded] = dataUrl.split(',');
    expect(header).toBe('data:image/webp;base64');
    expect(Buffer.from(encoded, 'base64').length).toBeLessThanOrEqual(MAX_IMAGE_BYTES);
  });

  it('rejects oversized data that is not a decodable image', async () => {
    const invalidImage = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), randomFillSync(Buffer.alloc(MAX_IMAGE_BYTES))]);
    await expect(storeImageBuffer(invalidImage, 'png')).rejects.toBeInstanceOf(ImageInputError);
  });

  it('downloads valid HTTPS images and stores the verified image content', async () => {
    const image = await makePng();
    const requestImage = vi.fn(async () => ({
      statusCode: 200,
      contentType: 'image/png',
      body: image,
    }));
    const resolveAddresses = vi.fn(async () => [{ address: '93.184.216.34', family: 4 }]);
    const result = await processImageReference('https://images.example/photo.png', { resolveAddresses, requestImage });
    expect(result).toBe(`data:image/png;base64,${image.toString('base64')}`);
    expect(requestImage).toHaveBeenCalledOnce();
  });

  it('rejects non-HTTPS, private/internal, and unsafe redirected URLs before requesting them', async () => {
    const requestImage = vi.fn();
    await expect(processImageReference('http://images.example/photo.png', { requestImage })).rejects.toThrow(/HTTPS/);
    await expect(processImageReference('https://127.0.0.1/photo.png', { requestImage })).rejects.toThrow(/blocked/);
    await expect(processImageReference('https://metadata.internal/photo.png', { requestImage })).rejects.toThrow(/allowed/);
    expect(requestImage).not.toHaveBeenCalled();
  });

  it('resolves and revalidates every redirect destination', async () => {
    const resolveAddresses = vi.fn(async (hostname) => hostname === 'images.example'
      ? [{ address: '93.184.216.34', family: 4 }]
      : [{ address: '10.0.0.1', family: 4 }]);
    const requestImage = vi.fn(async () => ({ statusCode: 302, location: 'https://private.example/image' }));
    await expect(processImageReference('https://images.example/photo.png', { resolveAddresses, requestImage })).rejects.toThrow(/blocked/);
    expect(resolveAddresses).toHaveBeenCalledTimes(2);
    expect(requestImage).toHaveBeenCalledOnce();
  });

  it('rejects content that is not a supported image and responses over the download cap', async () => {
    const image = await makePng();
    const resolveAddresses = async () => [{ address: '93.184.216.34', family: 4 }];
    await expect(processImageReference('https://images.example/photo', {
      resolveAddresses,
      requestImage: async () => ({ statusCode: 200, contentType: 'text/html', body: image }),
    })).rejects.toThrow(/valid JPEG, PNG, or WebP/);
    await expect(processImageReference('https://images.example/photo', {
      resolveAddresses,
      requestImage: async () => ({
        statusCode: 200,
        contentType: 'image/png',
        body: Buffer.alloc(20 * 1024 * 1024 + 1),
      }),
    })).rejects.toThrow(/20 MB/);
  });

  it('blocks non-public IPv4 and IPv6 ranges', () => {
    for (const address of ['127.0.0.1', '10.0.0.1', '169.254.1.1', '::1', 'fc00::1', '::ffff:127.0.0.1']) {
      expect(isPublicAddress(address), address).toBe(false);
    }
    expect(isPublicAddress('8.8.8.8')).toBe(true);
    expect(isPublicAddress('2001:4860:4860::8888')).toBe(true);
  });
});
