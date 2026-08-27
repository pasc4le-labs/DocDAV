import { getBrand } from '$lib/config';

/** Root layout data: customizable navbar branding. */
export function load() {
  return { brand: getBrand() };
}
