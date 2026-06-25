// ─── Image compression utility ────────────────────────────────────────────────
// Compresses any image (canvas, blob, or dataUrl) to JPEG at target max dimensions.
// maxW/maxH: max output pixels. quality: 0-1 JPEG quality.
export function compressCanvas(canvas, maxW = 900, maxH = 600, quality = 0.72) {
  let { width: w, height: h } = canvas;
  const ratio = Math.min(maxW / w, maxH / h, 1); // never upscale
  if (ratio < 1) {
    const c2 = document.createElement("canvas");
    c2.width  = Math.round(w * ratio);
    c2.height = Math.round(h * ratio);
    c2.getContext("2d").drawImage(canvas, 0, 0, c2.width, c2.height);
    return c2.toDataURL("image/jpeg", quality);
  }
  return canvas.toDataURL("image/jpeg", quality);
}

// Compress an uploaded File/Blob or existing dataUrl string.
// Returns a Promise<dataUrl string>.
export function compressImageFile(source, maxW = 1200, maxH = 900, quality = 0.72) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      const ratio = Math.min(maxW / w, maxH / h, 1);
      const c = document.createElement("canvas");
      c.width  = Math.round(w * ratio);
      c.height = Math.round(h * ratio);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => resolve(typeof source === "string" ? source : "");
    if (typeof source === "string") {
      img.src = source;
    } else {
      // File/Blob
      const reader = new FileReader();
      reader.onload = e => { img.src = e.target.result; };
      reader.readAsDataURL(source);
    }
  });
}
