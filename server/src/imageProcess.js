// Uploaded pictures: cap the size (longest edge 1600 px, never enlarged), straighten by EXIF, strip metadata, and store as WebP
// when that is smaller than the original. GIF, animated images and SVG are never touched. Any failure returns the original bytes.
import sharp from 'sharp';

sharp.cache(false);
const EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/jpg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg' };

/** @returns {Promise<{buffer:Buffer, ext:string, mime:string, width:number|null, height:number|null, converted:boolean}>} */
export async function processUpload(buffer, mime, { maxEdge = 1600 } = {}) {
  const m = String(mime || '').toLowerCase();
  const ext = EXT[m] || 'jpg';
  const same = (width = null, height = null) => ({ buffer, ext, mime: m, width, height, converted: false });
  try {
    if (m === 'image/gif' || m === 'image/svg+xml' || !EXT[m]) return same();
    const meta = await sharp(buffer, { failOn: 'none' }).metadata();
    if (!meta.width || !meta.height) return same();
    if ((meta.pages || 1) > 1) return same(meta.width, meta.height); // animated
    const tilted = (meta.orientation || 1) > 1;
    const swap = meta.orientation >= 5;
    const w0 = swap ? meta.height : meta.width, h0 = swap ? meta.width : meta.height;
    const make = () => {
      let img = sharp(buffer, { failOn: 'none' }).rotate(); // applies EXIF orientation, drops metadata by default
      if (Math.max(w0, h0) > maxEdge) img = img.resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true });
      return img;
    };
    const webp = await make().webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
    if (m !== 'image/webp' && webp.data.length < buffer.length) {
      return { buffer: webp.data, ext: 'webp', mime: 'image/webp', width: webp.info.width, height: webp.info.height, converted: true };
    }
    // WebP not smaller: keep the original encoding, resized / straightened only when that helps
    const resized = Math.max(w0, h0) > maxEdge;
    if (m === 'image/webp') {
      if ((resized || tilted) && webp.data.length < buffer.length) return { buffer: webp.data, ext: 'webp', mime: m, width: webp.info.width, height: webp.info.height, converted: false };
      return same(w0, h0);
    }
    if (resized || tilted) {
      const o = await (m === 'image/png' ? make().png({ compressionLevel: 9 }) : make().jpeg({ quality: 82, mozjpeg: true })).toBuffer({ resolveWithObject: true });
      if (resized || o.data.length < buffer.length) return { buffer: o.data, ext, mime: m, width: o.info.width, height: o.info.height, converted: false };
    }
    return same(w0, h0);
  } catch {
    return same();
  }
}
