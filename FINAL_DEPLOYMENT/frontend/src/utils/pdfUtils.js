// ── PDF pre-rendering helpers ────────────────────────────────────────────────
// Loads pdf.js from CDN (once) and resolves with the library object.
export function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve(window.pdfjsLib);
    };
    s.onerror = () => reject(new Error('pdf.js failed to load'));
    document.head.appendChild(s);
  });
}

// Renders all pages of a PDF dataUrl to JPEG data URLs.
// pageRotations: optional array of rotation degrees per page (0/90/180/270).
// Rotation is baked into the canvas so output images are already rotated.
export async function renderPdfPages(dataUrl, pageRotations = []) {
  const pdfjsLib = await loadPdfJs();
  const pdfDoc = await pdfjsLib.getDocument(dataUrl).promise;
  const n = pdfDoc.numPages;
  const pages = [];
  for (let pn = 1; pn <= n; pn++) {
    const rot = pageRotations[pn - 1] || 0;
    const page = await pdfDoc.getPage(pn);
    const vp = page.getViewport({ scale: 2.0, rotation: rot });
    const cv = document.createElement('canvas');
    cv.width = vp.width; cv.height = vp.height;
    await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
    pages.push({ pageNum: pn, dataUrl: cv.toDataURL('image/jpeg', 0.92) });
  }
  return pages;
}

// Expands sitePlans: each PDF entry becomes N image entries (one per page).
// The rotation stored in sp.rotation is baked into the canvas.
export async function expandPdfSitePlans(sitePlans) {
  const hasPdf = sitePlans.some(sp => sp.dataUrl && !sp.dataUrl.startsWith('data:image'));
  if (!hasPdf) return sitePlans;

  let pdfjsLib;
  try { pdfjsLib = await loadPdfJs(); }
  catch (_) { return sitePlans; }

  const result = [];
  for (const sp of sitePlans) {
    if (!sp.dataUrl || sp.dataUrl.startsWith('data:image')) {
      result.push(sp);
      continue;
    }
    try {
      const pdfDoc = await pdfjsLib.getDocument(sp.dataUrl).promise;
      const n = pdfDoc.numPages;
      const pageRotations = sp.pdfPageRotations || [];
      const fallbackRot = sp.rotation || 0;
      for (let pn = 1; pn <= n; pn++) {
        const rot = pageRotations[pn - 1] !== undefined ? pageRotations[pn - 1] : fallbackRot;
        const page = await pdfDoc.getPage(pn);
        const vp = page.getViewport({ scale: 2.0, rotation: rot });
        const cv = document.createElement('canvas');
        cv.width = vp.width; cv.height = vp.height;
        await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        result.push({
          ...sp,
          dataUrl: cv.toDataURL('image/jpeg', 0.92),
          rotation: 0,
          name: n > 1 ? `${sp.name} (Page ${pn}/${n})` : sp.name,
        });
      }
    } catch (_) {
      result.push({ ...sp, _renderError: true });
    }
  }
  return result;
}

// Expands legalDocs: each PDF entry becomes N image entries (one per page).
// Per-page rotations saved in doc.pdfPageRotations are baked into the canvas.
// Returns a new array safe to pass directly to buildPrintHTML.
export async function expandPdfLegalDocs(legalDocs) {
  const hasPdf = legalDocs.some(d => d.dataUrl && !d.dataUrl.startsWith('data:image'));
  if (!hasPdf) return legalDocs;

  let pdfjsLib;
  try { pdfjsLib = await loadPdfJs(); }
  catch (_) { return legalDocs; } // CDN unavailable — keep originals (will be skipped in HTML)

  const result = [];
  for (const doc of legalDocs) {
    if (!doc.dataUrl || doc.dataUrl.startsWith('data:image')) {
      result.push(doc);
      continue;
    }
    try {
      const pdfDoc = await pdfjsLib.getDocument(doc.dataUrl).promise;
      const n = pdfDoc.numPages;
      const pageRotations = doc.pdfPageRotations || [];
      for (let pn = 1; pn <= n; pn++) {
        const rot = pageRotations[pn - 1] || 0;
        const page = await pdfDoc.getPage(pn);
        const vp = page.getViewport({ scale: 2.0, rotation: rot });
        const cv = document.createElement('canvas');
        cv.width = vp.width; cv.height = vp.height;
        await page.render({ canvasContext: cv.getContext('2d'), viewport: vp }).promise;
        result.push({
          ...doc,
          dataUrl: cv.toDataURL('image/jpeg', 0.92),
          rotation: 0, // already baked in
          name: n > 1 ? `${doc.name} (Page ${pn}/${n})` : doc.name,
        });
      }
    } catch (_) {
      result.push({ ...doc, _renderError: true });
    }
  }
  return result;
}
