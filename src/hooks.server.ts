import { redirect, type Cookies, type Handle } from '@sveltejs/kit';
import { getBrand } from '$lib/config';
import {
  AUTH_COOKIE,
  AUTH_SITE,
  isGated,
  getSecret,
  getSitePassword,
  isAuthed,
  buildAuthBox,
} from '$lib/server/auth';
import { gatePage } from '$lib/server/gate';

/**
 * Access control, before anything else.
 *
 *  - Static assets are always public (the gates are self-contained HTML).
 *  - The homepage `/` is gated when DOCS_SITE_PASSWORD is set.
 *  - `/<product>/…` is gated when the product is in DOC_PASSWORDS.
 *
 * Passwords are accepted as a query param (?key=… / ?p=…), an X-Doc-Key
 * header, or a cookie (set after a successful unlock). Wrong/missing means a
 * styled 401 gate is returned and no page code runs — nothing leaks.
 */
export const handle: Handle = async ({ event, resolve }) => {
  const { url, cookies, request } = event;
  const path = url.pathname;

  // Assets always public.
  if (path.startsWith('/_app')) {
    return resolve(event);
  }

  const cookie = cookies.get(AUTH_COOKIE);

  // Homepage gate.
  if (path === '/') {
    const siteSecret = getSitePassword();
    if (!siteSecret) {
      return resolve(event); // public
    }
    if (isAuthed(cookie, AUTH_SITE)) {
      return resolve(event);
    }
    if (accepts(request, url, siteSecret)) {
      return grant(cookies, cookie, AUTH_SITE, path);
    }
    return new Response(gatePage(AUTH_SITE, path, getBrand(), true), {
      status: 401,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  }

  // Product gate.
  const first = path.split('/').filter(Boolean)[0];
  if (!first || !isGated(first)) {
    return resolve(event);
  }
  if (isAuthed(cookie, first)) {
    return resolve(event);
  }
  const secret = getSecret(first);
  if (secret && accepts(request, url, secret)) {
    return grant(cookies, cookie, first, path);
  }
  return new Response(gatePage(first, path, getBrand()), {
    status: 401,
    headers: { 'content-type': 'text/html; charset=utf-8' },
  });
};

function accepts(
  request: Request,
  url: URL,
  secret: string
): string | undefined {
  const given =
    url.searchParams.get('key') ??
    url.searchParams.get('p') ??
    request.headers.get('x-doc-key');
  return given === secret ? given : undefined;
}

function grant(
  cookies: Cookies,
  cookie: string | undefined,
  key: string,
  path: string
): Response {
  cookies.set(AUTH_COOKIE, buildAuthBox(cookie, key), {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 30,
  });
  // Relative redirect keeps the browser on whatever host it reached.
  throw redirect(302, path);
}
