/**
 * Client-side image preparation.
 *
 * OCR.space's free tier rejects files over 1 MB, and phone photos of a paper
 * are routinely 3-8 MB. Everything here runs in the browser, before upload.
 */

/** ~950 KB, leaving room for multipart overhead under the 1 MB free-tier cap. */
export const OCR_MAX_BYTES = 950 * 1024;

export function bytesToSize(bytes) {
  if (!Number.isFinite(bytes)) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function loadImageElement(source) {
  return new Promise((resolve, reject) => {
    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    const img = new Image();
    img.onload = () => {
      if (typeof source !== 'string') URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      if (typeof source !== 'string') URL.revokeObjectURL(url);
      reject(new Error('That image could not be decoded. Try a PNG or JPEG.'));
    };
    img.src = url;
  });
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('The browser could not encode this image.'))),
      type,
      quality
    );
  });
}

/**
 * Mild grayscale + contrast stretch. Helps OCR on dim phone photos; can hurt
 * clean digital scans, so it is opt-in.
 */
function enhanceCanvas(canvas) {
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height);
  const px = data.data;

  let min = 255;
  let max = 0;
  for (let i = 0; i < px.length; i += 4) {
    const gray = (px[i] * 299 + px[i + 1] * 587 + px[i + 2] * 114) / 1000;
    px[i] = px[i + 1] = px[i + 2] = gray;
    if (gray < min) min = gray;
    if (gray > max) max = gray;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < px.length; i += 4) {
    const stretched = ((px[i] - min) / range) * 255;
    const boosted = Math.max(0, Math.min(255, (stretched - 128) * 1.25 + 128));
    px[i] = px[i + 1] = px[i + 2] = boosted;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

/**
 * Downscale and re-encode an image so it fits OCR.space's free-tier limit.
 *
 * @param {Blob|File} file
 * @param {{maxBytes?:number, maxDimension?:number, enhance?:boolean, quality?:number}} [opts]
 * @returns {Promise<{blob:Blob, previewUrl:string, width:number, height:number, originalBytes:number, bytes:number, scale:number, quality:number, enhanced:boolean}>}
 */
export async function prepareImageForOcr(file, opts = {}) {
  const {
    maxBytes = OCR_MAX_BYTES,
    maxDimension = 2600,
    enhance = false,
    quality: startQuality = 0.86,
  } = opts;

  const originalBytes = file.size ?? 0;
  const img = await loadImageElement(file);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;

  let dimension = Math.min(maxDimension, Math.max(srcW, srcH));
  let quality = startQuality;
  let result = null;
  let lastBlob = null;

  // Shrink in passes: first by quality, then by dimensions, until it fits.
  for (let pass = 0; pass < 9; pass++) {
    const scale = Math.min(1, dimension / Math.max(srcW, srcH));
    const w = Math.max(1, Math.round(srcW * scale));
    const h = Math.max(1, Math.round(srcH * scale));

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: enhance });
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, w, h);
    if (enhance) enhanceCanvas(canvas);

    const blob = await canvasToBlob(canvas, 'image/jpeg', quality);
    lastBlob = blob;
    if (blob.size <= maxBytes || pass === 8) {
      result = { blob, width: w, height: h, scale, quality };
      break;
    }
    if (quality > 0.5) quality = Math.max(0.5, quality - 0.14);
    else dimension = Math.max(700, Math.round(dimension * 0.82));
  }

  const { blob, width, height, scale, quality: q } = result ?? {
    blob: lastBlob,
    width: srcW,
    height: srcH,
    scale: 1,
    quality: startQuality,
  };

  return {
    blob,
    previewUrl: URL.createObjectURL(blob),
    width,
    height,
    originalBytes,
    bytes: blob.size,
    scale,
    quality: q,
    enhanced: enhance,
    fitsFreeTier: blob.size <= maxBytes,
  };
}

/** Data URL for a blob, for inline previews. */
export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsDataURL(blob);
  });
}

export async function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Could not read that file.'));
    reader.readAsText(file, 'utf-8');
  });
}

export function isPdfFile(file) {
  return file?.type === 'application/pdf' || /\.pdf$/i.test(file?.name ?? '');
}

export function isImageFile(file) {
  return /^image\//.test(file?.type ?? '') || /\.(png|jpe?g|webp|gif|bmp|tiff?)$/i.test(file?.name ?? '');
}
