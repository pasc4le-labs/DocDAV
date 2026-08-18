import { env } from '$env/dynamic/private';

/** Per-product access passwords. */
export const AUTH_COOKIE = 'drive_docs_auth';
/** Reserved auth-box key for the site-wide homepage password. */
export const AUTH_SITE = '*';

export function getPasswords(): Record<string, string> {
  try {
    return JSON.parse(env.DOC_PASSWORDS || '{}') as Record<string, string>;
  } catch {
    return {};
  }
}

export function getSitePassword(): string | undefined {
  return env.DOCS_SITE_PASSWORD || undefined;
}

export function isGated(product: string): boolean {
  return product in getPasswords();
}

export function getSecret(product: string): string | undefined {
  return getPasswords()[product];
}

export function readAuthBox(raw: string | undefined): Record<string, boolean> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function isAuthed(raw: string | undefined, key: string): boolean {
  return readAuthBox(raw)[key] === true;
}

export function buildAuthBox(raw: string | undefined, key: string): string {
  const box = readAuthBox(raw);
  box[key] = true;
  return JSON.stringify(box);
}
