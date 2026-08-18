import { getBrand } from '$lib/config';

/** Root layout data: customizable navbar branding only (no product switcher). */
export function load() {
  return { brand: getBrand() };
}
