import { getSitePassword as davSitePassword, getPasswordMap } from './dav';

/** Per-product access passwords, sourced from each product's `docs.yaml`
 * (`password:` key) and the site password from the root `site.yaml`. */

export const AUTH_COOKIE = 'drive_docs_auth';
/** Reserved auth-box key for the site-wide homepage password. */
export const AUTH_SITE = '*';

/** True when a product carries a `password:` in its manifest. */
export async function isGated(product: string): Promise<boolean> {
  return (await getPasswordMap()).has(product);
}

/** Per-product password, if set. */
export async function getSecret(product: string): Promise<string | undefined> {
  return (await getPasswordMap()).get(product);
}

/** Site-wide homepage password from the root `site.yaml`. */
export async function getSitePassword(): Promise<string | undefined> {
  return davSitePassword();
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
