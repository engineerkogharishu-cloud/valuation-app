import React from "react";

export default function PhotoEditor({ photo, onSave, onClose }) {
  const canvasRef = React.useRef(null);
  const [tool, setTool]           = React.useState("rect");
  const [color, setColor]         = React.useState("#e74c3c");
  const [lineWidth, setLineWidth] = React.useState(2);
  const [fontSize, setFontSize]   = React.useState(16);
  const [arrowSize, setArrowSize] = React.useState("medium"); // "small"|"medium"|"large"
  const [annotations, setAnnotations] = React.useState([]);
  const [drawing, setDrawing]     = React.useState(false);
  const [current, setCurrent]     = React.useState(null);
  const [textInput, setTextInput] = React.useState({ visible: false, x: 0, y: 0, value: "" });
  const imgRef   = React.useRef(null);
  const CANVAS_W = 800;

  const ARROW_HEAD = { small: 12, medium: 20, large: 32 };

  React.useEffect(() => {
    const img = new Image();
    img.onload = () => { imgRef.current = img; redraw(img, annotations); };
    img.src = photo.dataUrl;
  }, []); // eslint-disable-line

  const redraw = (img, anns) => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const scale = CANVAS_W / img.naturalWidth;
    canvas.width  = CANVAS_W;
    canvas.height = Math.round(img.naturalHeight * scale);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    anns.forEach(a => drawAnnotation(ctx, a));
  };

  // Draw filled arrowhead at (x2,y2) pointing from (x1,y1)
  const drawArrowHead = (ctx, x1, y1, x2, y2, headLen) => {
    const angle = Math.atan2(y2 - y1, x2 - x1);
    const spread = Math.PI / 6; // 30°
    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - spread), y2 - headLen * Math.sin(angle - spread));
    ctx.lineTo(x2 - headLen * Math.cos(angle + spread), y2 - headLen * Math.sin(angle + spread));
    ctx.closePath();
    ctx.fill();
  };

  const drawAnnotation = (ctx, a) => {
    ctx.save();
    ctx.strokeStyle = a.color;
    ctx.fillStyle   = a.color;
    ctx.lineWidth   = a.lineWidth || 2;
    ctx.lineCap     = "round";
    ctx.lineJoin    = "round";

    if (a.type === "rect") {
      ctx.strokeRect(a.x, a.y, a.w, a.h);

    } else if (a.type === "line") {
      ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(a.x2, a.y2); ctx.stroke();

    } else if (a.type === "arrow") {
      const headLen = ARROW_HEAD[a.arrowSize || "medium"];
      // Shorten line so it doesn't overlap the arrowhead
      const angle = Math.atan2(a.y2 - a.y1, a.x2 - a.x1);
      const ex = a.x2 - (headLen * 0.6) * Math.cos(angle);
      const ey = a.y2 - (headLen * 0.6) * Math.sin(angle);
      ctx.beginPath(); ctx.moveTo(a.x1, a.y1); ctx.lineTo(ex, ey); ctx.stroke();
      drawArrowHead(ctx, a.x1, a.y1, a.x2, a.y2, headLen);

    } else if (a.type === "text") {
      ctx.font = `bold ${a.fontSize || 16}px 'DM Sans', sans-serif`;
      const metrics = ctx.measureText(a.text);
      const pad = 4;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.beginPath();
      ctx.roundRect(a.x - pad, a.y - (a.fontSize||16) - pad, metrics.width + pad*2, (a.fontSize||16) + pad*2, 4);
      ctx.fill();
      ctx.fillStyle = a.color;
      ctx.fillText(a.text, a.x, a.y);

    } else if (a.type === "pen" && a.points?.length > 1) {
      ctx.beginPath();
      ctx.moveTo(a.points[0].x, a.points[0].y);
      a.points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
    }
    ctx.restore();
  };

  const getPos = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width  / rect.width;
    const scaleY = canvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY };
  };

  const onMouseDown = (e) => {
    if (tool === "text") {
      const pos = getPos(e);
      setTextInput({ visible: true, x: pos.x, y: pos.y, value: "" });
      return;
    }
    setDrawing(true);
    const pos = getPos(e);
    if (tool === "pen") {
      setCurrent({ type: "pen", color, lineWidth, points: [pos] });
    } else if (tool === "rect") {
      setCurrent({ type: "rect", color, lineWidth, x: pos.x, y: pos.y, w: 0, h: 0 });
    } else if (tool === "line") {
      setCurrent({ type: "line", color, lineWidth, x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
    } else if (tool === "arrow") {
      setCurrent({ type: "arrow", color, lineWidth, arrowSize, x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y });
    }
  };

  const onMouseMove = (e) => {
    if (!drawing || !current) return;
    const pos = getPos(e);
    let updated;
    if (tool === "pen") {
      updated = { ...current, points: [...current.points, pos] };
    } else if (tool === "rect") {
      updated = { ...current, w: pos.x - current.x, h: pos.y - current.y };
    } else if (tool === "line" || tool === "arrow") {
      updated = { ...current, x2: pos.x, y2: pos.y };
    }
    setCurrent(updated);
    redraw(imgRef.current, [...annotations, updated]);
  };

  const onMouseUp = () => {
    if (!drawing || !current) return;
    setDrawing(false);
    const newAnns = [...annotations, current];
    setAnnotations(newAnns);
    setCurrent(null);
    redraw(imgRef.current, newAnns);
  };

  const addText = () => {
    if (!textInput.value.trim()) { setTextInput(t => ({ ...t, visible: false })); return; }
    const a = { type: "text", color, fontSize, x: textInput.x, y: textInput.y, text: textInput.value.trim() };
    const newAnns = [...annotations, a];
    setAnnotations(newAnns);
    setTextInput({ visible: false, x: 0, y: 0, value: "" });
    redraw(imgRef.current, newAnns);
  };

  const undo = () => {
    const newAnns = annotations.slice(0, -1);
    setAnnotations(newAnns);
    redraw(imgRef.current, newAnns);
  };

  const clearAll = () => { setAnnotations([]); redraw(imgRef.current, []); };

  const save = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    onSave(canvas.toDataURL("image/jpeg", 0.92));
  };

  const TOOLS = [
    { id: "rect",  icon: "⬜", label: "Box" },
    { id: "arrow", icon: "➤",  label: "Arrow" },
    { id: "line",  icon: "╱",  label: "Line" },
    { id: "pen",   icon: "✏️", label: "Pen" },
    { id: "text",  icon: "T",  label: "Text" },
  ];

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.85)", zIndex:99999,
      display:"flex", flexDirection:"column", fontFamily:"'DM Sans',sans-serif" }}>

      {/* Toolbar */}
      <div style={{ background:"#1a1a2e", padding:"10px 16px", display:"flex",
        alignItems:"center", gap:"10px", flexWrap:"wrap", borderBottom:"1px solid #333" }}>
        <span style={{ color:"#fff", fontWeight:700, fontSize:"14px", marginRight:4 }}>✏️ Photo Editor</span>

        {/* Tool buttons */}
        <div style={{ display:"flex", gap:"4px" }}>
          {TOOLS.map(t => (
            <button key={t.id} onClick={() => setTool(t.id)} title={t.label}
              style={{ padding:"6px 12px", borderRadius:"7px", border:"none", cursor:"pointer",
                fontWeight:700, fontSize:"13px",
                background: tool === t.id ? "#e8b84b" : "rgba(255,255,255,0.12)",
                color: tool === t.id ? "#1a1a2e" : "#fff" }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        <div style={{ width:1, height:28, background:"rgba(255,255,255,0.15)" }}/>

        {/* Color */}
        <label style={{ display:"flex", alignItems:"center", gap:"6px", color:"rgba(255,255,255,0.7)", fontSize:"12px" }}>
          Color
          <input type="color" value={color} onChange={e=>setColor(e.target.value)}
            style={{ width:32, height:28, padding:2, border:"none", borderRadius:5, cursor:"pointer", background:"none" }}/>
        </label>

        {/* Line width — for all tools except text */}
        {tool !== "text" && (
          <label style={{ display:"flex", alignItems:"center", gap:"6px", color:"rgba(255,255,255,0.7)", fontSize:"12px" }}>
            Width
            <select value={lineWidth} onChange={e=>setLineWidth(Number(e.target.value))}
              style={{ padding:"4px 8px", borderRadius:6, border:"none", background:"rgba(255,255,255,0.15)",
                color:"#fff", fontSize:"12px", width:"auto" }}>
              {[1,2,3,4,6,8].map(w=><option key={w} value={w}>{w}px</option>)}
            </select>
          </label>
        )}

        {/* Arrow size — only for arrow tool */}
        {tool === "arrow" && (
          <label style={{ display:"flex", alignItems:"center", gap:"6px", color:"rgba(255,255,255,0.7)", fontSize:"12px" }}>
            Head
            <div style={{ display:"flex", gap:"3px" }}>
              {[
                { id:"small",  label:"S", px:12 },
                { id:"medium", label:"M", px:20 },
                { id:"large",  label:"L", px:32 },
              ].map(s => (
                <button key={s.id} onClick={()=>setArrowSize(s.id)}
                  title={`${s.id} arrowhead (${s.px}px)`}
                  style={{ padding:"4px 10px", borderRadius:6, border:"none", cursor:"pointer",
                    fontWeight:700, fontSize:"12px",
                    background: arrowSize===s.id ? "#e8b84b" : "rgba(255,255,255,0.12)",
                    color: arrowSize===s.id ? "#1a1a2e" : "#fff" }}>
                  {/* Visual arrow preview */}
                  <svg width={s.px * 1.4} height={14} viewBox={`0 0 ${s.px*1.4} 14`} style={{verticalAlign:"middle",marginRight:3}}>
                    <line x1="0" y1="7" x2={s.px*1.4 - s.px*0.5} y2="7" stroke="currentColor" strokeWidth="2"/>
                    <polygon points={`${s.px*1.4},7 ${s.px*1.4 - s.px*0.8},${7 - s.px*0.35} ${s.px*1.4 - s.px*0.8},${7 + s.px*0.35}`} fill="currentColor"/>
                  </svg>
                  {s.label}
                </button>
              ))}
            </div>
          </label>
        )}

        {/* Font size — only for text tool */}
        {tool === "text" && (
          <label style={{ display:"flex", alignItems:"center", gap:"6px", color:"rgba(255,255,255,0.7)", fontSize:"12px" }}>
            Size
            <select value={fontSize} onChange={e=>setFontSize(Number(e.target.value))}
              style={{ padding:"4px 8px", borderRadius:6, border:"none", background:"rgba(255,255,255,0.15)",
                color:"#fff", fontSize:"12px", width:"auto" }}>
              {[12,14,16,18,20,24,28,32].map(s=><option key={s} value={s}>{s}pt</option>)}
            </select>
          </label>
        )}

        <div style={{ width:1, height:28, background:"rgba(255,255,255,0.15)" }}/>
        <button onClick={undo} disabled={annotations.length===0}
          style={{ padding:"6px 14px", borderRadius:7, border:"none", cursor:"pointer",
            background:"rgba(255,255,255,0.12)", color:"#fff", fontWeight:600, fontSize:"13px",
            opacity: annotations.length===0 ? 0.4 : 1 }}>
          ↩ Undo
        </button>
        <button onClick={clearAll} disabled={annotations.length===0}
          style={{ padding:"6px 14px", borderRadius:7, border:"none", cursor:"pointer",
            background:"rgba(231,76,60,0.25)", color:"#e74c3c", fontWeight:600, fontSize:"13px",
            opacity: annotations.length===0 ? 0.4 : 1 }}>
          🗑 Clear
        </button>

        <div style={{ marginLeft:"auto", display:"flex", gap:"8px" }}>
          <button onClick={onClose}
            style={{ padding:"7px 18px", borderRadius:8, border:"1px solid rgba(255,255,255,0.2)",
              background:"transparent", color:"#fff", fontWeight:600, fontSize:"13px", cursor:"pointer" }}>
            Cancel
          </button>
          <button onClick={save}
            style={{ padding:"7px 20px", borderRadius:8, border:"none",
              background:"linear-gradient(135deg,#27ae60,#1a7a3f)", color:"#fff",
              fontWeight:700, fontSize:"13px", cursor:"pointer" }}>
            💾 Save Photo
          </button>
        </div>
      </div>

      {/* Canvas area */}
      <div style={{ flex:1, overflow:"auto", display:"flex", alignItems:"center",
        justifyContent:"center", padding:"16px", position:"relative" }}>
        <div style={{ position:"relative", display:"inline-block" }}>
          <canvas
            ref={canvasRef}
            style={{ display:"block", maxWidth:"100%", cursor: tool==="text" ? "text" : "crosshair",
              borderRadius:6, boxShadow:"0 8px 32px rgba(0,0,0,0.5)" }}
            onMouseDown={onMouseDown}
            onMouseMove={onMouseMove}
            onMouseUp={onMouseUp}
            onMouseLeave={onMouseUp}
            onTouchStart={e=>{e.preventDefault();onMouseDown(e);}}
            onTouchMove={e=>{e.preventDefault();onMouseMove(e);}}
            onTouchEnd={onMouseUp}
          />

          {/* Floating text input */}
          {textInput.visible && (() => {
            const canvas = canvasRef.current;
            const rect = canvas?.getBoundingClientRect();
            const scaleX = rect ? canvas.width / rect.width : 1;
            const scaleY = rect ? canvas.height / rect.height : 1;
            const left = textInput.x / scaleX;
            const top  = textInput.y / scaleY;
            return (
              <div style={{ position:"absolute", left, top, zIndex:10 }}>
                <input
                  autoFocus
                  value={textInput.value}
                  onChange={e=>setTextInput(t=>({...t,value:e.target.value}))}
                  onKeyDown={e=>{ if(e.key==="Enter") addText(); if(e.key==="Escape") setTextInput(t=>({...t,visible:false})); }}
                  placeholder="Type text, press Enter"
                  style={{ padding:"4px 8px", fontSize:`${fontSize}px`, fontWeight:"bold",
                    color, background:"rgba(0,0,0,0.6)", border:`2px solid ${color}`,
                    borderRadius:5, outline:"none", minWidth:"120px",
                    fontFamily:"'DM Sans',sans-serif" }}
                />
                <button onClick={addText}
                  style={{ marginLeft:4, padding:"4px 10px", background:color, color:"#fff",
                    border:"none", borderRadius:5, cursor:"pointer", fontWeight:700, fontSize:"12px" }}>
                  Add
                </button>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Status bar */}
      <div style={{ background:"#111", padding:"6px 16px", fontSize:"11px",
        color:"rgba(255,255,255,0.4)", display:"flex", gap:"16px" }}>
        <span>Tool: <strong style={{color:"#e8b84b"}}>{TOOLS.find(t=>t.id===tool)?.label}</strong></span>
        {tool === "arrow" && <span>Arrow: <strong style={{color:"#e8b84b"}}>{arrowSize}</strong></span>}
        <span>{annotations.length} annotation{annotations.length!==1?"s":""}</span>
        <span>Click on photo to annotate · Undo with ↩ · Press Enter to confirm text</span>
      </div>
    </div>
  );
}
