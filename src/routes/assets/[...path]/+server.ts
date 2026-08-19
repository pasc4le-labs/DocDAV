import { error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/**
 * Serve arbitrary files from the WebDAV content share (images etc. referenced
 * by relative paths in rendered docs). Mirrors the loader's env defaults.
 * Read-only GET; content is already cached upstream by rawFetch semantics.
 */
function baseUrl(): string {
  const b = env.WEBDAV_URL || 'http://127.0.0.1:8090/';
  return b.endsWith('/') ? b : b + '/';
}

export async function GET({ params }) {
  const path = params.path as string;
  const url = new URL(encodeURI(path), baseUrl()).href;
  const res = await fetch(url, {
    headers: {
      Authorization:
        'Basic ' +
        Buffer.from(`${env.WEBDAV_USER || 'demo'}:${env.WEBDAV_PASS || 'secret'}`).toString(
          'base64',
        ),
    },
  });
  if (!res.ok) throw error(404, 'Not found');
  return new Response(await res.arrayBuffer(), {
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/octet-stream',
      'cache-control': 'public, max-age=300',
    },
  });
}
