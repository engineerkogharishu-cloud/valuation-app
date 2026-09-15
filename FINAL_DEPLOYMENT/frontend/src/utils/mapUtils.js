import { compressCanvas } from './imageUtils';

// ─── Capture map snapshots as base64 data URIs ────────────────────────────────
// Renders OSM tiles onto an off-screen canvas and returns base64 PNG data URIs.
// This works completely offline (tiles already cached) and in any iframe/print context.
export async function captureMapSnapshot(lat, lng, zoom, W, H) {
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext("2d");

    // background
    ctx.fillStyle = "#e8e0d8";
    ctx.fillRect(0, 0, W, H);

    const scale = Math.pow(2, zoom);
    const latR = lat * Math.PI / 180;
    const cTileX = (lng + 180) / 360 * scale;
    const cTileY = (1 - Math.log(Math.tan(latR) + 1/Math.cos(latR)) / Math.PI) / 2 * scale;

    const tilesX = Math.ceil(W / 256) + 2;
    const tilesY = Math.ceil(H / 256) + 2;
    const startTX = Math.floor(cTileX - tilesX / 2);
    const startTY = Math.floor(cTileY - tilesY / 2);

    const maxTile = scale;
    const tileList = [];
    for (let dx = 0; dx < tilesX; dx++) {
      for (let dy = 0; dy < tilesY; dy++) {
        const tx = startTX + dx, ty = startTY + dy;
        if (tx < 0 || ty < 0 || tx >= maxTile || ty >= maxTile) continue;
        const px = Math.round((tx - cTileX) * 256 + W / 2);
        const py = Math.round((ty - cTileY) * 256 + H / 2);
        tileList.push({ tx, ty, px, py });
      }
    }

    let loaded = 0;
    const total = tileList.length;
    if (total === 0) { resolve(compressCanvas(canvas, 900, 560, 0.78)); return; }

    const done = () => {
      // Draw red pin marker
      const latRad = lat * Math.PI / 180;
      const worldX = (lng + 180) / 360 * scale * 256;
      const worldY = (1 - Math.log(Math.tan(latRad) + 1/Math.cos(latRad)) / Math.PI) / 2 * scale * 256;
      const pinX = W/2 + (worldX - cTileX * 256);
      const pinY = H/2 + (worldY - cTileY * 256);
      // shadow
      ctx.beginPath(); ctx.ellipse(pinX, pinY+2, 7, 4, 0, 0, Math.PI*2);
      ctx.fillStyle = "rgba(0,0,0,0.25)"; ctx.fill();
      // body
      ctx.beginPath(); ctx.arc(pinX, pinY-14, 10, 0, Math.PI*2);
      ctx.fillStyle = "#c0392b"; ctx.fill();
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 2.5; ctx.stroke();
      // tail
      ctx.beginPath(); ctx.moveTo(pinX-7, pinY-8); ctx.lineTo(pinX, pinY); ctx.lineTo(pinX+7, pinY-8);
      ctx.fillStyle = "#c0392b"; ctx.fill();
      // dot
      ctx.beginPath(); ctx.arc(pinX, pinY-14, 4, 0, Math.PI*2);
      ctx.fillStyle = "#fff"; ctx.fill();
      // attribution
      ctx.fillStyle = "rgba(255,255,255,0.75)"; ctx.fillRect(W-182, H-16, 182, 16);
      ctx.fillStyle = "#555"; ctx.font = "10px Arial"; ctx.textAlign = "right";
      ctx.fillText("© OpenStreetMap contributors", W-4, H-4);
      // zoom badge
      ctx.fillStyle = "rgba(26,23,20,0.7)";
      ctx.beginPath(); ctx.roundRect(8, 8, 46, 20, 4); ctx.fill();
      ctx.fillStyle = "#fff"; ctx.font = "bold 11px Arial"; ctx.textAlign = "left";
      ctx.fillText("Z " + zoom, 14, 21);

      resolve(compressCanvas(canvas, 900, 560, 0.78));
    };

    tileList.forEach(({ tx, ty, px, py }) => {
      const sub = ["a","b","c"][Math.abs(tx+ty) % 3];
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        ctx.drawImage(img, px, py, 256, 256);
        loaded++;
        if (loaded === total) done();
      };
      img.onerror = () => {
        loaded++;
        if (loaded === total) done();
      };
      img.src = `https://${sub}.tile.openstreetmap.org/${zoom}/${tx}/${ty}.png`;
    });
  });
}

export async function captureAllMapSnapshots(properties) {
  const snapshots = {};
  for (const p of properties) {
    const lat = parseFloat(p.lat), lng = parseFloat(p.lng);
    if (isNaN(lat) || isNaN(lng)) continue;
    try {
      const [z15, z18] = await Promise.all([
        captureMapSnapshot(lat, lng, 15, 640, 380),
        captureMapSnapshot(lat, lng, 18, 640, 380),
      ]);
      snapshots[p.id] = { z15, z18 };
    } catch(e) {
      console.warn("Map capture failed for", p.id, e);
    }
  }
  return snapshots;
}
