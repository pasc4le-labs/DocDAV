import { env } from '$env/dynamic/private';

/** Navbar branding — customizable via env. */
export interface Brand {
  /** Brand text shown when no logo is set. */
  name: string;
  /** Optional logo <img> src/URL. When set, it replaces the brand text. */
  logo: string;
}

/**
 * Per-provider fixed link overrides for the "Ask <provider>" menu, customizable
 * via env. Format: `AI_OVERRIDES='{"gemini":"https://…"}'` — the key is the
 * provider slug (`ai-overrides.<slug>`), the value a fixed href. When set, the
 * menu item becomes a plain link to that URL instead of the deep-linked chat
 * (which is useful when a provider's `?q=`/`?prompt=` prefill is unreliable).
 */
export interface AiOverrides {
  [provider: string]: string;
}

export function getBrand(): Brand {
  return {
    name: env.DOCS_BRAND || 'drive-docs',
    logo: env.DOCS_LOGO || '',
  };
}

export function getAiOverrides(): AiOverrides {
  const raw = env.AI_OVERRIDES;
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: AiOverrides = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        if (typeof v === 'string' && v) out[k] = v;
      }
      return out;
    }
  } catch (err) {
    console.error('[config] invalid AI_OVERRIDES JSON; ignoring.', err);
  }
  return {};
}
