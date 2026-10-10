import { describe, expect, it } from 'vitest';
import { resolveApiBaseUrl } from './runtime';

describe('resolveApiBaseUrl', () => {
  it('prefers a configured public API base URL', () => {
    expect(resolveApiBaseUrl('https://api.example.com')).toBe('https://api.example.com');
  });

  it('uses the local API port on localhost development hosts', () => {
    expect(
      resolveApiBaseUrl(undefined, { hostname: 'localhost', protocol: 'http:', origin: 'http://localhost:5173' }),
    ).toBe('http://localhost:8787');
  });

  it('uses the current origin for production-like hosts', () => {
    expect(
      resolveApiBaseUrl(undefined, { hostname: 'www.srirudratrips.com', protocol: 'https:', origin: 'https://www.srirudratrips.com' }),
    ).toBe('https://www.srirudratrips.com');
  });
});
