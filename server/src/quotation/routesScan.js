// POST /scan: a picture of the terms (N.B.) becomes text.
// tesseract.js runs here on the server with the English data from @tesseract.js-data/eng, so it works offline. One worker is kept for later scans.
import { createRequire } from 'node:module';
import sharp from 'sharp';
import { guard } from '../admin.js';
import { fail, wrap } from '../util.js';
import { MANAGE } from './constants.js';
import { termsFromText } from './terms.js';

const require = createRequire(import.meta.url);
let ocrWorker = null;

/** Reads the text of a PNG with the shared OCR worker. */
async function ocr(png) {
  if (!ocrWorker) {
    const { createWorker } = await import('tesseract.js');
    const eng = require('@tesseract.js-data/eng');
    ocrWorker = createWorker('eng', 1, { langPath: eng.langPath, gzip: eng.gzip, cacheMethod: 'none' });
  }
  const w = await ocrWorker;
  return (await w.recognize(png)).data.text;
}

/** Adds POST /scan to the router. */
export function scanRoute(router) {
  router.post('/scan', guard(MANAGE), wrap(async (req, res) => {
    const m = String(req.body?.image || '').match(/^data:image\/(png|jpe?g|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
    if (!m) throw fail(400, 'Choose a PNG, JPG, WebP or GIF picture');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 6 * 1024 * 1024) throw fail(413, 'The picture is larger than 6 MB');
    let png;
    try { png = await sharp(buf).rotate().resize({ width: 2200, withoutEnlargement: true }).grayscale().normalise().sharpen().png().toBuffer(); } catch { throw fail(400, 'That file is not a readable picture'); }
    let raw;
    try { raw = await ocr(png); } catch (e) { ocrWorker = null; throw fail(500, 'The text could not be read from this picture: ' + (e.message || e)); }
    const lines = termsFromText(raw);
    if (!lines.length) throw fail(422, 'No readable text was found in the picture. Try a sharper, straighter photo.');
    res.json({ text: lines.join('\n'), lines: lines.length });
  }));
}
