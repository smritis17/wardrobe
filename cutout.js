// Turns a phone photo into a cutout: the background is removed on the phone itself, nothing is uploaded.
// The cutout model (about 55 MB) downloads the first time a photo is added; sw.js keeps it after that.
const LIB = 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
const WORK = 1024; // the model works at this size, so bigger photos only cost time
// Longest side of what gets stored. Safari can't write WebP and falls back to PNG, which is about
// ten times heavier, so cutouts are kept a little smaller there.
const WEBP = document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp');
const KEEP = WEBP ? 640 : 512;
let lib;

async function draw(blob, max) {
  const img = new Image();
  img.src = URL.createObjectURL(blob);
  try { await img.decode(); } finally { URL.revokeObjectURL(img.src); }
  const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.round(img.naturalWidth * k);
  c.height = Math.round(img.naturalHeight * k);
  c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, c.width, c.height);
  return c;
}
const toBlob = (c, type, q) => new Promise(res => c.toBlob(res, type, q));

// Crop to the piece itself and read its average colour.
function trim(c) {
  const { width: w, height: h } = c;
  const px = c.getContext('2d').getImageData(0, 0, w, h).data;
  let x0 = w, y0 = h, x1 = -1, y1 = -1, r = 0, g = 0, b = 0, n = 0;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, a = px[i + 3];
    if (a < 24) continue;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    if (a > 200) { r += px[i]; g += px[i + 1]; b += px[i + 2]; n++; }
  }
  if (x1 < 0 || n < w * h * 0.01) throw new Error('nothing found in the photo');
  const cw = x1 - x0 + 1, ch = y1 - y0 + 1, k = Math.min(1, KEEP / Math.max(cw, ch));
  const out = document.createElement('canvas');
  out.width = Math.round(cw * k); out.height = Math.round(ch * k);
  out.getContext('2d').drawImage(c, x0, y0, cw, ch, 0, 0, out.width, out.height);
  const hex = v => Math.round(v / n).toString(16).padStart(2, '0');
  return { canvas: out, color: '#' + hex(r) + hex(g) + hex(b) };
}

export async function cutout(file, onStatus) {
  const small = await toBlob(await draw(file, WORK), 'image/jpeg', 0.9);
  lib ??= await import(LIB);
  const png = await lib.removeBackground(small, {
    model: 'isnet_quint8',
    progress: (key, done, total) => onStatus(key.startsWith('fetch') && total
      ? `Getting the cutout tool (one time) ${Math.round(done / total * 100)}%` : 'Cutting out…'),
  });
  const { canvas, color } = trim(await draw(png, WORK));
  return { blob: await toBlob(canvas, 'image/webp', 0.85), color };
}

// Fallback when the cutout can't run: keep the photo as it is.
export async function plain(file) {
  return toBlob(await draw(file, KEEP), 'image/jpeg', 0.85);
}
