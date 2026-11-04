/** App mount path, e.g. `/headoffice`. Empty string means site root. */
export const BASE_PATH = String(import.meta.env.BASE_URL || '/')
  .replace(/\/$/, '')
  .replace(/\/index\.html$/, '');

/** Prefix an absolute app path with the base (e.g. `/vote/BOHO` → `/headoffice/vote/BOHO`). */
export function withBase(path: string): string {
  if (!path.startsWith('/')) return path;
  if (!BASE_PATH) return path;
  if (path === BASE_PATH || path.startsWith(`${BASE_PATH}/`)) return path;
  return `${BASE_PATH}${path}`;
}

/** API / EventSource paths. */
export function apiUrl(path: string): string {
  return withBase(path.startsWith('/') ? path : `/${path}`);
}

/** Absolute public URL (QR codes, copy links). */
export function appUrl(path: string): string {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}${withBase(path)}`;
}

/** Image/media src: leave absolute http(s)/data URLs alone; prefix relative paths. */
export function mediaUrl(url: string): string {
  if (!url || /^https?:\/\//i.test(url) || url.startsWith('data:') || url.startsWith('blob:')) {
    return url;
  }
  return withBase(url.startsWith('/') ? url : `/${url}`);
}

/** Strip base path from pathname for client-side routing. */
export function stripBase(pathname: string): string {
  if (!BASE_PATH) return pathname || '/';
  if (pathname === BASE_PATH || pathname === `${BASE_PATH}/`) return '/';
  if (pathname.startsWith(`${BASE_PATH}/`)) {
    return pathname.slice(BASE_PATH.length) || '/';
  }
  return pathname || '/';
}
