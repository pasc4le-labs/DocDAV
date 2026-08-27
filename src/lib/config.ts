import { env } from '$env/dynamic/private';

/** Navbar branding — customizable via env. */
export interface Brand {
  /** Brand text shown when no logo is set. */
  name: string;
  /** Optional logo <img> src/URL. When set, it replaces the brand text. */
  logo: string;
}

export function getBrand(): Brand {
  return {
    name: env.DOCS_BRAND || 'drive-docs',
    logo: env.DOCS_LOGO || '',
  };
}
