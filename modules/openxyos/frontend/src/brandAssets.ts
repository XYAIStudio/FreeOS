/** Bundled brand stills so the hero does not depend on a bare /assets path. */

export const XYAI_MASCOT_SRC = new URL(
  "../public/assets/xyai-mascot.webp",
  import.meta.url,
).href;

export const XYOS_WATER_LOGO_SRC = new URL(
  "../public/assets/xyos-water-logo.png",
  import.meta.url,
).href;
