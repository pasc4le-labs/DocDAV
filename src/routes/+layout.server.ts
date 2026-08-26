import { getAiOverrides, getBrand } from '$lib/config';

/** Root layout data: customizable navbar branding + AI link overrides. */
export function load() {
  return { brand: getBrand(), aiOverrides: getAiOverrides() };
}
