export type RuntimeLocation = Pick<Location, 'hostname' | 'origin' | 'protocol'>;

export function resolveApiBaseUrl(
  envBaseUrl?: string,
  location: RuntimeLocation | undefined = typeof window !== 'undefined' ? window.location : undefined,
) {
  const trimmedBaseUrl = (envBaseUrl ?? '').trim().replace(/\/+$/, '');
  if (trimmedBaseUrl) {
    return trimmedBaseUrl;
  }

  if (!location) {
    return 'http://localhost:8787';
  }

  const isLocalHost = ['localhost', '127.0.0.1', '::1'].includes(location.hostname);
  return isLocalHost ? `${location.protocol}//${location.hostname}:8787` : location.origin;
}
