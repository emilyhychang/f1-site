// The cutout is already a complete WebP data URI in driver-image.js.
// Expose it globally without rewriting its header or bytes.
if (typeof LECLERC_CUTOUT === 'string' && LECLERC_CUTOUT.startsWith('data:image/')) {
  window.LECLERC_CUTOUT = LECLERC_CUTOUT;
}
