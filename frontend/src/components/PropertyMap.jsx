import React from "react";
import { resolvePlusCode } from "../utils/plusCode";

export default function PropertyMap({ propId, lat, lng, plusCode, onPin, onPlusCodeLocate, fixedZoom, label }) {
  const canvasRef = React.useRef(null);
  const [locating, setLocating] = React.useState(false);
  const [locateError, setLocateError] = React.useState("");
  const [latLngInput, setLatLngInput] = React.useState("");
  const [showLatLng, setShowLatLng] = React.useState(false);
  const [zoom, setZoom] = React.useState(fixedZoom || 15);
  const [center, setCenter] = React.useState({
    lat: parseFloat(lat) || 27.7172,
    lng: parseFloat(lng) || 85.3240
  });
  const [dragging, setDragging] = React.useState(false);
  const dragStart = React.useRef(null);
  const centerAtDrag = React.useRef(null);
  const tilesCache = React.useRef({});
  const rafRef = React.useRef(null);

  const W = 560, H = 360;

  // Tile math
  const latToTileY = (lat, z) => {
    const r = lat * Math.PI / 180;
    return Math.floor((1 - Math.log(Math.tan(r) + 1/Math.cos(r)) / Math.PI) / 2 * Math.pow(2, z));
  };
  const lngToTileX = (lng, z) => Math.floor((lng + 180) / 360 * Math.pow(2, z));
  const tile2lat = (y, z) => {
    const n = Math.PI - 2 * Math.PI * y / Math.pow(2, z);
    return 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
  };
  const tile2lng = (x, z) => x / Math.pow(2, z) * 360 - 180;

  const latLngToPixel = (lat, lng, cLat, cLng, z) => {
    const scale = Math.pow(2, z);
    const cX = (cLng + 180) / 360 * scale * 256;
    const cLatR = cLat * Math.PI / 180;
    const cY = (1 - Math.log(Math.tan(cLatR) + 1/Math.cos(cLatR)) / Math.PI) / 2 * scale * 256;
    const pX = (lng + 180) / 360 * scale * 256;
    const latR = lat * Math.PI / 180;
    const pY = (1 - Math.log(Math.tan(latR) + 1/Math.cos(latR)) / Math.PI) / 2 * scale * 256;
    return { x: W/2 + (pX - cX), y: H/2 + (pY - cY) };
  };

  const pixelToLatLng = (px, py, cLat, cLng, z) => {
    const scale = Math.pow(2, z);
    const cX = (cLng + 180) / 360 * scale * 256;
    const cLatR = cLat * Math.PI / 180;
    const cY = (1 - Math.log(Math.tan(cLatR) + 1/Math.cos(cLatR)) / Math.PI) / 2 * scale * 256;
    const worldX = cX + (px - W/2);
    const worldY = cY + (py - H/2);
    const lng = worldX / (scale * 256) * 360 - 180;
    const n = Math.PI - 2 * Math.PI * worldY / (scale * 256);
    const lat = 180 / Math.PI * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
    return { lat, lng };
  };

  const drawMap = React.useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, W, H);

    // Fill background
    ctx.fillStyle = "#e8e0d8";
    ctx.fillRect(0, 0, W, H);

    const z = zoom;
    const cLat = center.lat, cLng = center.lng;
    const scale = Math.pow(2, z);
    const cTileX = (cLng + 180) / 360 * scale;
    const cLatR = cLat * Math.PI / 180;
    const cTileY = (1 - Math.log(Math.tan(cLatR) + 1/Math.cos(cLatR)) / Math.PI) / 2 * scale;

    // How many tiles needed
    const tilesX = Math.ceil(W / 256) + 2;
    const tilesY = Math.ceil(H / 256) + 2;
    const startTX = Math.floor(cTileX - tilesX/2);
    const startTY = Math.floor(cTileY - tilesY/2);

    let pendingTiles = 0;

    for (let dx = 0; dx < tilesX; dx++) {
      for (let dy = 0; dy < tilesY; dy++) {
        const tx = startTX + dx;
        const ty = startTY + dy;
        const maxTile = Math.pow(2, z);
        if (tx < 0 || ty < 0 || tx >= maxTile || ty >= maxTile) continue;

        const px = (tx - cTileX) * 256 + W/2;
        const py = (ty - cTileY) * 256 + H/2;
        const key = `${z}/${tx}/${ty}`;

        if (tilesCache.current[key] && tilesCache.current[key].complete) {
          ctx.drawImage(tilesCache.current[key], Math.round(px), Math.round(py), 256, 256);
        } else if (!tilesCache.current[key]) {
          pendingTiles++;
          const img = new Image();
          img.crossOrigin = "anonymous";
          // Try tile.openstreetmap.org directly
          const sub = ["a","b","c"][Math.abs(tx+ty) % 3];
          img.src = `https://${sub}.tile.openstreetmap.org/${z}/${tx}/${ty}.png`;
          img.onload = () => {
            tilesCache.current[key] = img;
            if (rafRef.current) cancelAnimationFrame(rafRef.current);
            rafRef.current = requestAnimationFrame(drawMap);
          };
          img.onerror = () => {
            // fallback placeholder
            tilesCache.current[key] = { complete: false, failed: true };
          };
          tilesCache.current[key] = img;
        }
      }
    }

    // Draw pin if lat/lng set
    const pinLat = parseFloat(lat), pinLng = parseFloat(lng);
    if (!isNaN(pinLat) && !isNaN(pinLng)) {
      const { x, y } = latLngToPixel(pinLat, pinLng, cLat, cLng, z);
      if (x > -10 && x < W+10 && y > -10 && y < H+10) {
        // Shadow
        ctx.beginPath();
        ctx.ellipse(x, y+2, 7, 4, 0, 0, Math.PI*2);
        ctx.fillStyle = "rgba(0,0,0,0.25)";
        ctx.fill();
        // Pin body
        ctx.beginPath();
        ctx.arc(x, y-14, 10, 0, Math.PI*2);
        ctx.fillStyle = "#c0392b";
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2.5;
        ctx.stroke();
        // Pin tail
        ctx.beginPath();
        ctx.moveTo(x-7, y-8);
        ctx.lineTo(x, y);
        ctx.lineTo(x+7, y-8);
        ctx.fillStyle = "#c0392b";
        ctx.fill();
        // Inner dot
        ctx.beginPath();
        ctx.arc(x, y-14, 4, 0, Math.PI*2);
        ctx.fillStyle = "#fff";
        ctx.fill();
      }
    }

    // Attribution
    ctx.fillStyle = "rgba(255,255,255,0.75)";
    ctx.fillRect(W-180, H-16, 180, 16);
    ctx.fillStyle = "#555";
    ctx.font = "10px Arial";
    ctx.textAlign = "right";
    ctx.fillText("© OpenStreetMap contributors", W-4, H-4);

    // Zoom level badge
    ctx.fillStyle = "rgba(26,23,20,0.7)";
    ctx.beginPath();
    ctx.roundRect(8, 8, 46, 20, 4);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px Arial";
    ctx.textAlign = "left";
    ctx.fillText(`Z ${z}`, 14, 21);

  }, [center, zoom, lat, lng]);

  // Redraw when state changes
  React.useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(drawMap);
  }, [drawMap]);

  // Sync center when lat/lng props change
  React.useEffect(() => {
    const pLat = parseFloat(lat), pLng = parseFloat(lng);
    if (!isNaN(pLat) && !isNaN(pLng)) setCenter({ lat: pLat, lng: pLng });
  }, [lat, lng]);

  // Mouse / touch handlers
  const handleMouseDown = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    dragStart.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    centerAtDrag.current = { ...center };
    setDragging(true);
  };
  const handleMouseMove = (e) => {
    if (!dragging || !dragStart.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    const dx = mx - dragStart.current.x, dy = my - dragStart.current.y;
    const scale = Math.pow(2, zoom) * 256;
    const dLng = -dx / scale * 360;
    const cLatR = centerAtDrag.current.lat * Math.PI / 180;
    const dLat = dy / scale * 360 / Math.cos(cLatR);
    setCenter({ lat: centerAtDrag.current.lat + dLat, lng: centerAtDrag.current.lng + dLng });
  };
  const handleMouseUp = (e) => {
    if (dragging && dragStart.current) {
      const rect = canvasRef.current.getBoundingClientRect();
      const mx = e.clientX - rect.left, my = e.clientY - rect.top;
      const moved = Math.hypot(mx - dragStart.current.x, my - dragStart.current.y);
      if (moved < 5) {
        // Click to pin
        const { lat: pLat, lng: pLng } = pixelToLatLng(mx, my, center.lat, center.lng, zoom);
        onPin(pLat, pLng);
      }
    }
    setDragging(false);
    dragStart.current = null;
  };
  const handleWheel = (e) => {
    if (fixedZoom) return;
    e.preventDefault();
    setZoom(z => Math.max(10, Math.min(19, e.deltaY < 0 ? z+1 : z-1)));
  };

  // Keep zoom in sync with fixedZoom prop
  React.useEffect(() => {
    if (fixedZoom) setZoom(fixedZoom);
  }, [fixedZoom]);

  const handleLocate = async () => {
    if (!plusCode?.trim()) { setLocateError("Enter a Google Plus Code first."); return; }
    setLocateError(""); setLocating(true);
    try {
      const result = await resolvePlusCode(plusCode);
      const { latitudeCenter: rLat, longitudeCenter: rLng } = result;
      setCenter({ lat: rLat, lng: rLng });
      setZoom(fixedZoom || 17);
      onPlusCodeLocate(rLat, rLng);
    } catch(e) { setLocateError(e.message || "Failed."); }
    finally { setLocating(false); }
  };

  // Parse lat/lng from formats: "27.851785, 85.034714" or "27.851785 85.034714"
  const handleLatLng = () => {
    const raw = latLngInput.trim();
    if (!raw) { setLocateError("Paste a lat/lng coordinate first."); return; }
    // Match any format: 27.851785, 85.034714 or 27.851785 85.034714
    const m = raw.match(/(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)/);
    if (!m) { setLocateError('Invalid format. Use: 27.851785, 85.034714'); return; }
    const rLat = parseFloat(m[1]), rLng = parseFloat(m[2]);
    if (isNaN(rLat) || isNaN(rLng) || rLat < -90 || rLat > 90 || rLng < -180 || rLng > 180) {
      setLocateError("Coordinates out of range."); return;
    }
    setLocateError("");
    setCenter({ lat: rLat, lng: rLng });
    setZoom(fixedZoom || 17);
    onPlusCodeLocate(rLat, rLng);
    setShowLatLng(false);
    setLatLngInput("");
  };

  const hasCode = !!(plusCode && plusCode.trim().length > 0);

  return (
    <div style={{borderRadius:"10px",overflow:"hidden",border:"1.5px solid var(--border-dark)",boxShadow:"0 2px 10px rgba(0,0,0,0.10)"}}>
      {/* Locate bar — Plus Code + Lat/Lng tabs */}
      <div style={{borderBottom:"1px solid var(--border-dark)"}}>
        {/* Tab row */}
        <div style={{display:"flex",background:"var(--navy)",gap:0}}>
          {label && <span style={{fontSize:"11px",fontWeight:700,color:"rgba(255,255,255,0.5)",padding:"6px 12px",alignSelf:"center",whiteSpace:"nowrap"}}>{label}</span>}
          <button onClick={()=>{setShowLatLng(false);setLocateError("");}}
            style={{flex:1,padding:"7px 14px",fontSize:"11px",fontWeight:700,border:"none",cursor:"pointer",
              fontFamily:"'DM Sans',sans-serif",letterSpacing:"0.05em",whiteSpace:"nowrap",
              background:!showLatLng?"rgba(201,146,42,0.15)":"transparent",
              color:!showLatLng?"var(--gold-light)":"rgba(255,255,255,0.5)",
              borderBottom:!showLatLng?"2px solid var(--gold-light)":"2px solid transparent"}}>
            📍 Plus Code
          </button>
          <button onClick={()=>{setShowLatLng(true);setLocateError("");}}
            style={{flex:1,padding:"7px 14px",fontSize:"11px",fontWeight:700,border:"none",cursor:"pointer",
              fontFamily:"'DM Sans',sans-serif",letterSpacing:"0.05em",whiteSpace:"nowrap",
              background:showLatLng?"rgba(201,146,42,0.15)":"transparent",
              color:showLatLng?"var(--gold-light)":"rgba(255,255,255,0.5)",
              borderBottom:showLatLng?"2px solid var(--gold-light)":"2px solid transparent"}}>
            🌐 Lat / Long
          </button>
        </div>

        {/* Plus Code panel */}
        {!showLatLng && (
          <div style={{padding:"8px 12px",background:"var(--accent-bg)",display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap"}}>
            <span style={{fontSize:"12px",color:"var(--text-2)",flex:1,fontFamily:"monospace",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
              {hasCode ? plusCode : <span style={{color:"var(--text-3)",fontStyle:"italic"}}>e.g. "V22M+53Q Ratmate"</span>}
            </span>
            <button onClick={handleLocate} disabled={!hasCode||locating}
              style={{padding:"6px 16px",fontSize:"12px",fontWeight:700,
                cursor:hasCode&&!locating?"pointer":"not-allowed",
                background:hasCode?"var(--navy)":"var(--surface-3)",
                color:hasCode?"#fff":"var(--text-3)",
                border:"none",borderRadius:"6px",opacity:locating?0.6:1,whiteSpace:"nowrap",
                fontFamily:"'DM Sans',sans-serif"}}>
              {locating?"⏳…":"🔍 Locate"}
            </button>
          </div>
        )}

        {/* Lat/Lng panel */}
        {showLatLng && (
          <div style={{padding:"8px 12px",background:"var(--surface-2)",display:"flex",gap:"8px",alignItems:"center",flexWrap:"wrap"}}>
            <input
              value={latLngInput}
              onChange={e=>setLatLngInput(e.target.value)}
              onKeyDown={e=>e.key==="Enter"&&handleLatLng()}
              placeholder="27.851785, 85.034714"
              style={{flex:1,minWidth:"160px",padding:"6px 10px",fontSize:"13px",fontFamily:"monospace",
                border:"1.5px solid var(--border)",borderRadius:"6px",background:"var(--surface)",
                color:"var(--text)",outline:"none"}}
              onFocus={e=>e.target.style.borderColor="var(--gold-border)"}
              onBlur={e=>e.target.style.borderColor="var(--border)"}
            />
            <button onClick={handleLatLng}
              style={{padding:"6px 16px",fontSize:"12px",fontWeight:700,
                background:"var(--navy)",color:"#fff",border:"none",borderRadius:"6px",
                cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif"}}>
              📌 Go
            </button>
            <button onClick={()=>{
                if(!navigator.geolocation){setLocateError("GPS not available");return;}
                setLocating(true);setLocateError("");
                navigator.geolocation.getCurrentPosition(pos=>{
                  const rLat=pos.coords.latitude,rLng=pos.coords.longitude;
                  setLatLngInput(rLat.toFixed(6)+", "+rLng.toFixed(6));
                  setCenter({lat:rLat,lng:rLng});setZoom(fixedZoom||17);
                  onPlusCodeLocate(rLat,rLng);setLocating(false);
                },()=>{setLocateError("GPS unavailable");setLocating(false);});
              }}
              style={{padding:"6px 12px",fontSize:"12px",fontWeight:700,
                background:"var(--green-pale)",color:"var(--green)",
                border:"1.5px solid var(--green)",borderRadius:"6px",
                cursor:"pointer",whiteSpace:"nowrap",fontFamily:"'DM Sans',sans-serif"}}>
              {locating?"⏳":"📡 GPS"}
            </button>
          </div>
        )}

        {locateError && <div style={{padding:"5px 12px",background:"#fff0f0",color:"#c0392b",fontSize:"11px"}}>⚠ {locateError}</div>}
      </div>

      {/* Canvas map */}
      <div style={{position:"relative",lineHeight:0,background:"#e8e0d8"}}>
        <canvas
          ref={canvasRef}
          width={W} height={H}
          style={{display:"block",width:"100%",height:"auto",cursor:dragging?"grabbing":"crosshair"}}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
        />
        {/* Zoom buttons — hidden when fixedZoom is set */}
        {!fixedZoom && (
        <div style={{position:"absolute",top:"8px",right:"8px",display:"flex",flexDirection:"column",gap:"2px",zIndex:10}}>
          {["+","−"].map((s,i) => (
            <button key={s} onClick={()=>setZoom(z=>Math.max(10,Math.min(19,z+(i===0?1:-1))))}
              style={{width:"28px",height:"28px",fontSize:"16px",fontWeight:700,cursor:"pointer",
                background:"rgba(255,255,255,0.92)",border:"1px solid #ccc",borderRadius:"4px",
                display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>
              {s}
            </button>
          ))}
        </div>
        )}
        {/* Coordinate badge */}
        {lat && lng && (
          <div style={{position:"absolute",bottom:"8px",left:"8px",zIndex:10,
            background:"rgba(20,16,12,0.80)",color:"#fff",padding:"4px 10px",
            borderRadius:"6px",fontSize:"11px",fontFamily:"monospace",pointerEvents:"none"}}>
            {parseFloat(lat).toFixed(5)}, {parseFloat(lng).toFixed(5)}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{padding:"7px 12px",background:"var(--surface2)",borderTop:"1px solid var(--border-dark)",
        fontSize:"11px",color:"var(--text-3)",display:"flex",gap:"10px",alignItems:"center",flexWrap:"wrap"}}>
        <span style={{opacity:.8}}>🖱 Click to pin · Drag to pan · Scroll to zoom</span>
        {lat && lng &&
          <a href={`https://www.google.com/maps?q=${parseFloat(lat).toFixed(6)},${parseFloat(lng).toFixed(6)}`}
            target="_blank" rel="noopener noreferrer"
            style={{marginLeft:"auto",color:"var(--accent)",fontWeight:700,textDecoration:"none",
              fontSize:"11px",padding:"3px 10px",border:"1px solid var(--accent-light)",
              borderRadius:"5px",background:"var(--accent-bg)",whiteSpace:"nowrap"}}>
            🗺 Open in Google Maps ↗
          </a>
        }
      </div>
    </div>
  );
}
