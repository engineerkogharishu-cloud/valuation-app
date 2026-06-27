import { propAreaSqm, sqmToRadp, sqmToAana, sqmToBkd, sqmToDhur, AANA_TO_SQM, DHUR_TO_SQM } from "../utils/areaConversions";
import { toWords, toWordsNepali, toDevanagariNum } from "../utils/numberWords";
import { buildPreliminaryHTML } from "./buildPreliminaryHTML";
import { buildTheme } from "../utils/reportTheme";
import { esc } from "../utils/htmlEscape";
import { bsToAd, parseBsStr } from "../utils/bsDate";

function transferDuration(dateStr) {
  if (!dateStr) return "";
  const parsed = parseBsStr(dateStr);
  if (!parsed) return "";
  const from = bsToAd(parsed.y, parsed.m, parsed.d);
  if (isNaN(from)) return "";
  const to = new Date();
  let yy = to.getFullYear() - from.getFullYear();
  let mm = to.getMonth() - from.getMonth();
  let dd = to.getDate() - from.getDate();
  if (dd < 0) { mm--; dd += new Date(to.getFullYear(), to.getMonth(), 0).getDate(); }
  if (mm < 0) { yy--; mm += 12; }
  return `${yy}Y ${mm}M ${dd}D`;
}

// Local helper: display string for area
function areaDisplay(prop) {
  if (prop.areaUnit === "sqm") return `${parseFloat(prop.areaSqm)||0} sq.m`;
  if (prop.areaUnit === "bkd") {
    const { b,k,d } = prop.areaBkd||{};
    return `${b||0}-${k||0}-${d||0} (B-K-D)`;
  }
  const { r,a,p,d } = prop.areaRadp||{};
  return `${r||0}-${a||0}-${p||0}-${d||0} (R-A-P-D)`;
}
const _uf  = (p) => p.areaUnit === "bkd" ? DHUR_TO_SQM : AANA_TO_SQM;
const _ul  = (p) => p.areaUnit === "bkd" ? "Dhur" : "Aana";
const _ud  = (p, sqm) => p.areaUnit === "bkd" ? sqmToDhur(sqm).toFixed(3) : sqmToAana(sqm).toFixed(4);
const _uda = (p, sqm) => p.areaUnit === "bkd" ? sqmToDhur(sqm) : sqmToAana(sqm);
const _nativeStr = (p, sqm) => {
  if (p.areaUnit === "bkd") { const x=sqmToBkd(sqm); return `${x.b}-${x.k}-${parseFloat(x.d).toFixed(3)}`; }
  const x=sqmToRadp(sqm); return `${x.r}-${x.a}-${x.p}-${x.d}`;
};

const fullName = (person) => [person?.salutation, person?.name].filter(Boolean).join(" ");

function calcValFee(fmv) {
  if (!fmv || fmv <= 0) return 0;
  if (fmv <= 2_500_000)     return 7_500;
  if (fmv <= 5_000_000)     return Math.round(7_500   + (fmv - 2_500_000)   * 0.0020);
  if (fmv <= 10_000_000)    return Math.round(12_500  + (fmv - 5_000_000)   * 0.0015);
  if (fmv <= 50_000_000)    return Math.round(20_000  + (fmv - 10_000_000)  * 0.0010);
  if (fmv <= 100_000_000)   return Math.round(60_000  + (fmv - 50_000_000)  * 0.0008);
  if (fmv <= 200_000_000)   return Math.round(100_000 + (fmv - 100_000_000) * 0.0005);
  if (fmv <= 500_000_000)   return Math.round(150_000 + (fmv - 200_000_000) * 0.0003);
  if (fmv <= 1_000_000_000) return Math.round(240_000 + (fmv - 500_000_000) * 0.0002);
  return Math.round(340_000 + (fmv - 1_000_000_000) * 0.0001);
}

export function buildPrintHTML(s, suggestedFilename, autoPrint = false, mapSnapshots = {}) {
  // Route to preliminary layout when report type is preliminary
  if ((s.reportType||"preliminary") === "preliminary") {
    return buildPreliminaryHTML(s, suggestedFilename, autoPrint, mapSnapshots);
  }

  // Route to standalone bill layout
  if (s.reportType === "bill") {
    return buildBillOnlyHTML(s, suggestedFilename, autoPrint);
  }

  // Otherwise fall through to the original (final) layout below
  const T = buildTheme(s.reportColorTheme);
  const rType = (s.reportType||"preliminary").toUpperCase();

  const clientLine = (s.clients||[]).map(cl=>{
    const parts=[];
    if(cl.showPerson&&cl.person?.name) parts.push(fullName(cl.person));
    if(cl.showCompany&&cl.company?.name) parts.push(cl.company.name);
    return parts.join(" / ");
  }).filter(Boolean).join(", ")||"—";

  const mortProps = (s.properties||[]).filter(p=>(s.mortgagedIds||[]).includes(p.id));
  const allBkdMort = mortProps.length > 0 && mortProps.every(p => p.areaUnit === "bkd");
  const anyBkdMort = mortProps.some(p => p.areaUnit === "bkd");
  const nativeHdr = allBkdMort ? "B-K-D" : anyBkdMort ? "R-A-P-D / B-K-D" : "R-A-P-D";
  const unitHdr = allBkdMort ? "Dhur" : anyBkdMort ? "Aana / Dhur" : "Aana";

  const personRows = (person) => {
    const married = person.salutation === "Mrs.";
    return `
    <tr><td>Name</td><td>${esc(fullName(person))}</td><td>Citizenship No.</td><td>${esc(person.citizenshipNo)}</td></tr>
    <tr><td>Issued Date (BS)</td><td>${esc(person.issuedDate)}</td><td>Issued By</td><td>${esc(person.issuedBy)}</td></tr>
    <tr><td>Father's Name</td><td>${esc(person.fatherName)}</td><td>Grandfather's Name</td><td>${esc(person.grandfatherName)}</td></tr>
    ${married ? `<tr><td>Husband's Name</td><td>${esc(person.husbandName)}</td><td>Father-in-law's Name</td><td>${esc(person.fatherInLawName)}</td></tr>` : ''}
    <tr><td>Contact</td><td>${esc(person.contact)}</td><td>Address</td><td>${esc(person.address)}</td></tr>`;
  };

  // ── 3.1 Clients / Buyers
  const clientLabel = s.isBuySell ? "Buyer" : "Client";
  const ownerLabel  = s.isBuySell ? "Seller" : "Owner";
  const clientsHTML = (s.clients||[]).map((cl,i)=>{
    let html = `<p class="sub-head">${clientLabel} ${i+1}</p>`;
    if(cl.showPerson) html += `<table class="info-table">${personRows(cl.person||{})}</table>`;
    if(cl.showCompany){
      html += `<table class="info-table" style="margin-top:3pt">
        <tr><td>Company Name</td><td>${esc(cl.company?.name)}</td><td>PAN/VAT</td><td>${esc(cl.company?.panVat)}</td></tr>
        <tr><td>Reg. No.</td><td>${esc(cl.company?.regNo)}</td><td>Reg. Date (BS)</td><td>${esc(cl.company?.regDate)}</td></tr>
        <tr><td>Registered On</td><td colspan="3">${esc(cl.company?.regOn)}</td></tr>
        <tr><td>Contact</td><td>${esc(cl.company?.contact)}</td><td>Address</td><td>${esc(cl.company?.address)}</td></tr>
      </table>`;
      (cl.company?.directors||[]).forEach((d,di)=>{
        html+=`<p style="margin:3pt 0 1pt;font-style:italic">Director ${di+1}${d.name?" — "+esc(d.name):""}</p><table class="info-table">${personRows(d)}</table>`;
      });
    }
    return html;
  }).join(`<div style="border-top:1pt dashed #bbb;margin:4pt 0"></div>`);

  // ── 3.2 Owners / Sellers
  const ownersHTML = (s.owners||[]).map((ow,i)=>{
    let html = `<p class="sub-head">${ownerLabel} ${i+1}</p>`;
    if(ow.showPerson) html += `<table class="info-table">${personRows(ow.person||{})}</table>`;
    if(ow.showCompany){
      html += `<table class="info-table" style="margin-top:3pt">
        <tr><td>Company Name</td><td>${esc(ow.company?.name)}</td><td>PAN/VAT</td><td>${esc(ow.company?.panVat)}</td></tr>
        <tr><td>Reg. No.</td><td>${esc(ow.company?.regNo)}</td><td>Reg. Date (BS)</td><td>${esc(ow.company?.regDate)}</td></tr>
        <tr><td>Registered On</td><td colspan="3">${esc(ow.company?.regOn)}</td></tr>
        <tr><td>Contact</td><td>${esc(ow.company?.contact)}</td><td>Address</td><td>${esc(ow.company?.address)}</td></tr>
      </table>`;
      (ow.company?.directors||[]).forEach((d,di)=>{
        html+=`<p style="margin:3pt 0 1pt;font-style:italic">Director ${di+1}${d.name?" — "+esc(d.name):""}</p><table class="info-table">${personRows(d)}</table>`;
      });
    }
    return html;
  }).join(`<div style="border-top:1pt dashed #bbb;margin:4pt 0"></div>`);

  // ── 3.3 Property rows
  const propDetailRows = (s.properties||[]).map(p=>{
    const sqm = propAreaSqm(p);
    const {r,a,p:pp,d} = sqmToRadp(sqm);
    const dur = transferDuration(p.transferDate);
    return `<tr>
      <td>${esc(p.plotNo)}</td><td>${esc(p.traceSheetNo)}</td><td>${esc(p.landType)}</td><td>${esc(p.category)}</td>
      <td>${p.areaUnit==="radp"?`${p.areaRadp?.r||0}-${p.areaRadp?.a||0}-${p.areaRadp?.p||0}-${p.areaRadp?.d||0}`:`${p.areaSqm||0} sq.m`}</td>
      <td>${sqm.toFixed(3)}</td><td>${_nativeStr(p,sqm)}</td>
      <td>${esc(p.ownerName)}</td><td>${esc(p.addressLalpurja)}</td><td>${esc(p.presentAddress)}</td>
      <td>${esc(p.modeOfTransfer)}</td>
      <td>${esc(p.transferDate)}${dur ? `<br/><span style="font-size:8.5pt;color:#555">(${dur})</span>` : ""}</td>
    </tr>`;
  }).join("");

  // ── Maps — group properties sharing the same location (plus code or coords)
  const _mapGroups = [];
  const _mapGroupKeys = new Map();
  (s.properties||[]).forEach(p => {
    const lat = parseFloat(p.lat), lng = parseFloat(p.lng);
    const hasCoords = !isNaN(lat) && !isNaN(lng);
    const snap = mapSnapshots[p.id]||{};
    const hasMap = hasCoords || snap.z15 || snap.z18;
    let key;
    if (p.googlePlusCode && p.googlePlusCode.trim()) key = 'plus:' + p.googlePlusCode.trim();
    else if (hasCoords) key = 'coords:' + lat.toFixed(4) + ',' + lng.toFixed(4);
    else key = 'nomap';
    if (_mapGroupKeys.has(key)) { _mapGroupKeys.get(key).props.push(p); }
    else { const g={key,props:[p]}; _mapGroupKeys.set(key,g); _mapGroups.push(g); }
  });
  const _plotBadges = (props) => props.map(p=>`<span style="display:inline-block;background:${T.primary};color:#fff;font-size:9pt;font-weight:bold;padding:2pt 7pt;border-radius:3pt;margin:1pt 3pt 1pt 0">` + (p.plotNo||'—') + `</span>`).join('');
  const mapsHTML = _mapGroups.map(({key, props}) => {
    const rep = props[0];
    const lat = parseFloat(rep.lat), lng = parseFloat(rep.lng);
    const hasCoords = !isNaN(lat) && !isNaN(lng);
    const googleMapsUrl = hasCoords ? `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}` : "";
    const snap = mapSnapshots[rep.id]||{};
    const multiPlot = props.length > 1;
    const plotLabel = props.map(p=>p.plotNo||'—').join(', ');
    if (key === 'nomap') {
      return (
        '<div style="margin-bottom:8pt;page-break-inside:avoid">' +
        '<p style="font-weight:bold;font-size:10pt;margin-bottom:4pt">Plot No. ' + plotLabel + '</p>' +
        '<div style="display:flex;align-items:center;justify-content:center;min-height:80pt;border:1pt solid #ddd;border-radius:4pt;background:#fafafa;text-align:center;padding:16pt">' +
          '<div>' +
            '<div style="margin-bottom:6pt">' + _plotBadges(props) + '</div>' +
            (multiPlot
              ? '<div style="font-size:10pt;color:#555;margin-bottom:4pt">Plot Nos: <strong>' + plotLabel + '</strong></div>'
              : '') +
            '<div style="font-size:9.5pt;color:#aaa;margin-top:4pt;font-style:italic">Location map not attached</div>' +
          '</div>' +
        '</div>' +
        '</div>'
      );
    }
    const plusCode = rep.googlePlusCode || '';
    const location = rep.location || '';
    return (
      '<div style="margin-bottom:8pt;page-break-inside:avoid">' +
      '<p style="font-weight:bold;font-size:10pt;margin-bottom:3pt">' +
        'Plot No. ' + plotLabel +
        (location ? ' &nbsp;|&nbsp; ' + location : '') +
        (plusCode ? ' &nbsp;|&nbsp; Plus Code: ' + plusCode : '') +
      '</p>' +
      (multiPlot ? '<p style="font-size:9pt;color:#555;margin-bottom:3pt">Plots at this location: ' + _plotBadges(props) + '</p>' : '') +
      '<table class="info-table" style="margin-bottom:3pt"><tr>' +
        '<td>Latitude</td><td>' + (hasCoords ? lat.toFixed(6) : '—') + '</td>' +
        '<td>Longitude</td><td>' + (hasCoords ? lng.toFixed(6) : '—') + '</td>' +
        (hasCoords ? '<td><a href="' + googleMapsUrl + '" style="color:#2d6a4f;font-weight:bold">View in Google Maps</a></td>' : '<td>—</td>') +
      '</tr></table>' +
      '<div style="display:flex;flex-direction:column;gap:5pt">' +
        '<div style="page-break-inside:avoid">' +
          `<p style="font-size:10pt;font-weight:bold;margin-bottom:4pt;padding:3pt 8pt;background:${T.info};border-left:3pt solid ${T.medium}">Overview Map (Area Context)</p>` +
          (snap.z15
            ? '<img src="' + snap.z15 + '" style="width:100%;height:auto;border:1pt solid #bbb;border-radius:4pt;display:block" alt="Overview map"/>'
            : '<div style="padding:20pt;border:1pt solid #ddd;text-align:center;font-style:italic;color:#888;font-size:10pt">Map not available — <a href="' + googleMapsUrl + '" style="color:#2d6a4f">View in Google Maps</a></div>') +
          '<p style="font-size:8.5pt;color:#888;text-align:right;margin-top:2pt;font-style:italic">© OpenStreetMap contributors</p>' +
        '</div>' +
        '<div style="page-break-inside:avoid">' +
          `<p style="font-size:10pt;font-weight:bold;margin-bottom:4pt;padding:3pt 8pt;background:${T.info};border-left:3pt solid ${T.medium}">Detail Map (Property Location)</p>` +
          (snap.z18
            ? '<img src="' + snap.z18 + '" style="width:100%;height:auto;border:1pt solid #bbb;border-radius:4pt;display:block" alt="Detail map"/>'
            : '<div style="padding:20pt;border:1pt solid #ddd;text-align:center;font-style:italic;color:#888;font-size:10pt">Map not available — <a href="' + googleMapsUrl + '" style="color:#2d6a4f">View in Google Maps</a></div>') +
          '<p style="font-size:8.5pt;color:#888;text-align:right;margin-top:2pt;font-style:italic">© OpenStreetMap contributors</p>' +
        '</div>' +
      '</div>' +
      '</div>'
    );
  }).join('<div style="border-top:1pt dashed #ccc;margin:5pt 0"></div>')||`<p style="font-style:italic;color:#888">No property data.</p>`;

  // ── Mortgage + area tables
  const mortRows = mortProps.map(p=>{
    const lSqm=propAreaSqm(p);
    const measured=parseFloat(s.areaMeasured?.[p.id])||lSqm;
    const deductArea=parseFloat(s.deductions?.[p.id]?.area)||0;
    const considered=Math.max(0,Math.min(lSqm,measured)-deductArea);
    const splits = (s.plotRateSplits?.[p.id]||[]);
    const hasSplits = splits.length > 0;
    const r2=s.rates?.[p.id]||{};
    const commRate=parseFloat(r2.commercialRate)||0;
    const govRate=parseFloat(r2.govRate)||0;
    const commW=parseFloat(r2.commercialWeight)||70;
    const govW=parseFloat(r2.govWeight)||30;
    const wr=(commRate*commW/100)+(govRate*govW/100);
    const fmv=considered*wr/_uf(p);
    const radp=sqmToRadp(considered);
    return {p,lSqm,measured,deductArea,considered,wr,fmv,radp,commRate,govRate,commW,govW,splits,hasSplits};
  });

  const consideredRows = mortRows.map(({p,lSqm,measured,deductArea,considered,radp})=>{
    const lRadp=sqmToRadp(lSqm);
    return `<tr><td>${esc(p.plotNo)}</td><td>${lSqm.toFixed(3)}</td><td>${_nativeStr(p,lSqm)}</td><td>${measured.toFixed(3)}</td><td>${deductArea.toFixed(3)}</td>
    <td><strong>${considered.toFixed(3)}</strong></td><td><strong>${_nativeStr(p,considered)}</strong></td><td><strong>${_ud(p,considered)}</strong></td></tr>`;
  }).join("");
  const totalConsSqm = mortRows.reduce((s,r)=>s+r.considered,0);
  const totalConsRadp = sqmToRadp(totalConsSqm);
  const totalConsUnitStr = allBkdMort ? `${sqmToDhur(totalConsSqm).toFixed(3)} Dhur` : anyBkdMort ? `${sqmToAana(totalConsSqm).toFixed(4)} Aana` : `${sqmToAana(totalConsSqm).toFixed(4)} Aana`;
  const consideredTotalRow = mortRows.length?`<tr class="total-row"><td colspan="5"><strong>TOTAL CONSIDERED AREA</strong></td><td><strong>${totalConsSqm.toFixed(3)}</strong></td><td><strong>—</strong></td><td><strong>${totalConsUnitStr}</strong></td></tr>`:"";
  const deductRows = mortRows.map(({p})=>`
    <tr><td>${esc(p.plotNo)}</td><td>${esc(s.deductions?.[p.id]?.dim)}</td><td>${s.deductions?.[p.id]?.area||"0"}</td><td>${esc(s.deductions?.[p.id]?.reason)}</td></tr>`).join("");

  const roadAccessHTML=(s.properties||[]).map(p=>{
    const rows=(s.roadAccess?.[p.id]||[]);
    if(!rows.length) return `<tr><td>${esc(p.plotNo)}</td><td colspan="5" style="font-style:italic;color:#999">No access rows entered</td></tr>`;
    return rows.map(r=>`<tr><td>${esc(p.plotNo)}</td><td>${esc(r.roadType)}</td><td>${esc(r.frontage)}</td><td>${esc(r.widthField)}</td><td>${esc(r.widthTrace)}</td><td>${esc(r.remarks)}</td></tr>`).join("");
  }).join("");

  const boundaryRows = [
    ...mortRows.map(({p})=>{
      const ac=s.access?.[p.id]||{};
      return `<tr><td>${esc(p.plotNo)}</td><td>${esc(ac.east)}</td><td>${esc(ac.west)}</td><td>${esc(ac.north)}</td><td>${esc(ac.south)}</td><td>${esc(ac.remarks)}</td></tr>`;
    }),
    ...(s.extraBoundaryRows||[]).map(row=>`<tr><td>${esc(row.plotNo)}</td><td>${esc(row.east)}</td><td>${esc(row.west)}</td><td>${esc(row.north)}</td><td>${esc(row.south)}</td><td>${esc(row.remarks)}</td></tr>`),
  ].join("");

  // ── Land valuation
  const _distressMult2 = Math.min(100, Math.max(0, parseFloat(s.distressPct)||80)) / 100;
  let totalLandComm=0, totalLandFMV2=0;
  let totalLandGov=0;
  let landRateRows="", landValueRows="";
  mortRows.forEach(({p,considered,commRate,govRate,commW,govW,wr,fmv,radp,splits,hasSplits})=>{
    if(hasSplits){
      let plotComm=0,plotFmv=0;
      const spGovRate=parseFloat(splits[0]?.govRate)||0;
      splits.forEach(sp=>{
        const spArea=parseFloat(sp.areaSqm)||0;
        const spCRate=parseFloat(sp.commercialRate)||0;
        const spCW=sp.commercialWeight!==undefined?parseFloat(sp.commercialWeight):70;
        const spGW=sp.govWeight!==undefined?parseFloat(sp.govWeight):30;
        const spFmvRate=(spCRate*spCW/100)+((parseFloat(sp.govRate)||0)*spGW/100);
        const spCVal=spArea*spCRate/_uf(p);
        const spFVal=spArea*spFmvRate/_uf(p);
        plotComm+=spCVal; plotFmv+=spFVal;
        const spZoneGovRate=parseFloat(sp.govRate)||0;
        const spGovVal=spZoneGovRate*_uda(p,spArea);
        landRateRows+=`<tr><td style="padding-left:16pt;font-style:italic;color:#555">${esc(p.plotNo)} (${esc(sp.label,"Zone")})</td>
          <td>${spArea.toFixed(3)}</td><td>${_ud(p,spArea)}</td>
          <td style="color:#1565c0">${spZoneGovRate?spZoneGovRate.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2}):"—"}</td>
          <td>${spCRate.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          <td>${spFmvRate.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>`;
        landValueRows+=`<tr><td style="padding-left:16pt;font-style:italic;color:#555">${esc(p.plotNo)} (${esc(sp.label,"Zone")})</td>
          <td>${_ud(p,spArea)}</td>
          <td style="color:#1565c0">${spZoneGovRate?`NPR ${spGovVal.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}`:"—"}</td>
          <td>NPR ${spCVal.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          <td>NPR ${spFVal.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          <td>NPR ${(Math.floor(spFVal*_distressMult2/100)*100).toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>`;
      });
      const gVal=spGovRate*_uda(p,considered); const gR=Math.floor(gVal/100)*100;
      const cR=Math.floor(plotComm/100)*100, fR=Math.floor(plotFmv/100)*100;
      const dR=Math.floor(fR*_distressMult2/100)*100;
      totalLandComm+=cR; totalLandFMV2+=fR; totalLandGov+=gR;
      landRateRows+=`<tr style="background:#f0ece6;font-weight:bold"><td>${esc(p.plotNo)} — Sub-total</td><td>${considered.toFixed(3)}</td><td>${_ud(p,considered)}</td>
          <td style="color:#555;font-style:italic">—</td>
          <td colspan="2" style="text-align:center;font-style:italic;color:#888">Multiple rates</td></tr>`;
      landValueRows+=`<tr style="background:#f0ece6;font-weight:bold"><td>${esc(p.plotNo)} — Sub-total</td><td>${_ud(p,considered)}</td>
          <td style="color:#1565c0">NPR ${gVal.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          <td>NPR ${plotComm.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          <td>NPR ${plotFmv.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
          <td>NPR ${(Math.floor(plotFmv*_distressMult2/100)*100).toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>
        <tr style="background:#e8f5e9"><td colspan="2" style="font-size:9.5pt;color:#555;padding-left:8pt"><em>Rounded Down (nearest 100)</em></td>
          <td><strong style="color:#1565c0">NPR ${gR.toLocaleString("en-NP")}</strong></td>
          <td><strong style="color:#2e7d32">NPR ${cR.toLocaleString("en-NP")}</strong></td>
          <td><strong style="color:#2e7d32">NPR ${fR.toLocaleString("en-NP")}</strong></td>
          <td><strong style="color:#2e7d32">NPR ${dR.toLocaleString("en-NP")}</strong></td></tr>`;
      return;
    }
    const cVal=considered*commRate/_uf(p);
    const gVal=govRate*_uda(p,considered);
    const cR=Math.floor(cVal/100)*100, fR=Math.floor(fmv/100)*100, gR=Math.floor(gVal/100)*100;
    const dR=Math.floor(fR*_distressMult2/100)*100;
    totalLandComm+=cR; totalLandFMV2+=fR; totalLandGov+=gR;
    landRateRows+=`<tr><td>${esc(p.plotNo)}</td><td>${considered.toFixed(3)}</td><td>${_ud(p,considered)}</td>
      <td style="color:#1565c0">${govRate.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td>${commRate.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td>${wr.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>`;
    landValueRows+=`<tr><td>${esc(p.plotNo)}</td><td>${_ud(p,considered)}</td>
      <td style="color:#1565c0">NPR ${gVal.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td>NPR ${cVal.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td>NPR ${fmv.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
      <td>NPR ${(Math.floor(fmv*_distressMult2/100)*100).toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>
    <tr style="background:#e8f5e9"><td colspan="2" style="font-size:9.5pt;color:#555;padding-left:8pt"><em>Rounded Down (nearest 100)</em></td>
      <td><strong style="color:#1565c0">NPR ${gR.toLocaleString("en-NP")}</strong></td>
      <td><strong style="color:#2e7d32">NPR ${cR.toLocaleString("en-NP")}</strong></td>
      <td><strong style="color:#2e7d32">NPR ${fR.toLocaleString("en-NP")}</strong></td>
      <td><strong style="color:#2e7d32">NPR ${dR.toLocaleString("en-NP")}</strong></td></tr>`;
  });

  // ── Buildings detail + valuation
  const bv = s.buildingVals||{};
  let totalBuildingVal=0;
  const buildingsDetailHTML = (s.buildings||[]).map((b,i)=>{
    const totalActual=(b.areaTable||[]).reduce((sum,a)=>sum+(parseFloat(a.areaActual)||0),0);
    const totalApproved=(b.areaTable||[]).reduce((sum,a)=>sum+(parseFloat(a.areaApproved)||0),0);
    const totalCert=(b.areaTable||[]).reduce((sum,a)=>sum+(parseFloat(a.areaCertificate)||0),0);
    const areaRows=(b.areaTable||[]).map(a=>`<tr><td>${esc(a.description)}</td><td>${parseFloat(a.areaActual)||0}</td><td>${parseFloat(a.areaApproved)||0}</td><td>${parseFloat(a.areaCertificate)||0}</td></tr>`).join("");
    const v=bv[b.id]||{}, floorRates=v.floorRates||{};
    const floorCalcs=(b.areaTable||[]).map(row=>({description:row.description||"—",area:parseFloat(row.areaActual)||0,rate:parseFloat(floorRates[row.id])||0,cost:(parseFloat(row.areaActual)||0)*(parseFloat(floorRates[row.id])||0)}));
    const baseCost=floorCalcs.reduce((s,f)=>s+f.cost,0);
    const totalArea=floorCalcs.reduce((s,f)=>s+f.area,0);
    const sanCost=baseCost*(parseFloat(v.sanitaryPct)||0)/100;
    const elecCost=baseCost*(parseFloat(v.electricalPct)||0)/100;
    const finCost=baseCost*(parseFloat(v.finishingPct)||0)/100;
    const totalWithFix=baseCost+sanCost+elecCost+finCost;
    const age=parseFloat(b.ageOfBuilding)||0, depRate=parseFloat(v.depreciationRate)||2.25;
    const totalDepPct=Math.min(100,age*depRate), totalDep=totalWithFix*totalDepPct/100;
    const actual=Math.max(0,totalWithFix-totalDep), rounded=Math.floor(actual/100)*100;
    totalBuildingVal+=rounded;
    const floorRows=floorCalcs.map(f=>`<tr><td>${esc(f.description)}</td><td>${f.area.toFixed(2)}</td><td>${f.rate.toLocaleString("en-NP")}</td><td>${f.cost.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>`).join("");
    return ("" + `    <p class="sub-head">Building ${i+1}${b.plotNo?` — Plot No. ${esc(b.plotNo)}`:""}</p>
    <table class="info-table">
      <tr><td>Owner</td><td>${esc(b.ownerName)}</td><td>Plot No.</td><td>${esc(b.plotNo)}</td></tr>
      <tr><td>Face Direction</td><td>${esc(b.faceDirection)}</td><td>No. of Floors</td><td>${esc(b.numFloors)}</td></tr>
      <tr><td>Permitted Floors</td><td>${esc(b.floorPermission)}</td><td>Year of Const.</td><td>${esc(b.yearOfConstruction)}</td></tr>
      <tr><td>Completion Date (BS)</td><td>${esc(b.completionDate)}</td><td>Age (Years)</td><td>${esc(b.ageOfBuilding)}</td></tr>
      <tr><td>Expected Life (Years)</td><td>${esc(b.expectedLife)}</td><td>Structure Type</td><td>${esc(b.structureType)}</td></tr>
      <tr><td>Foundation Type</td><td colspan="3">${esc(b.foundationType)}</td></tr>
    </table>
    <p style="font-weight:bold;font-size:9.5pt;margin:3pt 0 1pt">Building Area Details (sq.ft):</p>
    <table>
      <thead><tr><th>Description</th><th>Actual Construction</th><th>Approved Map</th><th>Completion Cert.</th></tr></thead>
      <tbody>${areaRows||`<tr><td colspan="4" style="text-align:center;font-style:italic">No areas entered</td></tr>`}
        <tr class="total-row"><td><strong>TOTAL</strong></td><td><strong>${totalActual.toFixed(2)}</strong></td><td><strong>${totalApproved.toFixed(2)}</strong></td><td><strong>${totalCert.toFixed(2)}</strong></td></tr>
      </tbody>
    </table>
    <p style="font-weight:bold;font-size:9.5pt;margin:3pt 0 1pt">Building Valuation:</p>
    <table>
      <thead><tr><th>Floor</th><th>Area (sq.ft)</th><th>Rate (NPR/sq.ft)</th><th>Floor Cost (NPR)</th></tr></thead>
      <tbody>${floorRows}
        <tr class="total-row"><td colspan="3"><strong>Total Base Construction Cost</strong></td><td><strong>${baseCost.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></td></tr>
      </tbody>
    </table>
    <table style="margin-top:2pt">
      <thead><tr><th>Description</th><th>Calculation</th><th>Amount (NPR)</th></tr></thead>
      <tbody>
        <tr><td>Base Construction Cost</td><td>${totalArea.toFixed(2)} sq.ft</td><td>${baseCost.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>
        <tr><td>Sanitary Cost</td><td>${parseFloat(v.sanitaryPct)||0}% of base</td><td>${sanCost.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>
        <tr><td>Electrical Cost</td><td>${parseFloat(v.electricalPct)||0}% of base</td><td>${elecCost.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>
        <tr><td>Finishing Cost</td><td>${parseFloat(v.finishingPct)||0}% of base</td><td>${finCost.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>
        <tr style="background:#f0e8d8"><td><strong>Total Cost (with fixtures)</strong></td><td></td><td><strong>${totalWithFix.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></td></tr>
        <tr><td>Depreciation</td><td>${age} yr × ${depRate}% = ${totalDepPct.toFixed(2)}%</td><td>− ${totalDep.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</td></tr>
        <tr class="total-row"><td colspan="2"><strong>Actual Cost (Depreciated)</strong></td><td><strong>NPR ${actual.toLocaleString("en-NP",{minimumFractionDigits:2,maximumFractionDigits:2})}</strong></td></tr>
        <tr style="background:#e8f5e9"><td><strong>Rounded Down (nearest 100)</strong></td><td style="font-size:9.5pt;color:#666">floor(÷100)×100</td><td><strong style="color:#2e7d32">NPR ${rounded.toLocaleString("en-NP")}</strong></td></tr>
      </tbody>
    </table>`);
  }).join('<div style="border-top:1pt dashed #aaa;margin:3pt 0"></div>');

  // ── Valuation fee helper (NRB schedule)
  // calcValFee is defined at module scope (below) for reuse in buildBillOnlyHTML

  // ── Summary values
  const finalComm = Math.floor((totalLandComm + totalBuildingVal) / 100) * 100;
  const finalFMV  = Math.floor((totalLandFMV2 + totalBuildingVal) / 100) * 100;
  const distressMult2 = Math.min(100, Math.max(0, parseFloat(s.distressPct)||80)) / 100;
  const distress  = Math.floor(finalFMV * distressMult2 / 100) * 100;
  // Government value
  const govVals2 = s.govValues || {};
  const totalGovFinal = (s.properties||[]).filter(p=>(s.mortgagedIds||[]).includes(p.id)).reduce((sum,p)=>{
    const r2 = (s.rates||{})[p.id]||{};
    const splits2 = ((s.plotRateSplits||{})[p.id]||[]);
    const gRate = splits2.length > 0
      ? (parseFloat(splits2[0].govRate)||0)
      : (parseFloat(r2.govRate)||0);
    const am = parseFloat((s.areaMeasured||{})[p.id])||0;
    const lSqm = (()=>{if(p.areaUnit==='sqm')return parseFloat(p.areaSqm)||0;const r=p.areaRadp||{};return(parseFloat(r.r)||0)*508.72+(parseFloat(r.a)||0)*31.795+(parseFloat(r.p)||0)*7.949+(parseFloat(r.d)||0)*1.987;})();
    const ded = parseFloat(((s.deductions||{})[p.id]||{}).area)||0;
    const ca = Math.max(0,(am||lSqm)-ded);
    return sum + gRate*(ca/31.795);
  },0);
  const finalGovFinal = Math.floor(totalGovFinal/100)*100;

  // ── Extra fields
  const vi = s.valuatorInfo||{};
  const photoList = s.photos||[];

  // Per-property description — supports new propDescriptions map + legacy single propDescription
  const propDescs = s.propDescriptions || {};
  const getLegacyPd = (pid) => {
    if (propDescs[pid]) return propDescs[pid];
    const props0 = s.properties||[];
    if (props0[0]?.id === pid && s.propDescription && Object.values(s.propDescription).some(Boolean)) return s.propDescription;
    return {};
  };

  const propDescHTML = (() => {
    const props = s.properties||[];
    if (!props.length) return '<p style="font-style:italic;color:#888">No properties entered.</p>';
    return props.map((prop, pi) => {
      const pd = getLegacyPd(prop.id);
      const HAZARD_FLAGS = ["highTensionLine","river","kuloKholchi","floodZone","landslide","graveyard","encroachment"];
      const hasData = pd.shape||pd.topography||pd.presentCondition||pd.occupancy||pd.surroundings||pd.description||HAZARD_FLAGS.some(f=>pd[f]);
      const header = props.length > 1
        ? `<div style="margin:4pt 0 2pt;font-weight:bold;color:${T.primary};font-size:10pt">Property `+(pi+1)+(prop.plotNo?' — Plot No. '+esc(prop.plotNo):'')+(prop.ownerName?' ('+esc(prop.ownerName)+')':``)+'</div>'
        : '';
      const styleKH = `font-weight:bold;text-transform:uppercase;font-size:9.5pt;background:${T.info};width:22%`;
      const styleK  = `font-weight:bold;text-transform:uppercase;font-size:9.5pt;background:${T.info}`;
      const table = hasData
        ? '<table class="info-table">'
          + '<tr><td style="'+styleKH+'">Shape of Land</td><td>'+esc(pd.shape)+'</td><td style="'+styleKH+'">Topography</td><td>'+esc(pd.topography)+'</td></tr>'
          + '<tr><td style="'+styleK+'">Present Condition</td><td>'+esc(pd.presentCondition)+'</td><td style="'+styleK+'">Occupancy</td><td>'+esc(pd.occupancy)+'</td></tr>'
          + '<tr><td style="'+styleK+'">Surroundings</td><td colspan="3">'+esc(pd.surroundings)+'</td></tr>'
          + (pd.description ? '<tr><td style="'+styleK+'">Description</td><td colspan="3">'+esc(pd.description)+'</td></tr>' : '')
          + (() => {
              const HAZARD_META = [
                { flag:'highTensionLine', label:'High Tension Line'   },
                { flag:'river',           label:'River'               },
                { flag:'kuloKholchi',     label:'Kulo / Kholchi'      },
                { flag:'floodZone',       label:'Flood Zone'          },
                { flag:'landslide',       label:'Landslide / Erosion' },
                { flag:'graveyard',       label:'Graveyard / Cemetery'},
                { flag:'encroachment',    label:'Encroachment'        },
              ];
              const active = HAZARD_META.filter(({flag}) => pd[flag]);
              if (!active.length) return '';
              return active.map(({flag, label}) => {
                const parts = [];
                if (pd[flag+'Distance']) parts.push('Distance: ' + esc(pd[flag+'Distance']));
                if (pd[flag+'Side'])     parts.push('Side: '     + esc(pd[flag+'Side']));
                if (pd[flag+'Comment'])  parts.push(`Min. Req: ${esc(pd[flag+'Comment'])}`);
                const detail = parts.length ? parts.join(' &nbsp;|&nbsp; ') : 'Present';
                return '<tr><td style="'+styleK+'">'+label+'</td><td colspan="3">'+detail+'</td></tr>';
              }).join('');
            })()
          + '</table>'
        : '<p style="font-style:italic;color:#888;padding:6pt 0">No description entered for this property.</p>';
      return header + table;
    }).join('');
  })();

  // ── 2.5 Hazards / Encumbrances (dedicated section)
  const HAZARD_DEFS_FINAL = [
    { flag:"highTensionLine", label:"High Tension Line",   hasSide:true,  hasDist:true  },
    { flag:"river",           label:"River",                hasSide:true,  hasDist:true  },
    { flag:"kuloKholchi",     label:"Kulo / Kholchi",       hasSide:true,  hasDist:true  },
    { flag:"floodZone",       label:"Flood Zone",           hasSide:false, hasDist:false },
    { flag:"landslide",       label:"Landslide / Erosion",  hasSide:true,  hasDist:true  },
    { flag:"graveyard",       label:"Graveyard / Cemetery", hasSide:true,  hasDist:true  },
    { flag:"encroachment",    label:"Encroachment",         hasSide:true,  hasDist:false },
  ];
  const hazardRowsFinal = (s.properties || []).flatMap((p, pi) => {
    const pd = getLegacyPd(p.id);
    const activeHazards = HAZARD_DEFS_FINAL.filter(h => pd[h.flag]);
    const inactiveHazards = HAZARD_DEFS_FINAL.filter(h => !pd[h.flag]);
    const rowCount = activeHazards.length + (inactiveHazards.length > 0 ? 1 : 0);
    const complies = pd.meetsMinReq;
    const complianceCell = complies === true
      ? `<span style="color:#1a7a3a;font-weight:bold">✔ Fulfills All Requirements</span>`
      : complies === false
      ? `<span style="color:#c0392b;font-weight:bold">✘ Does Not Fulfill</span>`
      : `<span style="font-style:italic">—</span>`;
    const complianceTd = `<td rowspan="${rowCount}" style="vertical-align:middle;text-align:center">${complianceCell}${pd.meetsMinReqComment ? `<br/><span style="font-size:8.5pt;color:#555">${esc(pd.meetsMinReqComment)}</span>` : ""}</td>`;
    const rows = [];
    activeHazards.forEach((h, hi) => {
      const isFirst = hi === 0;
      const plotCell = isFirst
        ? `<td rowspan="${rowCount}" style="white-space:nowrap;vertical-align:middle;font-weight:bold;background:#f5f8fc">${esc(p.plotNo)}</td>`
        : "";
      const parts = [];
      if (h.hasDist && pd[h.flag + "Distance"]) parts.push(`Dist: ${esc(pd[h.flag + "Distance"])}`);
      if (h.hasSide && pd[h.flag + "Side"])     parts.push(`Side: ${esc(pd[h.flag + "Side"])}`);
      if (pd[h.flag + "Comment"])               parts.push(`Min. Req: ${esc(pd[h.flag + "Comment"])}`);
      rows.push(`<tr>${plotCell}
        <td><strong>${esc(h.label)}</strong></td>
        <td style="color:#2a6e42;font-weight:bold">Associated${parts.length ? " — " + parts.join(", ") : ""}</td>
        ${isFirst ? complianceTd : ""}
      </tr>`);
    });
    if (inactiveHazards.length > 0) {
      const isFirst = activeHazards.length === 0;
      const plotCell = isFirst
        ? `<td rowspan="1" style="white-space:nowrap;vertical-align:middle;font-weight:bold;background:#f5f8fc">${esc(p.plotNo)}</td>`
        : "";
      rows.push(`<tr>${plotCell}
        <td>${inactiveHazards.map(h => esc(h.label)).join(", ")}</td>
        <td>Not Associated</td>
        ${isFirst ? complianceTd : ""}
      </tr>`);
    }
    return rows;
  }).join("");

  const autoScript = autoPrint ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},600);});<\/script>` : "";

  // ── Runtime DOMPurify sanitization (guards against any stored-XSS that slipped through) ──
  const purifyScript = `<script>
  window.addEventListener('load', function() {
    if (typeof DOMPurify === 'undefined') return;
    var els = document.querySelectorAll('td, p, li, span, div');
    els.forEach(function(el) {
      if (el.children.length === 0 && el.innerHTML !== el.textContent) {
        el.innerHTML = DOMPurify.sanitize(el.innerHTML, { ALLOWED_TAGS: ['strong','em','br','b','i'] });
      }
    });
  });
  <\/script>`;

  // ── TOC page-number updater script ──
  const tocScript = `<script>
  (function() {
    // Maps TOC entry number → actual HTML anchor id
    var ANCHOR_MAP = {
      '1':  'ch-1',
      '2':  'ch-2',
      '3':  'toc-s3',
      '4':  'ch-3',
      '5':  'toc-s5',
      '6':  'ch-4',
      '7':  'toc-s7',
      '8':  'toc-s8',
      '9':  'ch-6',
      '10': 'ch-7',
      '11': 'toc-s11',
      '12': 'toc-s12'
    };

    function updateToc() {
      var mmToPx = function(mm) { return mm * (96 / 25.4); };
      var A4_H = mmToPx(297);

      // Subtract the on-screen toolbar height (it's not part of the printed page)
      var toolbar = document.querySelector('.no-print');
      var toolbarH = toolbar ? toolbar.getBoundingClientRect().height : 0;

      // 3 pre-pages before .page-wrap: Cover (p.1) + Letter (p.2) + TOC (p.3)
      // So Chapter 1 (first page of .page-wrap) = physical page 4.
      var PRE_PAGES = 3;

      var pageWrap = document.querySelector('.page-wrap');
      var wrapTop  = pageWrap
        ? pageWrap.getBoundingClientRect().top + window.scrollY - toolbarH
        : 0;

      Object.keys(ANCHOR_MAP).forEach(function(num) {
        var anchorId = ANCHOR_MAP[num];
        var anchor   = document.getElementById(anchorId);
        var cell     = document.getElementById('toc-pg-' + num);
        if (!anchor || !cell) return;
        var top = anchor.getBoundingClientRect().top + window.scrollY - toolbarH - wrapTop;
        var pg  = Math.floor(top / A4_H) + 1 + PRE_PAGES;
        cell.textContent = pg;
      });
    }

    function runWhenReady() {
      // Run once now, then again after all images finish loading for accuracy
      updateToc();
      var imgs = document.images;
      var pending = 0;
      for (var i = 0; i < imgs.length; i++) {
        if (!imgs[i].complete) {
          pending++;
          imgs[i].addEventListener('load',  function() { if (--pending === 0) updateToc(); });
          imgs[i].addEventListener('error', function() { if (--pending === 0) updateToc(); });
        }
      }
      // Final safety pass after everything settles
      setTimeout(updateToc, 1200);
    }

    if (document.readyState === 'complete') { runWhenReady(); }
    else { window.addEventListener('load', runWhenReady); }
  })();
  <\/script>`;

  // ── Letterhead: use raw PNG data URL from state (set by prepareFinalState) ──
  // Only rendered on the cover letter page — nowhere else in the report.
  const lhSrc = s.letterheadPng || "";

  // ── Text box positioning from admin-defined box (% of A4 page) ──
  // The super admin drags a box on the A4 preview; coords are stored as % of the page.
  const tb = s.letterheadTextBox;
  const contentStyle = tb
    ? `position:absolute;top:${tb.top}%;left:${tb.left}%;width:${tb.width}%;height:${tb.height}%;box-sizing:border-box;overflow:auto;z-index:1;padding:2mm;`
    : `position:relative;z-index:1;padding:14mm 16mm 10mm 18mm;box-sizing:border-box;`;

  // ── Watermark region: a specific area of the letterhead shown at low opacity ──
  // The super admin drags a second box to define the watermark zone.
  // The same PNG is clipped to that region and rendered at the configured opacity.
  const wb = s.letterheadWatermarkBox; // {top,left,width,height,opacity}
  const wmHtml = (lhSrc && wb)
    ? `<div style="position:absolute;top:${wb.top}%;left:${wb.left}%;width:${wb.width}%;height:${wb.height}%;overflow:hidden;z-index:0;pointer-events:none;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <img src="${lhSrc}" alt="" style="position:absolute;top:${-(wb.top)}%;left:${-(wb.left)}%;width:${(100/wb.width)*100}%;height:${(100/wb.height)*100}%;object-fit:fill;opacity:${wb.opacity||0.12};-webkit-print-color-adjust:exact;print-color-adjust:exact;pointer-events:none;"/>
      </div>`
    : "";

  // ── Pre-build site plan pages ──
  const final_sitePlanPages = (() => {
    const plans = (s.sitePlans || []).filter(sp => sp && sp.dataUrl);
    if (!plans.length) return "";
    const docPages = plans.map(function(sp, i) {
      const label = (sp.name || ("Plan " + (i + 1))).replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");
      const isImg = sp.dataUrl.startsWith("data:image");
      const rot = sp.rotation || 0;
      const inner = isImg
        ? "<img src=\"" + sp.dataUrl + "\" class=\"plan-img\" style=\"transform:rotate(" + rot + "deg);transform-origin:center center\" alt=\"" + label + "\"/>"
        : "<object data=\"" + sp.dataUrl + "\" type=\"application/pdf\" style=\"width:100%;height:100%;border:none;display:block\"><p style=\"text-align:center;padding:20pt;color:#666;font-style:italic\">" + label + " (PDF)</p></object>";
      const spCls = i === 0 ? "photo-page-first" : "photo-page";
      return "<div class=\"" + spCls + "\">" +
        "<div class=\"photo-page-header\"><span>Site and Location Plan</span><span>" + (i + 1) + " / " + plans.length + " &mdash; " + label + "</span></div>" +
        "<div class=\"photo-grid-1\"><div class=\"photo-cell\">" +
        inner +
        "</div></div>" +
        "</div>";
    }).join("");
    const sitePlanSep = "<div class=\"photo-sep\"><div style=\"text-align:center\"><div style=\"font-size:22pt;font-weight:bold;text-transform:uppercase;letter-spacing:4px;color:" + T.primary + ";margin-bottom:12pt\">Site and Location Plan</div><div style=\"width:60mm;height:2pt;background:" + T.medium + ";margin:0 auto\"></div></div></div>";
    return sitePlanSep + docPages;
  })();

  // ── Pre-build photo pages (avoid nested template literal issues) ──
  const final_photoPages = (() => {
    const photos = (s.photos||[]).filter(p => p && (p.dataUrl||p.data));
    if (!photos.length) return "";
    const PER_PAGE = 4;
    const pages = [];
    for (let i = 0; i < photos.length; i += PER_PAGE) pages.push(photos.slice(i, i + PER_PAGE));
    const photoSep = "<div class=\"photo-sep\" id=\"toc-s11\"><div style=\"text-align:center\"><div style=\"font-size:22pt;font-weight:bold;text-transform:uppercase;letter-spacing:4px;color:" + T.primary + ";margin-bottom:12pt\">Property Photographs</div><div style=\"width:60mm;height:2pt;background:" + T.medium + ";margin:0 auto\"></div></div></div>";
    return photoSep + pages.map((group, pi) => {
      const cells = group.map((ph, ci) => {
        const num = pi * PER_PAGE + ci + 1;
        const capRaw = ph.caption || ph.label || ("Photo " + num);
        const capEsc = esc(capRaw);
        const src = ph.dataUrl || ph.data || "";
        return "<div class=\"photo-cell\"><img src=\"" + src + "\" class=\"photo-img\" alt=\"" + capEsc + "\"/><div class=\"photo-caption\">" + num + ". " + capEsc + "</div></div>";
      }).join("");
      const pageNum = pi + 1;
      const pageTotal = pages.length;
      const phCls = pi === 0 ? "photo-page-first" : "photo-page";
      return "<div class=\"" + phCls + "\">" +
        "<div class=\"photo-page-header\"><span>Property Photographs</span><span>Page " + pageNum + " of " + pageTotal + "</span></div>" +
        "<div class=\"photo-grid-4\">" + cells + "</div>" +
        "</div>";
    }).join("");
  })();

  // ── Table of contents entries ──
  const tocSections = [
    ["1",  "General Information — Bank, Dates & Parties"],
    ["2",  "Property Description & Physical Characteristics"],
    ["3",  "Location Maps"],
    ["4",  "Area to be Mortgaged & Considered Area"],
    ["5",  "Access to Property & Boundary Declaration"],
    ["6",  "Building Details & Technical Specifications"],
    ["7",  "Valuation of Land"],
    ["8",  "Valuation of Building"],
    ["9",  "Summary of Valuation"],
    ["10", "Remarks, Opinion & Declarations"],
    ["11", "Property Photographs"],
    ["12", "Legal Documents"],
  ];

  // TOC rows — page numbers filled by JS after render
  const tocRows = tocSections.map(([num, title]) =>
    `<tr id="toc-row-${num}">
      <td style="padding:3pt 8pt;border:0.5pt solid #ddd;width:10%;font-weight:bold;color:${T.primary}">${num}</td>
      <td style="padding:3pt 8pt;border:0.5pt solid #ddd">${title}</td>
      <td style="padding:3pt 8pt;border:0.5pt solid #ddd;width:10%;text-align:right;font-weight:600;color:${T.primary}" id="toc-pg-${num}">—</td>
    </tr>`
  ).join("");
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data: blob:; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;">
  <title>${suggestedFilename||"Final Valuation Report"}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js"></script>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 12mm 15mm 16mm;
    }
    @page :first { margin-top: 0; }
    *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:"Times New Roman",Times,serif; font-size:10.5pt; line-height:1.28; color:#111; background:#fff; }

    /* Running header/footer */
    @page {
      @bottom-left   { content: "Page " counter(page); font-family:"Times New Roman",Times,serif; font-size:8pt; color:#555; font-weight:bold; }
      @bottom-center { content: "Note:- ${(s.bank||"").replace(/"/g,"'").replace(/\\/g,"\\\\")}${s.branch ? " · "+(s.branch||"").replace(/"/g,"'").replace(/\\/g,"\\\\") : ""}"; font-family:"Times New Roman",Times,serif; font-size:7.5pt; color:#666; }
      @bottom-right  { content: "${(s.companyName||"").replace(/"/g,"'").replace(/\\/g,"\\\\")}"; font-family:"Times New Roman",Times,serif; font-size:7.5pt; color:#555; font-weight:bold; }
    }
    @page cover-p  { @bottom-left { content: ""; } @bottom-center { content: ""; } @bottom-right { content: ""; } }
    @page letter-p { size:A4 portrait; margin:6mm 12mm 6mm 12mm; @bottom-left { content: ""; } @bottom-center { content: ""; } @bottom-right { content: ""; } }
    @page toc-p    { @bottom-left { content: ""; } @bottom-center { content: ""; } @bottom-right { content: ""; } }
    @page photo-p      { @bottom-left { content: ""; } @bottom-center { content: ""; } @bottom-right { content: ""; } }
    @page legal-doc-p  { @bottom-left { content: ""; } @bottom-center { content: ""; } @bottom-right { content: ""; } }
    @page portrait-p { size:A4 portrait; margin:12mm 12mm 15mm 16mm; }

    /* Screen toolbar */
    .no-print { display:flex; align-items:center; gap:10px; padding:10px 20px; background:#1a1714; color:#fff;
      font-family:Arial,sans-serif; font-size:13px; position:sticky; top:0; z-index:9999; box-shadow:0 2px 8px rgba(0,0,0,0.3);
      print-color-adjust:exact; }
    .no-print button { padding:7px 20px; border:none; border-radius:5px; font-weight:700; cursor:pointer; font-size:13px; }
    .no-print .btn-print { background:#c0392b; color:#fff; }
    .no-print .btn-html  { background:#2d6a4f; color:#fff; }
    .no-print .btn-close { background:rgba(255,255,255,0.15); color:#fff; border:1px solid rgba(255,255,255,0.3); }
    @media print {
      .no-print { display:none !important; height:0 !important; overflow:hidden !important; }
      html, body {
        margin: 0 !important; padding: 0 !important;
        background: white !important;
        print-color-adjust: exact; -webkit-print-color-adjust: exact;
      }
      .page-wrap {
        page: portrait-p;
        width: 175mm !important; max-width: 175mm !important;
        margin: 0 !important; padding: 0 !important;
        overflow: hidden !important;
      }
      img { max-width: 100% !important; height: auto; }
      table { width: 100% !important; table-layout: fixed !important; word-break: break-word; }
      td, th { overflow-wrap: break-word; word-break: break-word; }
    }

    .rh { display:none; }
    @media print { .rh { display:block; } }

    /* Page wrapper */
    .page-wrap { max-width:175mm; margin:0 auto; padding:0 0 10mm; }
    @media print { .page-wrap { max-width:100%; margin:0; padding:0; } }

    /* Cover/Letter pages */
    @page cover-p  { size:210mm 297mm; margin:0; }
    @page letter-p { size:210mm 297mm; margin:0; }
    @page toc-p    { size:210mm 297mm; margin:14mm 14mm 14mm 18mm; }
    .cover-page  { page:cover-p; page-break-after:always; width:210mm; height:297mm; min-height:297mm; max-height:297mm; box-sizing:border-box; display:flex; flex-direction:column; font-family:"Times New Roman",Times,serif; background:#fff; overflow:hidden; }
    .letter-page { page:letter-p; page-break-after:always; font-family:"Times New Roman",Times,serif; font-size:9.5pt; line-height:1.38; box-sizing:border-box; overflow:hidden; width:210mm; min-height:297mm; height:297mm; position:relative; background:#fff; }
    .letter-page-bg { position:absolute; top:0; left:0; width:100%; height:100%; z-index:0; pointer-events:none; -webkit-print-color-adjust:exact; print-color-adjust:exact; background:#fff; }
    .letter-page-bg img { width:100%; height:100%; object-fit:contain; object-position:top center; display:block; opacity:1; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    .letter-page-content { position:relative; z-index:1; padding:14mm 16mm 10mm 18mm; box-sizing:border-box; min-height:297mm; display:flex; flex-direction:column; }
    .toc-page    { page:toc-p;    page-break-after:always; font-family:"Times New Roman",Times,serif; }

    /* Cover */
    .cv-topbar   { background:${T.primary}; height:16mm; width:100%; }
    .cv-lh-wrap  { width:100%; background:#fff; }
    .cv-lh-wrap img { width:100%; display:block; }
    .cv-body     { flex:1; display:flex; flex-direction:column; align-items:center; padding:5mm 18mm 0; }
    .cv-divider  { width:70mm; height:2.5pt; background:${T.primary}; margin:6mm auto; }
    .cv-badge    { border:2pt solid ${T.primary}; padding:6mm 14mm; text-align:center; background:${T.row}; width:100%; }
    .cv-badge h1 { font-size:19pt; font-weight:bold; text-transform:uppercase; letter-spacing:2px; color:${T.primary}; margin-bottom:3mm; }
    .cv-badge h2 { font-size:11.5pt; font-weight:normal; color:#444; }
    .cv-badge-label { display:inline-block; background:${T.primary}; color:#fff; font-size:11pt; font-weight:bold; letter-spacing:3px; text-transform:uppercase; padding:3pt 18pt; margin-top:5mm; }
    .cv-meta     { width:100%; border-collapse:collapse; margin-top:5mm; font-size:10.5pt; }
    .cv-meta td  { padding:3pt 6pt; border:0.75pt solid ${T.border}; }
    .cv-meta td:nth-child(odd)  { background:${T.info}; font-weight:bold; width:36%; text-transform:uppercase; font-size:9pt; color:${T.primary}; letter-spacing:0.3px; }
    .cv-foot     { background:${T.primary}; padding:4mm 20mm; display:flex; justify-content:space-between; align-items:center; font-size:9pt; color:#fff; font-family:"Times New Roman",Times,serif; }

    /* Cover letter */
    .lh-bar  { width:100%; margin-bottom:8pt; }
    .lh-bar img { width:100%; display:block; }
    .to-block  { margin-bottom:6pt; font-size:10.5pt; line-height:1.55; }
    .ltr-subj  { font-weight:bold; text-decoration:underline; font-size:11pt; margin:6pt 0 8pt; }
    .ltr-body p { margin-bottom:5pt; text-align:justify; font-size:10.5pt; }
    .ltr-sumtable { width:100%; border-collapse:collapse; margin:5pt 0 8pt; font-size:10.5pt; }
    .ltr-sumtable th { background:${T.lighter}; color:${T.primary}; padding:3pt 8pt; text-align:left; border:1pt solid ${T.border}; }
    .ltr-sumtable td { padding:3pt 8pt; border:0.75pt solid ${T.border}; }
    .ltr-signoff { margin-top:12pt; }
    .sig-rule    { border-top:1pt solid #000; width:55mm; margin-top:14pt; }

    /* TOC */
    .toc-title   { font-size:14pt; font-weight:bold; text-align:center; text-transform:uppercase; letter-spacing:2px; color:${T.primary}; margin-bottom:3mm; padding-bottom:3pt; border-bottom:2pt solid ${T.primary}; }
    .toc-lh { width:100%; margin-bottom:5mm; }
    .toc-lh img { width:100%; }
    .toc-table { width:100%; border-collapse:collapse; font-size:10.5pt; margin-top:3mm; }

    /* Section headings */
    .ch-head { background:${T.lighter}; color:${T.primary}; font-size:10.5pt; font-weight:bold; text-transform:uppercase; letter-spacing:0.8px; padding:4pt 10pt; margin:8pt 0 3pt; page-break-after:avoid; border-left:4pt solid ${T.primary}; display:flex; align-items:center; gap:5pt; }
    .sec-h3  { font-size:9.5pt; font-weight:bold; color:${T.primary}; padding:2pt 6pt 2pt 8pt; margin:4pt 0 2pt; border-left:3pt solid ${T.medium}; background:${T.light}; page-break-after:avoid; letter-spacing:0.3px; }
    .sub-head { font-size:10pt; font-weight:bold; border-bottom:1pt solid ${T.primary}; padding-bottom:1pt; margin:4pt 0 2pt; color:${T.primary}; }
    .sec-num-badge { display:inline-block; background:${T.medium}; color:${T.primary}; font-size:9pt; font-weight:bold; padding:1pt 5pt; border-radius:2pt; margin-right:3pt; }

    /* Info tables */
    table    { width:100%; border-collapse:collapse; margin-bottom:2pt; font-size:10pt; }
    th       { background:${T.lighter}; color:${T.primary}; padding:2pt 4pt; text-align:left; font-size:9pt; font-weight:bold; letter-spacing:0.3px; border:0.75pt solid ${T.border}; }
    td       { padding:2pt 4pt; border:0.75pt solid ${T.border}; vertical-align:top; }
    tr:nth-child(even) td { background:${T.row}; }
    .info-table td            { border:0.75pt solid ${T.border}; }
    .info-table td:first-child,.info-table td:nth-child(3) { background:${T.info}; font-weight:bold; width:22%; font-size:8.5pt; text-transform:uppercase; color:${T.primary}; letter-spacing:0.2px; vertical-align:middle; }
    .total-row td             { background:${T.total} !important; color:#fff !important; font-weight:bold; font-size:10.5pt; }
    .sub-total-row td         { background:${T.lighter} !important; font-weight:bold; }
    table tr:hover td         { background:${T.row}; }

    /* Valuation summary box */
    .val-summary { border:1.5pt solid ${T.primary}; margin:3pt 0; }
    .val-summary-head { background:${T.primary}; color:#fff; text-align:center; font-size:10.5pt; font-weight:bold; padding:3pt; letter-spacing:0.8px; text-transform:uppercase; }
    .val-row      { display:flex; justify-content:space-between; align-items:center; padding:3pt 8pt; border-bottom:0.5pt solid ${T.border}; }
    .val-row:last-child { border-bottom:none; }
    .val-row.a    { background:#e8f4ef; }
    .val-row.b    { background:#fff5ee; }
    .val-row.c    { background:#ffeaea; }
    .val-row .vlbl { font-weight:bold; font-size:10pt; }
    .val-row .vamt { font-weight:bold; font-size:11pt; color:${T.primary}; }
    .in-words     { border:1pt solid ${T.border}; padding:2pt 6pt; margin:1pt 0 3pt; font-style:italic; font-size:10pt; background:${T.row}; }

    /* Misc */
    .remarks-box  { border:1pt solid ${T.border}; padding:3pt 6pt; min-height:14pt; white-space:pre-wrap; font-size:10pt; background:${T.row}; margin-bottom:3pt; }
    .disclaimer   { font-size:8pt; color:#666; font-style:italic; border-top:0.5pt solid ${T.border}; padding-top:4pt; margin-top:5pt; }
    .page-break   { page-break-before:always; }
    .no-break     { page-break-inside:avoid; }
    .dashed-sep   { border-top:1pt dashed ${T.border}; margin:2pt 0; }

    /* Landscape photo pages */
    @page photo-p { size:A4 landscape; margin:12mm 12mm 12mm 12mm; }
    .photo-page { page:photo-p; page-break-before:always; break-before:page; page-break-inside:avoid; break-inside:avoid; width:100%; box-sizing:border-box; }
    .photo-page-first { page:photo-p; page-break-before:avoid; break-before:avoid; page-break-inside:avoid; break-inside:avoid; width:100%; box-sizing:border-box; }
    .photo-page-lh { display:none; }
    .photo-sep { page:photo-p; page-break-before:always; break-before:page; display:flex; align-items:center; justify-content:center; min-height:186mm; }

    /* Landscape legal document pages */
    @page legal-doc-p { size:A4 landscape; margin:10mm 14mm; }
    .legal-doc-page { page:legal-doc-p; page-break-before:always; page-break-inside:avoid; width:100%; box-sizing:border-box; }
    .legal-doc-sep  { page:legal-doc-p; page-break-before:always; display:flex; align-items:center; justify-content:center; min-height:180mm; }

    .photo-page-header { display:flex; justify-content:space-between; align-items:center; font-family:"Times New Roman",Times,serif; font-size:9pt; font-weight:bold; border-top:1.5pt solid ${T.medium}; border-bottom:0.75pt solid ${T.border}; padding:2pt 0; margin-bottom:3pt; color:${T.primary}; text-transform:uppercase; letter-spacing:0.4px; flex-shrink:0; }
    .photo-grid-4 { display:grid; grid-template-columns:1fr 1fr; grid-template-rows:1fr 1fr; gap:5pt; flex:1; min-height:0; }
    .photo-grid-1 { display:grid; grid-template-columns:1fr; grid-template-rows:1fr; flex:1; min-height:0; }
    .photo-cell   { display:flex; flex-direction:column; border:0.75pt solid #ccc; border-radius:2pt; overflow:hidden; background:#fafafa; page-break-inside:avoid; }
    .photo-cell-empty { background:#f5f5f5 !important; border:0.75pt dashed #ddd !important; }
    .photo-img    { flex:1; width:100%; object-fit:cover; display:block; min-height:0; }
    .plan-img     { flex:1; width:100%; height:100%; object-fit:contain; display:block; min-height:0; }
    .photo-caption{ font-family:"Times New Roman",Times,serif; font-size:8.5pt; font-style:italic; text-align:center; padding:2pt 4pt; background:#eef2f7; border-top:0.5pt solid #ddd; color:#333; flex-shrink:0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    @media screen {
      .photo-page, .photo-page-first { background:white; width:273mm; max-width:273mm; margin:20px auto; padding:12mm; box-shadow:0 2px 12px rgba(0,0,0,0.12); box-sizing:border-box; }
      .photo-sep { background:white; width:273mm; max-width:273mm; margin:20px auto; padding:12mm; box-shadow:0 2px 12px rgba(0,0,0,0.12); box-sizing:border-box; min-height:186mm; }
      .legal-doc-page { background:white; max-width:277mm; margin:20px auto; padding:10mm 14mm; box-shadow:0 2px 12px rgba(0,0,0,0.12); }
      .photo-grid-4 { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: auto auto; gap: 8pt; }
      .photo-grid-1 { display: grid; grid-template-columns: 1fr; grid-template-rows: 1fr; }
      .photo-cell { height: 220px; }
      .photo-grid-1 .photo-cell { height: 500px; }
      .photo-img  { height: 100%; object-fit: cover; }
      .plan-img   { width: 100%; height: 100%; object-fit: contain; display: block; }
    }
    @media print {
      .photo-sep {
        page: photo-p;
        width: 273mm !important; max-width: 273mm !important;
        height: 186mm !important;
        display: flex !important; align-items: center !important; justify-content: center !important;
        box-sizing: border-box !important;
      }
      .photo-page, .photo-page-first {
        page: photo-p;
        width: 273mm !important; max-width: 273mm !important;
        height: 186mm !important;
        box-shadow:none !important; margin:0 !important; padding:0 !important;
        display:flex !important; flex-direction:column !important;
        overflow:hidden !important; box-sizing: border-box !important;
      }
      .legal-doc-page { box-shadow:none !important; margin:0 !important; padding:0 !important; }
      .photo-grid-4 { flex: 1 1 0 !important; min-height: 0 !important; display: grid !important; grid-template-columns: 1fr 1fr !important; grid-template-rows: 1fr 1fr !important; gap: 5pt !important; }
      .photo-grid-1 { flex: 1 1 0 !important; min-height: 0 !important; display: grid !important; grid-template-columns: 1fr !important; grid-template-rows: 1fr !important; gap: 0 !important; }
      .photo-cell { overflow: hidden !important; display: flex !important; flex-direction: column !important; }
      .photo-img { width: 100% !important; height: 100% !important; object-fit: cover !important; display: block !important; flex: 1 !important; min-height: 0 !important; }
      .plan-img { width: 100% !important; height: 100% !important; object-fit: contain !important; display: block !important; flex: 1 !important; min-height: 0 !important; }
      .letter-page { font-size:9.5pt !important; }
      .no-print { display:none !important; height:0 !important; }
    }

    /* Cover/letter screen shadow */
    @media screen {
      .cover-page  { box-shadow:0 4px 20px rgba(0,0,0,0.15); margin:20px auto; max-width:210mm; }
      .letter-page { box-shadow:0 2px 12px rgba(0,0,0,0.1); margin:20px auto; max-width:210mm; }
      .toc-page    { box-shadow:0 2px 12px rgba(0,0,0,0.1); margin:20px auto; max-width:175mm; padding:10mm 14mm; }
      .page-wrap   { box-shadow:0 2px 12px rgba(0,0,0,0.08); margin:20px auto; padding:10mm 14mm; background:white; }
    }
  </style></head>
  <body>
  <div class="no-print">
    <span style="font-weight:600;flex:1">📄 ${esc(suggestedFilename, "Final Valuation Report")}</span>
    <button class="btn-print" onclick="window.print()" title="Or press Ctrl+P / ⌘P">🖨️ Ctrl+P to Print / Save as PDF</button>
    <button class="btn-close" onclick="window.close()">✕ Close</button>
  </div>
  <!-- COVER PAGE -->
  <div class="cover-page">
    <div style="width:100%;height:8pt;background:${T.primary};flex-shrink:0"></div>
    <div style="width:100%;height:3pt;background:${T.medium};flex-shrink:0"></div>
    <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:4mm 18mm 0;text-align:center;overflow:hidden">
      <div style="margin-bottom:5mm">
        <div style="font-size:9pt;font-weight:bold;text-transform:uppercase;letter-spacing:5px;color:#bbb;margin-bottom:2mm">Property</div>
        <div style="font-size:34pt;font-weight:bold;text-transform:uppercase;letter-spacing:6px;color:${T.primary};line-height:1.05">VALUATION</div>
        <div style="font-size:34pt;font-weight:bold;text-transform:uppercase;letter-spacing:6px;color:${T.primary};line-height:1.05">REPORT</div>
        <div style="font-size:16pt;font-weight:bold;color:${T.medium};letter-spacing:4px;margin-top:2mm">${new Date().getFullYear()}</div>
        <div style="display:flex;align-items:center;justify-content:center;margin:3mm auto 0;width:60mm">
          <div style="flex:1;height:1.5pt;background:${T.primary}"></div>
          <div style="width:7pt;height:7pt;background:${T.medium};margin:0 3pt;transform:rotate(45deg);flex-shrink:0"></div>
          <div style="flex:1;height:1.5pt;background:${T.primary}"></div>
        </div>
      </div>
      <div style="width:100%;display:flex;flex-direction:column;gap:2.5mm">
        <div style="border:0.75pt solid ${T.lighter};border-left:3pt solid ${T.primary};padding:3pt 10pt;background:linear-gradient(to right,${T.light},#fff);text-align:left">
          <div style="font-size:8pt;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;color:${T.medium};margin-bottom:2pt">Client and Address</div>
          ${(s.clients||[]).map(cl=>{
            const rows=[];
            if(cl.showPerson&&cl.person?.name){
              rows.push(`<div style="font-weight:bold;font-size:12pt;color:${T.primary};line-height:1.25">${esc(fullName(cl.person))}</div>`);
              if(cl.person.contact) rows.push(`<div style="font-size:9.5pt;color:#666">Tel. ${esc(cl.person.contact)}</div>`);
            }
            if(cl.showCompany&&cl.company?.name){
              rows.push(`<div style="font-weight:bold;font-size:12pt;color:${T.primary};line-height:1.25">${esc(cl.company.name)}</div>`);
            }
            return rows.join("");
          }).join('<div style="border-top:0.5pt dashed #ddd;margin:2pt 0"></div>')||`<div style="color:#aaa;font-style:italic">—</div>`}
        </div>
        <div style="border:0.75pt solid ${T.lighter};border-left:3pt solid ${T.primary};padding:3pt 10pt;background:linear-gradient(to right,${T.light},#fff);text-align:left">
          <div style="font-size:8pt;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;color:${T.medium};margin-bottom:2pt">Owners and Location of Property</div>
          ${(s.owners||[]).map(ow=>{
            const rows=[];
            if(ow.showPerson&&ow.person?.name) rows.push(`<div style="font-weight:bold;font-size:12pt;color:${T.primary};line-height:1.25">${esc(fullName(ow.person))}</div>`);
            if(ow.showCompany&&ow.company?.name) rows.push(`<div style="font-weight:bold;font-size:12pt;color:${T.primary};line-height:1.25">${esc(ow.company.name)}</div>`);
            return rows.join("");
          }).join('<div style="border-top:0.5pt dashed #ddd;margin:2pt 0"></div>')||`<div style="color:#aaa;font-style:italic">—</div>`}
          ${(()=>{
            const props=s.properties||[];
            if(!props.length) return '';
            const plotParts=props.map(p=>{const parts=[];if(p.plotNo)parts.push(`Plot No.: <strong>${esc(p.plotNo)}</strong>`);if(p.traceSheetNo)parts.push(`Trace No.: <strong>${esc(p.traceSheetNo)}</strong>`);return parts.join(' &nbsp;|&nbsp; ');}).filter(Boolean);
            if(!plotParts.length) return '';
            return `<div style="font-size:9.5pt;color:#555;margin-top:3pt;border-top:0.5pt solid #eee;padding-top:3pt">${plotParts.join('<br>')}</div>`;
          })()}
          ${(()=>{
            const props=s.properties||[];
            if(!props.length) return '';
            function distM(a,b,c,d){const R=6371000,r=Math.PI/180,dL=(c-a)*r,dN=(d-b)*r,x=Math.sin(dL/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(dN/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
            const groups=[];
            props.forEach(p=>{
              const addr=(p.addressLalpurja||'').trim();if(!addr)return;
              const lat=parseFloat(p.lat),lng=parseFloat(p.lng),hasGPS=!isNaN(lat)&&!isNaN(lng);
              let merged=false;
              for(const g of groups){const gl=parseFloat(g.lat),gn=parseFloat(g.lng),gh=!isNaN(gl)&&!isNaN(gn);if(g.addr===addr||(hasGPS&&gh&&distM(lat,lng,gl,gn)<=30)){g.plots.push(p.plotNo||'—');merged=true;break;}}
              if(!merged)groups.push({addr,plots:[p.plotNo||'—'],lat:p.lat,lng:p.lng});
            });
            return groups.map(g=>{
              const pl=groups.length>1||g.plots.length>1?` <span style="font-size:8.5pt;color:#888">(Plot: ${g.plots.map(esc).join(', ')})</span>`:'';
              return `<div style="font-size:10pt;color:#555;margin-top:2pt">${esc(g.addr)}${pl}</div>`;
            }).join('');
          })()}
        </div>
        <div style="border:0.75pt solid ${T.lighter};border-left:3pt solid ${T.primary};padding:3pt 10pt;background:linear-gradient(to right,${T.light},#fff);text-align:left">
          <div style="font-size:8pt;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;color:${T.medium};margin-bottom:2pt">Present Location of Property</div>
          ${(()=>{
            const props=s.properties||[];
            if(!props.length) return '<div style="color:#aaa;font-style:italic">—</div>';
            function distM(a,b,c,d){const R=6371000,r=Math.PI/180,dL=(c-a)*r,dN=(d-b)*r,x=Math.sin(dL/2)**2+Math.cos(a*r)*Math.cos(c*r)*Math.sin(dN/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));}
            const groups=[];
            props.forEach(p=>{
              const addr=(p.presentAddress||'').trim();if(!addr)return;
              const lat=parseFloat(p.lat),lng=parseFloat(p.lng),hasGPS=!isNaN(lat)&&!isNaN(lng);
              let merged=false;
              for(const g of groups){const gl=parseFloat(g.lat),gn=parseFloat(g.lng),gh=!isNaN(gl)&&!isNaN(gn);if(g.addr===addr||(hasGPS&&gh&&distM(lat,lng,gl,gn)<=30)){g.plots.push(p.plotNo||'—');merged=true;break;}}
              if(!merged)groups.push({addr,plots:[p.plotNo||'—'],lat:p.lat,lng:p.lng});
            });
            if(!groups.length) return '<div style="color:#aaa;font-style:italic">—</div>';
            return groups.map(g=>{
              const pl=groups.length>1||g.plots.length>1?` <span style="font-size:8.5pt;color:#888">(Plot: ${g.plots.map(esc).join(', ')})</span>`:'';
              return `<div style="font-weight:bold;font-size:12pt;color:${T.primary};line-height:1.25">${esc(g.addr)}${pl}</div>`;
            }).join('');
          })()}
        </div>
        <div style="display:flex;align-items:center;width:100%;margin:0.5mm 0">
          <div style="flex:1;height:0.75pt;background:#e0d8d0"></div>
          <div style="display:flex;gap:3pt;margin:0 5pt">
            <div style="width:4pt;height:4pt;background:${T.primary};transform:rotate(45deg)"></div>
            <div style="width:4pt;height:4pt;background:${T.medium};transform:rotate(45deg)"></div>
            <div style="width:4pt;height:4pt;background:${T.primary};transform:rotate(45deg)"></div>
          </div>
          <div style="flex:1;height:0.75pt;background:#e0d8d0"></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:2.5mm">
          <div style="border:0.75pt solid #f4e8d8;border-left:3pt solid ${T.medium};padding:3pt 10pt;background:linear-gradient(to right,#fffbf6,#fff);text-align:left">
            <div style="font-size:8pt;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;color:${T.primary};margin-bottom:2pt">Submitted To</div>
            <div style="font-weight:bold;font-size:12pt;color:${T.primary};line-height:1.25">${esc(s.bank)}</div>
            ${s.branch?`<div style="font-size:10pt;color:#444">${esc(s.branch)} Branch</div>`:""}
          </div>
          <div style="border:0.75pt solid #f4e8d8;border-left:3pt solid ${T.medium};padding:3pt 10pt;background:linear-gradient(to right,#fffbf6,#fff);text-align:left">
            <div style="font-size:8pt;font-weight:bold;text-transform:uppercase;letter-spacing:1.5px;color:${T.primary};margin-bottom:2pt">Submitted By</div>
            <div style="font-weight:bold;font-size:12pt;color:${T.primary};line-height:1.25">${esc(vi.company, "Neo-Civic Consulting (P). Ltd")}</div>
            ${vi.phone?`<div style="font-size:9.5pt;color:#555">Tel. ${esc(vi.phone)}</div>`:""}
          </div>
        </div>
      </div>
    </div>
    <div style="width:100%;height:3pt;background:${T.medium};flex-shrink:0;margin-top:4mm"></div>
    <div style="width:100%;height:8pt;background:${T.primary};flex-shrink:0"></div>
  </div>
  <!-- COVER LETTER -->
  <div class="letter-page">
    ${lhSrc ? `<div class="letter-page-bg">
      <img src="${lhSrc}" alt="Company Letterhead"/>
    </div>` : ""}
    ${wmHtml}
    <div style="${contentStyle}">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:2pt;font-size:9pt">
      <div><strong>Ref. No.: ${new Date().getFullYear()}-${s.reportId ? String(s.reportId).padStart(3, "0") : "—"}</strong></div>
      <div>Date:-&nbsp;&nbsp;<strong>${s.reportDate||new Date().toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric"})}</strong></div>
    </div>
    <div style="margin-bottom:2pt;font-size:9pt;line-height:1.38">
      To<br/>
      The Manager<br/>
      <strong>${esc(s.bank, "[Bank Name]")}</strong><br/>
      ${s.branch?`<strong>${esc(s.branch)} Branch</strong>`:""}
    </div>
    <div style="text-align:center;font-weight:bold;text-decoration:underline;font-size:9.5pt;margin:2pt 0 3pt">
      Subject: Assessment of Property Values
    </div>
    <div style="font-size:9pt;line-height:1.35;text-align:justify">
      <p style="margin-bottom:2pt">Dear Sir/ Madam,</p>
      <p style="margin-bottom:2pt">&nbsp;&nbsp;&nbsp;We are pleased to submit herewith Valuation Report of following property based on present market value, which is intended to mortgage in favor of ${esc(s.bank, "[Bank Name]")} by:</p>
      ${(()=>{
        const cl0=s.clients||[],pr0=s.properties||[];
        const multiCl=cl0.length>1;
        const td=(v,w,bg,bold)=>`<td style="padding:2pt 6pt;border:0.75pt solid #bbb${w?';width:'+w:''}${bg?';background:'+bg:''}${bold?';font-weight:bold':''}">${v}</td>`;
        let r=`<table style="width:100%;border-collapse:collapse;margin-bottom:3pt;font-size:9.5pt">`;
        if(!multiCl){
          const cl=cl0[0]||{};
          const nm=esc(cl.showPerson&&cl.person?.name?fullName(cl.person):cl.showCompany&&cl.company?.name?cl.company.name:'—');
          const addr=esc(cl.person?.address||cl.company?.address||pr0[0]?.presentAddress||'—');
          const phone=esc(cl.person?.contact||cl.company?.contact||'—');
          r+=`<tr>${td('Name','34%','','bold')}${td(':','3%')}${td(nm)}</tr>`;
          r+=`<tr>${td('Address of the Client','34%')}${td(':','3%')}${td(addr)}</tr>`;
          r+=`<tr>${td('Contact No.','34%')}${td(':','3%')}${td(phone)}</tr>`;
        } else {
          r+=`<tr>${td('No.','4%',T.info,'bold')}${td('Name','28%',T.info,'bold')}${td('Address','',T.info,'bold')}${td('Contact No.','16%',T.info,'bold')}</tr>`;
          cl0.forEach((cl,i)=>{
            const nm=esc(cl.showPerson&&cl.person?.name?fullName(cl.person):cl.showCompany&&cl.company?.name?cl.company.name:'—');
            const addr=esc(cl.person?.address||cl.company?.address||'—');
            const phone=esc(cl.person?.contact||cl.company?.contact||'—');
            r+=`<tr>${td(i+1,'4%')}${td(nm,'28%')}${td(addr)}${td(phone,'16%')}</tr>`;
          });
        }
        r+=`</table>`;
        return r;
      })()}
      <p style="margin-bottom:2pt">We have taken all care to ascertain value of properties as directed by the client:</p>
      ${(()=>{
        const pr0=s.properties||[];
        const ow0=s.owners||[];
        const multiP=pr0.length>1;
        const multiO=ow0.length>1;
        const aFmt=p=>{if(!p)return'—';if(p.areaUnit==='radp'){const r=p.areaRadp||{};return[r.r&&r.r+'-R',r.a&&r.a+'-A',r.p&&r.p+'-P',r.d&&r.d+'-D'].filter(Boolean).join(' ')||'—';}return p.areaSqm?p.areaSqm+' sq.m':'—';};
        const distM=(a,b,c,d)=>{const R=6371000,rad=Math.PI/180,dL=(c-a)*rad,dN=(d-b)*rad,x=Math.sin(dL/2)**2+Math.cos(a*rad)*Math.cos(c*rad)*Math.sin(dN/2)**2;return R*2*Math.atan2(Math.sqrt(x),Math.sqrt(1-x));};
        const dedupAddr=(key)=>{const groups=[];pr0.forEach(p=>{const addr=(p[key]||'').trim();if(!addr)return;const lat=parseFloat(p.lat),lng=parseFloat(p.lng),hasGPS=!isNaN(lat)&&!isNaN(lng);let merged=false;for(const g of groups){const gl=parseFloat(g.lat),gn=parseFloat(g.lng),gh=!isNaN(gl)&&!isNaN(gn);if(g.addr===addr||(hasGPS&&gh&&distM(lat,lng,gl,gn)<=30)){g.plots.push(p.plotNo||'—');merged=true;break;}}if(!merged)groups.push({addr,plots:[p.plotNo||'—'],lat:p.lat,lng:p.lng});});return groups;};
        if(!multiP && !multiO){
          const p=pr0[0]||{};
          const ow=ow0[0]||{};
          const owName=esc(ow.showPerson&&ow.person?.name?fullName(ow.person):ow.showCompany&&ow.company?.name?ow.company.name:[p.ownerSalutation,p.ownerName].filter(Boolean).join(' ')||'—');
          const td=(v,w)=>`<td style="padding:2pt 5pt;border:0.75pt solid #bbb${w?';width:'+w:''}">${v}</td>`;
          const locVal = esc([p.addressLalpurja, p.location].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ') || '—');
          const preVal = esc(p.presentAddress || '—');
          return `<table style="width:100%;border-collapse:collapse;margin-bottom:3pt;font-size:9.5pt">
            <tr>${td('Name of Owner','34%')}${td(':','3%')}${td(owName)}</tr>
            <tr>${td('Location of Property')}${td(':','3%')}${td(locVal)}</tr>
            <tr>${td('Present Location')}${td(':','3%')}${td(preVal)}</tr>
            <tr>${td('Plot No.')}${td(':','3%')}${td(esc(p.plotNo))}</tr>
            <tr>${td('Area')}${td(':','3%')}${td(aFmt(p))}</tr>
            <tr>${td('Sheet No. of Blue Print')}${td(':','3%')}${td(esc(p.traceSheetNo))}</tr>
          </table>`;
        }
        const th=v=>`<th style="background:${T.lighter};color:${T.primary};padding:2pt 5pt;text-align:left;font-size:9pt;border:0.75pt solid ${T.border}">${v}</th>`;
        const td2=v=>`<td style="padding:2pt 5pt;border:0.5pt solid #ddd;font-size:9.5pt">${v}</td>`;
        let r=`<div style="font-weight:bold;font-size:8.5pt;color:${T.primary};text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2pt">Plot / Property Details</div>`;
        r+=`<table style="width:100%;border-collapse:collapse;margin-bottom:3pt">`;
        r+=`<thead><tr>`;
        if(multiO) r+=th('Owner');
        r+=th('Plot No.')+th('Area')+th('Trace Sheet No.')+`</tr></thead><tbody>`;
        pr0.forEach((p,pi)=>{
          const ow=ow0[pi]||ow0[0]||{};
          const owName=esc(ow.showPerson&&ow.person?.name?fullName(ow.person):ow.showCompany&&ow.company?.name?ow.company.name:[p.ownerSalutation,p.ownerName].filter(Boolean).join(' ')||'—');
          r+=`<tr>`;
          if(multiO) r+=td2(owName);
          r+=td2(esc(p.plotNo))+td2(aFmt(p))+td2(esc(p.traceSheetNo))+`</tr>`;
        });
        r+=`</tbody></table>`;
        const dedupAddrCombined = () => {
          const groups = [];
          pr0.forEach(p => {
            const addr = [p.addressLalpurja, p.location].filter(Boolean).filter((v,i,a)=>a.indexOf(v)===i).join(', ').trim();
            if(!addr) return;
            const lat=parseFloat(p.lat),lng=parseFloat(p.lng),hasGPS=!isNaN(lat)&&!isNaN(lng);
            let merged=false;
            for(const g of groups){
              const gl=parseFloat(g.lat),gn=parseFloat(g.lng),gh=!isNaN(gl)&&!isNaN(gn);
              if(g.addr===addr||(hasGPS&&gh&&distM(lat,lng,gl,gn)<=30)){g.plots.push(p.plotNo||'—');merged=true;break;}
            }
            if(!merged) groups.push({addr,plots:[p.plotNo||'—'],lat:p.lat,lng:p.lng});
          });
          return groups;
        };
        const locGroups=dedupAddrCombined();
        const preGroups=dedupAddr('presentAddress');
        const td3=(v,w)=>`<td style="padding:2pt 5pt;border:0.75pt solid #bbb${w?';width:'+w:''}">${v}</td>`;
        r+=`<table style="width:100%;border-collapse:collapse;margin-bottom:3pt;font-size:9.5pt">`;
        if(locGroups.length>=1){
          const locStr=locGroups.map(g=>esc(g.addr)+(locGroups.length>1||g.plots.length>1?` (Plot: ${g.plots.map(esc).join(', ')})`:'') ).join('<br>');
          r+=`<tr>${td3('Location of Property','34%')}${td3(':','3%')}${td3(locStr||'—')}</tr>`;
        }
        if(preGroups.length>=1){
          const preStr=preGroups.map(g=>esc(g.addr)+(preGroups.length>1||g.plots.length>1?` (Plot: ${g.plots.map(esc).join(', ')})`:'') ).join('<br>');
          r+=`<tr>${td3('Present Location','34%')}${td3(':','3%')}${td3(preStr||'—')}</tr>`;
        }
        r+=`</table>`;
        return r;
      })()}
      <p style="margin-bottom:1pt"><u>We hereby declare and certify that:</u></p>
      <p style="margin-bottom:1pt">a) We have no direct and indirect interest in said properties.</p>
      <p style="margin-bottom:1pt">b) The information furnished is true and correct to the best of our knowledge and belief, which are based on documents furnished by the client.</p>
      <p style="margin-bottom:1pt">c) We have prepared independent valuation assessments for each category of assets.</p>
      <p style="margin-bottom:1pt">The current value of the property assessed comes to</p>
      <table style="width:100%;border-collapse:collapse;font-size:9pt;margin-bottom:2pt">
        ${s.hasBuilding===true&&(s.buildings||[]).length>0&&totalBuildingVal>0?`<tr>
          <td style="padding:2pt 5pt;border:0.75pt solid ${T.border};width:40%;font-weight:bold">Building Value</td>
          <td style="padding:2pt 5pt;border:0.75pt solid ${T.border};width:8%;text-align:center">NRs.</td>
          <td style="padding:2pt 5pt;border:0.75pt solid ${T.border};font-weight:bold;text-align:center;font-size:10pt">${totalBuildingVal.toLocaleString("en-NP")}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:1pt 6pt;border:0.75pt solid ${T.border};font-style:italic;font-size:9pt;color:#444">In Word: ${toWords(totalBuildingVal)} Rupees only .</td>
        </tr>`:""}
        <tr>
          <td style="padding:2pt 5pt;border:0.75pt solid ${T.border};width:40%;font-weight:bold">Net Commercial value</td>
          <td style="padding:2pt 5pt;border:0.75pt solid ${T.border};width:8%;text-align:center">NRs.</td>
          <td style="padding:2pt 5pt;border:0.75pt solid ${T.border};font-weight:bold;text-align:center;font-size:10pt">${finalComm.toLocaleString("en-NP")}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:1pt 6pt;border:0.75pt solid ${T.border};font-style:italic;font-size:9pt;color:#444">In Word: ${toWords(finalComm)} Rupees only .</td>
        </tr>
        <tr>
          <td style="padding:2pt 5pt;border:0.75pt solid ${T.border};font-weight:bold">Net Fair Market value</td>
          <td style="padding:2pt 5pt;border:0.75pt solid ${T.border};text-align:center">NRs.</td>
          <td style="padding:2pt 5pt;border:0.75pt solid ${T.border};font-weight:bold;text-align:center;font-size:10pt">${finalFMV.toLocaleString("en-NP")}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:1pt 6pt;border:0.75pt solid ${T.border};font-style:italic;font-size:9pt;color:#444">In Word: ${toWords(finalFMV)} Rupees only .</td>
        </tr>
        <tr>
          <td style="padding:2pt 5pt;border:0.75pt solid ${T.border};font-weight:bold">Net Distress Value</td>
          <td style="padding:2pt 5pt;border:0.75pt solid ${T.border};text-align:center">NRs.</td>
          <td style="padding:2pt 5pt;border:0.75pt solid ${T.border};font-weight:bold;text-align:center;font-size:10pt">${distress.toLocaleString("en-NP")}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:1pt 6pt;border:0.75pt solid ${T.border};font-style:italic;font-size:9pt;color:#444">In Word: ${toWords(distress)} Rupees only .</td>
        </tr>
        ${finalGovFinal>0?`<tr>
          <td style="padding:2pt 5pt;border:0.75pt solid ${T.border};font-weight:bold">Government Value of Land</td>
          <td style="padding:2pt 5pt;border:0.75pt solid ${T.border};text-align:center">NRs.</td>
          <td style="padding:2pt 5pt;border:0.75pt solid ${T.border};font-weight:bold;text-align:center;font-size:10pt">${finalGovFinal.toLocaleString("en-NP")}</td>
        </tr>
        <tr>
          <td colspan="3" style="padding:1pt 6pt;border:0.75pt solid ${T.border};font-style:italic;font-size:9pt;color:#444">In Word: ${toWords(finalGovFinal)} Rupees only .</td>
        </tr>`:""}
      </table>
      <p style="margin-top:2pt;margin-bottom:1pt">we hope you will find this in order. Thanking you for entrusting us with our works and assuring you of our best professional service.</p>
      <p style="margin-bottom:0">Sincerely yours;</p>
    </div>
    <div style="margin-top:3pt">
      <div style="border-top:1pt solid #000;width:45mm;margin-top:10pt;margin-bottom:2pt"></div>
      <div style="font-size:10pt">For ${esc(vi.company, "Neo- Civic Consulting (P). Ltd")}</div>
      <div style="font-weight:bold;font-size:10pt">${esc(vi.name, "Er. Saakar Rimal")}</div>
      <div style="font-size:10pt">Contact No.: ${esc(vi.phone||vi.licenseNo, "014353196")}</div>
    </div>
    </div>
  </div>

  <!-- TABLE OF CONTENTS -->
  <div class="toc-page">
    <div class="toc-title">Table of Contents</div>
    <table class="toc-table">
      <thead><tr><th style="width:10%">No.</th><th>Section Title</th><th style="width:12%;text-align:right">Page</th></tr></thead>
      <tbody>${tocRows}</tbody>
    </table>
    <div style="margin-top:6mm;font-size:9.5pt;color:#666;font-style:italic;text-align:center">
      ${esc(suggestedFilename, "Final Property Valuation Report")} &nbsp;|&nbsp; ${esc(s.reportDate, "")}
    </div>
  </div>
  <!-- MAIN REPORT BODY -->
  <div class="page-wrap">
    <div style="border:1.5pt solid ${T.primary};padding:4pt 10pt;margin-bottom:5pt;background:${T.row};text-align:center">
      <div style="font-size:8pt;font-weight:bold;text-transform:uppercase;letter-spacing:2px;color:#888;margin-bottom:1pt">${esc(s.bank, "Bank Name")}${s.branch?" &nbsp;|&nbsp; "+esc(s.branch):""}</div>
      <div style="font-size:13pt;font-weight:bold;text-transform:uppercase;letter-spacing:1px;color:${T.primary};margin:1pt 0">Property Valuation Report</div>
      <div style="width:45mm;height:1.5pt;background:${T.medium};margin:2pt auto"></div>
      <div style="font-size:9.5pt;color:#555;margin-top:1pt">Security Assessment for Loan / Mortgage &nbsp;|&nbsp; <strong style="color:${T.primary};letter-spacing:1px">FINAL REPORT</strong></div>
      <div style="font-size:9pt;color:#666;margin-top:2pt;display:flex;justify-content:center;gap:14pt;flex-wrap:wrap">
        <span>Visit: <strong>${esc(s.visitDate)}</strong></span>
        <span>Report: <strong>${esc(s.reportDate)}</strong></span>
        <span>Valuator: <strong>${esc(vi.name)}</strong></span>
      </div>
    </div>

    <div class="ch-head" id="ch-1">Chapter 1 &nbsp;|&nbsp; General Information</div>

    <div class="sec-h3">1.1 &nbsp; Bank &amp; Branch</div>
    <table class="info-table">
      <tr><td>Bank</td><td>${esc(s.bank)}</td><td>Branch</td><td>${esc(s.branch)}</td></tr>
      <tr><td>Date of Field Visit</td><td>${esc(s.visitDate)}</td><td>Date of Reporting</td><td>${esc(s.reportDate)}</td></tr>
    </table>

    <div class="sec-h3">1.2 &nbsp; ${clientLabel} Information</div>
    ${clientsHTML||`<p style="font-style:italic;color:#888">No ${clientLabel.toLowerCase()} information entered.</p>`}

    <div class="sec-h3">1.3 &nbsp; ${ownerLabel} Information</div>
    ${ownersHTML||`<p style="font-style:italic;color:#888">No ${ownerLabel.toLowerCase()} information entered.</p>`}

    <div class="sec-h3">1.4 &nbsp; Property Register Details</div>
    ${(s.properties||[]).length===0 ? `<p style="font-style:italic;color:#888;padding:10pt">No property data entered.</p>` :
      (s.properties||[]).map((p,pi)=>{
        const sqmVal2=(()=>{if(p.areaUnit==='sqm')return parseFloat(p.areaSqm)||0;const r=p.areaRadp||{};return(parseFloat(r.r)||0)*508.72+(parseFloat(r.a)||0)*31.795+(parseFloat(r.p)||0)*7.949+(parseFloat(r.d)||0)*1.987;})();
        const lalpurjaArea=(()=>{if(p.areaUnit==='radp'){const r=p.areaRadp||{};const parts=[];if(r.r)parts.push(r.r+' Ropani');if(r.a)parts.push(r.a+' Aana');if(r.p)parts.push(r.p+' Paisa');if(r.d)parts.push(r.d+' Dam');return parts.join(' ')||'—';}return p.areaSqm?p.areaSqm+' sq.m':'—';})();
        const radpStr=p.areaUnit==='radp'?`${p.areaRadp?.r||0}-${p.areaRadp?.a||0}-${p.areaRadp?.p||0}-${p.areaRadp?.d||0}`:`${Math.floor(sqmVal2/508.72)}-${Math.floor((sqmVal2%508.72)/31.795)}-${Math.floor((sqmVal2%31.795)/7.949)}-${Math.floor((sqmVal2%7.949)/1.987)}`;
        const sr2=(label,val)=>`<tr><td style="background:${T.info};font-weight:bold;font-size:9pt;width:36%;color:${T.primary};padding:3pt 6pt;border:0.5pt solid #ccc">${label}</td><td style="font-size:10pt;padding:3pt 6pt;border:0.5pt solid #ccc">${val||'—'}</td></tr>`;
        const dur2=transferDuration(p.transferDate);
        return `<div style="margin-bottom:4pt;break-inside:avoid"><div style="background:${T.lighter};color:${T.primary};padding:3pt 7pt;font-weight:bold;font-size:9.5pt;border-left:3pt solid ${T.primary}">Property ${pi+1} &nbsp;|&nbsp; Plot No. ${esc(p.plotNo)} &nbsp;|&nbsp; Trace Sheet No. ${esc(p.traceSheetNo)}</div><table style="width:100%;border-collapse:collapse">${sr2('Plot No. (Kitta)',esc(p.plotNo))}${sr2('Trace Sheet No.',esc(p.traceSheetNo))}${sr2('Name of Owner',esc(p.ownerName))}${sr2('Type of Land',esc(p.landType))}${sr2('Category of Land',esc(p.category))}${sr2('Type of Ownership',esc(p.ownershipType))}${sr2('Area as per Lalpurja',lalpurjaArea)}${sr2('Area (sq.m)',sqmVal2>0?sqmVal2.toFixed(2)+' sq.m':'—')}${sr2('Area (R-A-P-D)',radpStr)}${sr2('Address as per Lalpurja',esc(p.addressLalpurja))}${sr2('Present Address',esc(p.presentAddress))}${sr2('Google Plus Code',esc(p.googlePlusCode))}${sr2('Latitude / Longitude',(p.lat&&p.lng)?p.lat+' / '+p.lng:'—')}${sr2('Mode of Transfer',esc(p.modeOfTransfer))}${sr2('Transfer Date (BS)',p.transferDate?(esc(p.transferDate)+(dur2?` <span style="font-size:8.5pt;color:#555">(${dur2})</span>`:'')):'—')}</table></div>`;
      }).join('')
    }

    <div class="ch-head" id="ch-2">Chapter 2 &nbsp;|&nbsp; Property Description &amp; Physical Characteristics</div>

    <div class="sec-h3">2.1 &nbsp; Physical Description</div>
    ${propDescHTML}

    <div class="sec-h3" id="toc-s3">2.2 &nbsp; Location Maps</div>
    ${mapsHTML}

    <div class="sec-h3" id="toc-s5">2.3 &nbsp; Access to Property</div>
    <table>
      <thead><tr><th>Plot No.</th><th>Type of Road</th><th>Frontage (ft)</th><th>Width (Field) ft</th><th>Width (Trace) ft</th><th>Remarks</th></tr></thead>
      <tbody>${roadAccessHTML||`<tr><td colspan="6" style="text-align:center;font-style:italic;color:#888">No road access data</td></tr>`}</tbody>
    </table>

    <div class="sec-h3">2.4 &nbsp; Boundary Declaration</div>
    <table>
      <thead><tr><th>Plot No.</th><th>East</th><th>West</th><th>North</th><th>South</th><th>Remarks</th></tr></thead>
      <tbody>${boundaryRows||`<tr><td colspan="6" style="text-align:center;font-style:italic;color:#888">No boundary data</td></tr>`}</tbody>
    </table>

    <div class="sec-h3">2.5 &nbsp; Hazards / Encumbrances</div>
    <table>
      <thead><tr><th>Plot No.</th><th>Hazard / Encumbrance</th><th>Status</th><th style="text-align:center">Minimum Requirement</th></tr></thead>
      <tbody>${hazardRowsFinal}</tbody>
    </table>

    <div class="sec-h3">2.6 &nbsp; Mode &amp; Date of Transfer</div>
    <table>
      <thead><tr>
        <th style="text-align:center;width:30pt">SN</th>
        <th>Plot No.</th>
        <th>Mode of Transfer</th>
        <th>Transfer Date (BS)</th>
        <th>Duration (YY-MM-DD)</th>
      </tr></thead>
      <tbody>${(s.properties||[]).map((p,pi)=>{
        const dur=transferDuration(p.transferDate);
        return `<tr>
          <td style="text-align:center">${pi+1}</td>
          <td style="white-space:nowrap">${esc(p.plotNo)}</td>
          <td>${esc(p.modeOfTransfer)||"—"}</td>
          <td style="white-space:nowrap">${esc(p.transferDate)||"—"}</td>
          <td style="white-space:nowrap">${dur||"—"}</td>
        </tr>`;
      }).join("")||`<tr><td colspan="5" style="text-align:center;font-style:italic;color:#888">No transfer data</td></tr>`}</tbody>
    </table>

    <div class="ch-head" id="ch-3">Chapter 3 &nbsp;|&nbsp; Area to be Mortgaged &amp; Considered Area</div>

    <div class="sec-h3">3.1 &nbsp; Area to be Mortgaged</div>
    <table>
      <thead><tr><th>Plot No.</th><th>Trace Sheet No.</th><th>Owner Name</th><th>Area (Lalpurja)</th></tr></thead>
      <tbody>${mortProps.map(p=>`<tr><td>${esc(p.plotNo)}</td><td>${esc(p.traceSheetNo)}</td><td>${esc(p.ownerName)}</td><td>${areaDisplay(p)}</td></tr>`).join("")||`<tr><td colspan="4" style="text-align:center;font-style:italic;color:#888">No mortgaged properties selected</td></tr>`}</tbody>
    </table>

    <div class="sec-h3">3.2 &nbsp; Deduction Declaration</div>
    <table>
      <thead><tr><th>Plot No.</th><th>Dimension</th><th>Deduction Area (sq.m)</th><th>Reason / Remarks</th></tr></thead>
      <tbody>${deductRows||`<tr><td colspan="4" style="text-align:center;font-style:italic;color:#888">No deductions</td></tr>`}</tbody>
    </table>

    <div class="sec-h3">3.3 &nbsp; Considered Area for Valuation</div>
    <table>
      <thead>
        <tr>
          <th rowspan="2" style="vertical-align:middle;text-align:center">Plot No.</th>
          <th colspan="2" style="text-align:center">Area Per Lalpurja</th>
          <th style="text-align:center">Measured</th>
          <th style="text-align:center">Deduction</th>
          <th colspan="3" style="text-align:center">Considered Area for Valuation</th>
        </tr>
        <tr>
          <th>Sq.M</th>
          <th>${nativeHdr}</th>
          <th>Sq.m</th>
          <th>Sq.M</th>
          <th>Sq.M</th>
          <th>${nativeHdr}</th>
          <th>${unitHdr}</th>
        </tr>
      </thead>
      <tbody>${consideredRows}${consideredTotalRow}</tbody>
    </table>

    <div class="ch-head" id="ch-4">Chapter 4 &nbsp;|&nbsp; Building Details</div>
    ${s.hasBuilding===false
      ? `<p style="font-style:italic;color:#888;padding:10pt">No building available on this property.</p>`
      : s.hasBuilding==="skip"
      ? `<p style="font-style:italic;color:#e67e22;padding:10pt">Building exists but valuation of building has not been carried out.</p>`
      : (s.buildings||[]).length
        ? `<div class="sec-h3">4.1 &nbsp; Building Area &amp; General Details</div>${buildingsDetailHTML}`
        : `<p style="font-style:italic;color:#888;padding:10pt">No building data entered.</p>`}

    ${(s.buildings||[]).length && s.hasBuilding===true ? `
    <div class="sec-h3">4.2 &nbsp; Technical Specifications</div>
    ${(s.buildings||[]).map((b,bi)=>{
      const bd = s.buildingDetails||{};
      const det = bd[b.id]||{};
      const floorList = b.areaTable||[];
      const _pFtIn = v => { if(!v) return 0; const m=String(v).match(/^(\d+(?:\.\d+)?)'(\d+(?:\.\d+)?)"?$/); if(m) return parseFloat(m[1])+parseFloat(m[2])/12; const n=parseFloat(v); return isNaN(n)?0:n; };
      const _fmtFt = ft => { if(!ft) return ""; const ti=Math.round(ft*12); return `${Math.floor(ti/12)}'${ti%12}"`; };
      const fhList = floorList.filter(r => r.description !== "Up to Plinth Level");
      const totalH = det.totalHeight || _fmtFt(fhList.reduce((sum,r)=>sum+_pFtIn((det.floorHeights||{})[r.id]),0));
      const fhRows = fhList.map(r=>`<tr><td>${esc(r.description)}</td><td>${(det.floorHeights||{})[r.id]||"—"} ft</td><td>${esc((det.floorHeightRemarks||{})[r.id], "")}</td></tr>`).join("");
      const sr = (lbl, val) => `<tr><td style="background:${T.info};font-weight:bold;width:42%;font-size:9.5pt;text-transform:uppercase;color:${T.primary}">${lbl}</td><td>${esc(val)}</td></tr>`;
      const gh = (title) => `<tr><td colspan="2" style="background:${T.lighter};color:${T.primary};font-weight:bold;text-transform:uppercase;font-size:9pt;padding:3pt 6pt;border-left:3pt solid ${T.primary}">${title}</td></tr>`;
      return `<p class="sub-head">Building ${bi+1}${b.plotNo?" — Plot No. "+esc(b.plotNo):""}</p>
      ${floorList.length?`<p style="font-weight:bold;margin:3pt 0 2pt;font-size:9.5pt">Floor Heights:</p>
      <table><thead><tr><th>Floor</th><th>Height (ft)</th><th>Remarks</th></tr></thead>
      <tbody>${fhRows}<tr class="total-row"><td><strong>Total Height</strong></td><td><strong>${totalH||"—"} ft</strong></td><td></td></tr></tbody></table>`:""}
      <table class="info-table" style="margin-top:3pt">
        ${gh("Structural Members")}${sr("Min. Column Size",det.minColumn)}${sr("Min. Beam Size",det.minBeam)}${sr("DPC / Tie Beam",det.dpcTieBeam)}${sr("Slab Thickness",det.slabThickness)}
        ${gh("Building Information")}${sr("Building Permit",det.buildingPermit)}${sr("NBC Compliance",det.nbcCompliance)}${sr("Setback",det.setback)}${sr("Compound / Boundary Wall",det.compoundWall)}${sr("Parking Facility",det.parking)}
        ${gh("Walls, Doors &amp; Windows")}${sr("External Wall",det.externalWall)}${sr("Internal Wall",det.internalWall)}${sr("Door Material",det.doorMaterial)}${sr("Window Material",det.windowMaterial)}${sr("Staircase",det.staircase)}${sr("Roof",det.roof)}
        ${gh("Finishing &amp; Fixtures")}${sr("External Finishing",det.externalFinishing)}${sr("Internal Finishing",det.internalFinishing)}${sr("Ceiling",det.ceiling)}${sr("Flooring",det.flooring)}${sr("Verandah",det.verandah)}${sr("Kitchen / Dining",det.kitchen)}${sr("Bathroom / Toilet",det.bathroom)}
        ${gh("Services &amp; Utilities")}${sr("Sanitary &amp; Plumbing",det.sanitary)}${sr("Electricity System",det.electricitySystem)}${sr("UG Water Tank",det.ugWaterTank)}${sr("OH Water Tank",det.ohWaterTank)}${sr("Solar Panel",det.solarPanel)}${sr("Water Supply",det.waterSupply)}${sr("Deep Boring",det.deepBoring)}${sr("Sewerage System",det.sewerage)}${sr("Lift / Elevator",det.lift)}${sr("Generator / Backup Power",det.generator)}
        ${gh("Condition &amp; Remarks")}${sr("Defects",det.defects)}${sr("Repair &amp; Maintenance",det.repairMaintenance)}${sr("Comments",det.comments)}
      </table>`;
    }).join('<div class="dashed-sep"></div>')}` : ""}
    <div class="ch-head page-break" id="ch-5">Chapter 5 &nbsp;|&nbsp; Valuation of Property</div>

    <div class="sec-h3" id="toc-s7">5.1 &nbsp; Valuation of Land</div>
    <p style="font-weight:bold;font-size:9.5pt;margin:4pt 0 2pt">5.1A. Land Rates per ${unitHdr}</p>
    <table>
      <thead><tr><th>Plot No. / Zone</th><th>Area (sq.m)</th><th>Area (${unitHdr})</th><th style="color:#1565c0">Govt. Rate (NPR/${unitHdr})</th><th>Commercial Rate (NPR/${unitHdr})</th><th>FMV Rate (NPR/${unitHdr})</th></tr></thead>
      <tbody>${landRateRows||`<tr><td colspan="6" style="text-align:center;font-style:italic;color:#888">No data</td></tr>`}
      </tbody>
    </table>
    <p style="font-weight:bold;font-size:9.5pt;margin:8pt 0 2pt">5.1B. Value of Property</p>
    <table>
      <thead><tr><th>Plot No. / Zone</th><th>Area (${unitHdr})</th><th style="color:#1565c0">Govt. Value (NPR)</th><th>Commercial Value (NPR)</th><th>FMV Value (NPR)</th><th>Distress Value (${Math.round(_distressMult2*100)}% of FMV)</th></tr></thead>
      <tbody>${landValueRows||`<tr><td colspan="6" style="text-align:center;font-style:italic;color:#888">No data</td></tr>`}
        <tr class="total-row"><td colspan="2"><strong>TOTAL LAND VALUE (Rounded)</strong></td>
          <td style="color:#1565c0"><strong>NPR ${totalLandGov.toLocaleString("en-NP")}</strong></td>
          <td><strong>NPR ${totalLandComm.toLocaleString("en-NP")}</strong></td>
          <td><strong>NPR ${totalLandFMV2.toLocaleString("en-NP")}</strong></td>
          <td><strong>NPR ${(Math.floor(totalLandFMV2*_distressMult2/100)*100).toLocaleString("en-NP")}</strong></td></tr>
      </tbody>
    </table>

    ${(s.buildings||[]).length && s.hasBuilding===true ? `
    <div class="sec-h3" id="toc-s8">5.2 &nbsp; Valuation of Building</div>
    <table class="info-table">
      ${(s.buildings||[]).map((b,i)=>{
        const v=bv[b.id]||{};
        const floorCalcs=(b.areaTable||[]).map(row=>({area:parseFloat(row.areaActual)||0,rate:parseFloat((v.floorRates||{})[row.id])||0}));
        const baseCost=floorCalcs.reduce((s,f)=>s+f.area*f.rate,0);
        const sanCost=baseCost*(parseFloat(v.sanitaryPct)||0)/100;
        const elecCost=baseCost*(parseFloat(v.electricalPct)||0)/100;
        const finCost=baseCost*(parseFloat(v.finishingPct)||0)/100;
        const totalWithFix=baseCost+sanCost+elecCost+finCost;
        const age=parseFloat(b.ageOfBuilding)||0,depRate=parseFloat(v.depreciationRate)||2.25;
        const totalDepPct=Math.min(100,age*depRate),totalDep=totalWithFix*totalDepPct/100;
        const actual=Math.max(0,totalWithFix-totalDep),rounded=Math.floor(actual/100)*100;
        return `<tr><td>Building ${i+1}${b.plotNo?" — Plot No. "+esc(b.plotNo):""}</td><td>NPR ${rounded.toLocaleString("en-NP")}</td><td>Depreciation ${totalDepPct.toFixed(1)}%</td><td>${age} yrs — ${depRate}%/yr</td></tr>`;
      }).join("")}
      <tr class="total-row"><td colspan="3"><strong>TOTAL BUILDING VALUE</strong></td><td><strong>NPR ${totalBuildingVal.toLocaleString("en-NP")}</strong></td></tr>
    </table>` : ""}

    <div class="ch-head" id="ch-6">Chapter 6 &nbsp;|&nbsp; Summary of Valuation</div>
    <div class="val-summary no-break">
      <div class="val-summary-head">Summary of Property Valuation</div>

      <div style="padding:5pt 10pt 3pt;font-weight:bold;font-size:10pt;color:${T.primary};text-transform:uppercase;letter-spacing:0.5px;border-bottom:0.5pt solid #ddd">A. Commercial Value</div>
      <div style="padding:3pt 10pt 2pt">
        <table style="margin:0;font-size:10.5pt">
          <tbody>
            <tr><td style="border:none;padding:2pt 0">1. Land Value</td><td style="border:none;text-align:right;width:45%">NPR ${totalLandComm.toLocaleString("en-NP")}</td></tr>
            ${(s.buildings||[]).length&&s.hasBuilding===true?`<tr><td style="border:none;padding:2pt 0">2. Building Value</td><td style="border:none;text-align:right">NPR ${totalBuildingVal.toLocaleString("en-NP")}</td></tr>`:""}
            <tr style="border-top:1pt solid ${T.primary}"><td style="border:none;padding:3pt 0;font-weight:bold">Total Commercial Value (A)</td><td style="border:none;text-align:right;font-weight:bold;font-size:11pt;color:${T.primary}">NPR ${finalComm.toLocaleString("en-NP")}</td></tr>
          </tbody>
        </table>
        <div class="in-words">Nepalese Rupees ${toWords(finalComm)} Only &nbsp;(NPR ${finalComm.toLocaleString("en-NP")}/-)</div>
      </div>

      <div style="padding:5pt 10pt 3pt;font-weight:bold;font-size:10pt;color:#8b4513;text-transform:uppercase;letter-spacing:0.5px;border-bottom:0.5pt solid #ddd;border-top:1pt solid #eee">B. Fair Market Value (FMV)</div>
      <div style="padding:3pt 10pt 2pt">
        <table style="margin:0;font-size:10.5pt">
          <tbody>
            <tr><td style="border:none;padding:2pt 0">1. Land Value</td><td style="border:none;text-align:right;width:45%">NPR ${totalLandFMV2.toLocaleString("en-NP")}</td></tr>
            ${(s.buildings||[]).length&&s.hasBuilding===true?`<tr><td style="border:none;padding:2pt 0">2. Building Value</td><td style="border:none;text-align:right">NPR ${totalBuildingVal.toLocaleString("en-NP")}</td></tr>`:""}
            <tr style="border-top:1pt solid #8b4513"><td style="border:none;padding:3pt 0;font-weight:bold">Total Fair Market Value (B)</td><td style="border:none;text-align:right;font-weight:bold;font-size:11pt;color:#8b4513">NPR ${finalFMV.toLocaleString("en-NP")}</td></tr>
          </tbody>
        </table>
        <div class="in-words" style="border-color:#8b4513">Nepalese Rupees ${toWords(finalFMV)} Only &nbsp;(NPR ${finalFMV.toLocaleString("en-NP")}/-)</div>
      </div>

      <div style="padding:5pt 10pt 3pt;font-weight:bold;font-size:10pt;color:#c0392b;text-transform:uppercase;letter-spacing:0.5px;border-bottom:0.5pt solid #ddd;border-top:1pt solid #eee">C. Distress Value (${Math.round(distressMult2*100)}% of FMV)</div>
      <div style="padding:3pt 10pt 2pt">
        <table style="margin:0;font-size:10.5pt">
          <tbody>
            <tr><td style="border:none;padding:2pt 0">${Math.round(distressMult2*100)}% of Fair Market Value</td><td style="border:none;text-align:right;width:45%;font-weight:bold;font-size:11pt;color:#c0392b">NPR ${distress.toLocaleString("en-NP")}</td></tr>
          </tbody>
        </table>
        <div class="in-words" style="border-color:#c0392b">Nepalese Rupees ${toWords(distress)} Only &nbsp;(NPR ${distress.toLocaleString("en-NP")}/-)</div>
      </div>

      ${finalGovFinal>0?`
      <div style="padding:5pt 10pt 3pt;font-weight:bold;font-size:10pt;color:#1565c0;text-transform:uppercase;letter-spacing:0.5px;border-bottom:0.5pt solid #ddd;border-top:1pt solid #eee">D. Government Value of Land</div>
      <div style="padding:3pt 10pt 2pt">
        <table style="margin:0;font-size:10.5pt">
          <tbody>
            <tr><td style="border:none;padding:2pt 0">Total Government Value</td><td style="border:none;text-align:right;width:45%;font-weight:bold;font-size:11pt;color:#1565c0">NPR ${finalGovFinal.toLocaleString("en-NP")}</td></tr>
          </tbody>
        </table>
        <div class="in-words" style="border-color:#1565c0;color:#1565c0">Nepalese Rupees ${toWords(finalGovFinal)} Only &nbsp;(NPR ${finalGovFinal.toLocaleString("en-NP")}/-)</div>
      </div>`:""}

      <div style="display:grid;grid-template-columns:${finalGovFinal>0?"1fr 1fr 1fr 1fr":"1fr 1fr 1fr"};gap:0;border-top:2pt solid ${T.primary}">
        <div class="val-row a" style="flex-direction:column;align-items:flex-start"><div class="vlbl">A. Commercial</div><div class="vamt">NPR ${finalComm.toLocaleString("en-NP")}</div></div>
        <div class="val-row b" style="flex-direction:column;align-items:flex-start;border-left:1pt solid #ddd;border-right:1pt solid #ddd"><div class="vlbl">B. Fair Market</div><div class="vamt">NPR ${finalFMV.toLocaleString("en-NP")}</div></div>
        <div class="val-row c" style="flex-direction:column;align-items:flex-start"><div class="vlbl">C. Distress (${Math.round(distressMult2*100)}%)</div><div class="vamt">NPR ${distress.toLocaleString("en-NP")}</div></div>
        ${finalGovFinal>0?`<div class="val-row" style="flex-direction:column;align-items:flex-start;background:#e8f0fe;border-left:1pt solid #ddd"><div class="vlbl" style="color:#1565c0">D. Govt. Value</div><div class="vamt" style="color:#1565c0">NPR ${finalGovFinal.toLocaleString("en-NP")}</div></div>`:""}
      </div>
    </div>

    <div class="ch-head" id="ch-7">Chapter 7 &nbsp;|&nbsp; Remarks, Opinion &amp; Declarations</div>

    <div class="sec-h3" style="margin-top:1pt">7.1 &nbsp; Remarks and Limiting Conditions</div>
    <div class="remarks-box" style="padding:3pt 8pt;font-size:10pt;line-height:1.25;white-space:normal"><ol type="a" style="margin:0;padding-left:16pt"><li style="margin-bottom:1pt">The opinions of the value are based on the facts and assumptions identified in this report.</li><li style="margin-bottom:1pt">To the best of our knowledge, all matters of factual nature discussed in this report are true and correct.</li><li style="margin-bottom:0">In our opinion this property may be taken as mortgage for the amount recommended in certification.</li></ol></div>

    <div class="sec-h3" style="margin-top:1pt">7.2 &nbsp; Opinion</div>
    <div class="remarks-box" style="padding:3pt 8pt;font-size:10pt;line-height:1.25;text-align:justify;white-space:normal">In our opinion this property may be taken as mortgage for the FMV amount recommended in the valuation certificate, however, all the remarks made above shall be taken into consideration and all legal documents shall be scrutinized by legal expert.</div>

    <div class="sec-h3" style="margin-top:1pt">7.3 &nbsp; Declaration</div>
    <div class="remarks-box" style="padding:3pt 8pt;font-size:10pt;line-height:1.25;text-align:justify;white-space:normal"><p style="margin:0 0 2pt">This valuation was conducted for the purpose of establishing Fair Market and Distress Values of the said property for Client and Bank for mortgaging these properties. It is not to be used for any other purpose, and no part of this report is to be disseminated to the public or third parties.</p><p style="margin:0 0 2pt">We certify that our firm is fully authorized to carry out the valuation work under the prevalent laws and we are fully equipped and competent to carry out the assignment and have the necessary qualifications, skills and experience required for the same.</p><p style="margin:0 0 2pt">We also certify that no individual in our firm has any financial interest in the said property.</p><p style="margin:0 0 2pt">To the best of our knowledge, all matters of a factual nature discussed in this report are true and correct. No important factors have been intentionally overlooked or withheld.</p><p style="margin:0 0 2pt">We have physically inspected, verified and measured the properties in the presence of the Client/Representative of the Client.</p><p style="margin:0">We transformed all details and information furnished by the Client/Owner for above property and s/he confirmed all details is true in my presence.</p></div>

    <div class="sec-h3" style="margin-top:1pt">7.4 &nbsp; Declaration by the Client</div>
    <div class="remarks-box" style="padding:3pt 8pt;font-size:10pt;line-height:1.25;text-align:justify;white-space:normal"><p style="margin:0 0 6pt">I/we have provided all the documents attached in this valuation report and all the details and information furnished above are true and correct. I take full responsibility in case of any liability occur regarding these documents. We, Owners/clients, hereby confirm that all the details and information furnished above are correct and represent the actual statements.</p><div style="display:flex;flex-wrap:wrap;gap:10pt;margin-top:3pt">${(s.clients||[]).map((cl,ci) => { const name=(cl.showPerson&&cl.person?.name)?fullName(cl.person):(cl.showCompany&&cl.company?.name)?cl.company.name:`Client ${ci+1}`; const contact=(cl.showPerson&&cl.person?.contact)?cl.person.contact:(cl.showCompany&&cl.company?.contact)?cl.company.contact:''; return `<div style="font-family:'Times New Roman',Times,serif;font-size:10pt;line-height:1.4;min-width:150pt"><div style="border-bottom:1pt dotted #555;min-width:180pt;margin-bottom:2pt">&nbsp;</div><div style="font-weight:bold">${esc(name,'Name of Client')}</div><div style="font-size:9pt;color:#444">${esc(contact,'Phone Number')}</div></div>`; }).join('')}</div></div>

    <div class="sec-h3" style="margin-top:1pt">7.5 &nbsp; Certification</div>
    <div class="remarks-box" style="padding:3pt 8pt;font-size:10pt;line-height:1.25;text-align:justify;white-space:normal">I/We hereby certify that Valuation of the Properties as detailed in this report has been carried out by me/us in strict Compliance with Valuation Guidelines of <strong>${esc(s.bank,"[Bank Name]")}</strong>. The said property is an acceptable security to bank in all respects.</div>

    <div class="sec-h3" style="margin-top:1pt">7.6 &nbsp; Conclusions</div>
    <div class="remarks-box" style="padding:3pt 8pt;font-size:10pt;line-height:1.25;text-align:justify;white-space:normal;margin-bottom:0"><p style="margin:0 0 2pt">This valuation was conducted for the purpose of establishing Fair Market and Distress Values of the said property for Client and Bank for mortgaging these properties. It is not to be used for any other purpose, and no part of this report is to be disseminated to the public or third parties.</p><p style="margin:0 0 2pt">We certify that our firm is fully authorized to carry out the valuation work under the prevalent laws and we are fully equipped and competent to carry out the assignment and have the necessary qualifications, skills and experience required for the same.</p><p style="margin:0 0 2pt">We also certify that no individual in our firm has any financial interest in the said property.</p><p style="margin:0 0 2pt">To the best of our knowledge, all matters of a factual nature discussed in this report are true and correct. No important factors have been intentionally overlooked or withheld.</p><p style="margin:0 0 2pt">We have physically inspected, verified and measured the properties in the presence of the Client/Representative of the Client.</p><p style="margin:0">We transformed all details and information furnished by the Client/Owner for above property and s/he confirmed all details is true in my presence.</p></div>

    ${(()=>{
      // Bill page removed from final report — use the standalone "Bill" report type instead
      return "";
      const fieldFee   = 0; // eslint-disable-line no-unreachable
      const transport  = 0;
      const valFee     = 0;
      const subTotal   = 0;
      const vatAmt     = 0;
      const grandTotal = 0;

      // Bill number: use stored or generate from report date
      const rawDate    = s.reportDate || new Date().toLocaleDateString("en-NP",{year:"numeric",month:"2-digit",day:"2-digit"});
      const prefix     = esc(s.billPrefix || "BILL");
      const billNumber = s.billNo ? esc(s.billNo) : `${prefix}/${rawDate.replace(/\//g,"-")}`;

      // Client info for bill
      const billClient = (s.clients||[])[0] || {};
      const clientName = (billClient.showPerson && billClient.person?.name)
        ? esc(fullName(billClient.person))
        : (billClient.showCompany && billClient.company?.name)
          ? esc(billClient.company.name) : "—";
      const clientAddr = (billClient.showPerson && billClient.person?.address)
        ? esc(billClient.person.address)
        : (billClient.showCompany && billClient.company?.address)
          ? esc(billClient.company.address) : "";
      const clientContact = (billClient.showPerson && billClient.person?.contact)
        ? esc(billClient.person.contact)
        : (billClient.showCompany && billClient.company?.contact)
          ? esc(billClient.company.contact) : "";

      // Property summary for bill
      const mortProps2 = (s.properties||[]).filter(p=>(s.mortgagedIds||[]).includes(p.id));
      const plotList   = mortProps2.map(p=>esc(p.plotNo||"—")).join(", ") || "—";
      const propLoc    = mortProps2[0] ? esc(mortProps2[0].district||mortProps2[0].vdc||"") : "";

      const feeScheduleRows = [
        ["a","Up to 25,00,000",       "Rs. 7,500.00",                         "7,500.00"],
        ["b","Up to 50,00,000",       "Rs. 7,500.00 + (Diff b-a)×0.20%",     "12,500.00"],
        ["c","Up to 1,00,00,000",     "Rs. 12,500.00 + (Diff c-b)×0.15%",    "20,000.00"],
        ["d","Up to 5,00,00,000",     "Rs. 20,000.00 + (Diff d-c)×0.10%",    "60,000.00"],
        ["e","Up to 10,00,00,000",    "Rs. 60,000.00 + (Diff e-d)×0.08%",   "1,00,000.00"],
        ["f","Up to 20,00,00,000",    "Rs. 1,00,000.00 + (Diff f-e)×0.05%", "1,50,000.00"],
        ["g","Up to 50,00,00,000",    "Rs. 1,50,000.00 + (Diff g-f)×0.03%", "2,40,000.00"],
        ["h","Up to 1,00,00,00,000",  "Rs. 2,40,000.00 + (Diff h-g)×0.02%", "3,40,000.00"],
        ["i","100 Cr above",          "Rs. 3,40,000.00 + (Diff i-h)×0.01%", "3,40,000.00+"],
      ];

      return `
    <div class="legal-doc-page" style="font-family:'Times New Roman',Times,serif;">

      <!-- ══ Bill Header ══ -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:10pt">
        <tr>
          <td style="width:70%;padding:0">
            ${s.letterheadPng
              ? `<img src="${s.letterheadPng}" style="max-height:60pt;max-width:100%;display:block;object-fit:contain;object-position:left"/>`
              : `<div style="font-size:15pt;font-weight:bold;color:${T.primary}">${esc(s.companyName,"Valuation Company")}</div>`}
            ${s.companyAddress ? `<div style="font-size:8.5pt;color:#555;margin-top:2pt">${esc(s.companyAddress)}</div>` : ""}
            ${s.companyPhone   ? `<div style="font-size:8.5pt;color:#555">Tel: ${esc(s.companyPhone)}</div>` : ""}
            ${s.companyEmail   ? `<div style="font-size:8.5pt;color:#555">Email: ${esc(s.companyEmail)}</div>` : ""}
            ${s.companyPanVat  ? `<div style="font-size:8.5pt;color:#555;font-weight:bold">PAN/VAT: ${esc(s.companyPanVat)}</div>` : ""}
          </td>
          <td style="width:30%;text-align:right;vertical-align:top;padding:0">
            <div style="background:${T.primary};color:#fff;padding:6pt 10pt;border-radius:4pt;display:inline-block;text-align:center">
              <div style="font-size:14pt;font-weight:bold;letter-spacing:1px">BILL</div>
              <div style="font-size:8pt;opacity:0.85;letter-spacing:0.5px">VALUATION CHARGES</div>
            </div>
            <div style="margin-top:5pt;font-size:9pt;color:#444;text-align:right">
              <div><strong>Bill No.:</strong> ${billNumber}</div>
              <div><strong>Date:</strong> ${esc(s.reportDate || new Date().toLocaleDateString("en-NP",{year:"numeric",month:"long",day:"numeric"}))}</div>
            </div>
          </td>
        </tr>
      </table>

      <div style="border-top:2pt solid ${T.primary};border-bottom:0.5pt solid ${T.border};margin-bottom:10pt"></div>

      <!-- ══ Bill To / Property ══ -->
      <table style="width:100%;border-collapse:collapse;margin-bottom:10pt;font-size:9.5pt">
        <tr>
          <td style="width:50%;vertical-align:top;padding-right:10pt">
            <div style="font-size:8pt;font-weight:bold;text-transform:uppercase;letter-spacing:0.8px;color:${T.primary};border-bottom:0.75pt solid ${T.border};padding-bottom:2pt;margin-bottom:4pt">Bill To</div>
            <div style="font-weight:bold;font-size:10.5pt">${clientName}</div>
            ${clientAddr    ? `<div style="color:#555;margin-top:1pt">${clientAddr}</div>` : ""}
            ${clientContact ? `<div style="color:#555">Tel: ${clientContact}</div>` : ""}
            <div style="margin-top:3pt"><strong>Bank:</strong> ${esc(s.bank,"—")}${s.branch ? ` / ${esc(s.branch)} Branch` : ""}</div>
          </td>
          <td style="width:50%;vertical-align:top;padding-left:10pt">
            <div style="font-size:8pt;font-weight:bold;text-transform:uppercase;letter-spacing:0.8px;color:${T.primary};border-bottom:0.75pt solid ${T.border};padding-bottom:2pt;margin-bottom:4pt">Property Details</div>
            <div><strong>Plot No(s):</strong> ${plotList}</div>
            ${propLoc ? `<div><strong>Location:</strong> ${propLoc}</div>` : ""}
            <div style="margin-top:2pt"><strong>Fair Market Value:</strong> <span style="color:${T.primary};font-weight:bold">NPR ${finalFMV.toLocaleString("en-NP")}</span></div>
            <div style="font-size:8.5pt;font-style:italic;color:#666">${toWords(finalFMV)} Rupees Only</div>
            <div style="margin-top:2pt"><strong>Report Date:</strong> ${esc(s.reportDate||"—")}</div>
          </td>
        </tr>
      </table>

      <!-- ══ Charge Breakdown ══ -->
      <div style="font-size:8.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:0.8px;color:${T.primary};margin-bottom:4pt">Charge Details</div>
      <table style="width:100%;border-collapse:collapse;font-size:9.5pt;margin-bottom:4pt">
        <thead>
          <tr style="background:${T.primary};color:#fff">
            <th style="padding:5pt 8pt;text-align:center;width:6%;border:0.75pt solid ${T.dark}">S.No.</th>
            <th style="padding:5pt 8pt;text-align:left;border:0.75pt solid ${T.dark}">Particulars</th>
            <th style="padding:5pt 8pt;text-align:center;width:12%;border:0.75pt solid ${T.dark}">Qty</th>
            <th style="padding:5pt 8pt;text-align:right;width:22%;border:0.75pt solid ${T.dark}">Amount (NPR)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background:${T.row}">
            <td style="padding:5pt 8pt;text-align:center;border:0.75pt solid ${T.border}">1.</td>
            <td style="padding:5pt 8pt;border:0.75pt solid ${T.border}">
              <div style="font-weight:bold">New Valuation Fee (NRB Schedule)</div>
              <div style="font-size:8.5pt;color:#555;margin-top:1pt">Property valuation for financial institution — based on FMV of NPR ${finalFMV.toLocaleString("en-NP")}</div>
            </td>
            <td style="padding:5pt 8pt;text-align:center;border:0.75pt solid ${T.border}">1</td>
            <td style="padding:5pt 8pt;text-align:right;font-weight:bold;border:0.75pt solid ${T.border}">${valFee.toLocaleString("en-NP")}</td>
          </tr>
          ${fieldFee > 0 ? `
          <tr>
            <td style="padding:5pt 8pt;text-align:center;border:0.75pt solid ${T.border}">2.</td>
            <td style="padding:5pt 8pt;border:0.75pt solid ${T.border}">
              <div style="font-weight:bold">Field Charge</div>
              <div style="font-size:8.5pt;color:#555;margin-top:1pt">Site visit and field inspection charge</div>
            </td>
            <td style="padding:5pt 8pt;text-align:center;border:0.75pt solid ${T.border}">1</td>
            <td style="padding:5pt 8pt;text-align:right;border:0.75pt solid ${T.border}">${fieldFee.toLocaleString("en-NP")}</td>
          </tr>` : ""}
          ${transport > 0 ? `
          <tr style="background:${T.info}">
            <td style="padding:5pt 8pt;text-align:center;border:0.75pt solid ${T.border}">${fieldFee > 0 ? "3" : "2"}.</td>
            <td style="padding:5pt 8pt;border:0.75pt solid ${T.border}">
              <div style="font-weight:bold">Transportation Charge</div>
              <div style="font-size:8.5pt;color:#555;margin-top:1pt">Travel and transportation expenses</div>
            </td>
            <td style="padding:5pt 8pt;text-align:center;border:0.75pt solid ${T.border}">1</td>
            <td style="padding:5pt 8pt;text-align:right;border:0.75pt solid ${T.border}">${transport.toLocaleString("en-NP")}</td>
          </tr>` : ""}
          <!-- Sub-total -->
          <tr style="background:#f8f9fa">
            <td colspan="3" style="padding:5pt 8pt;text-align:right;border:0.75pt solid ${T.border};font-weight:bold">Sub-Total</td>
            <td style="padding:5pt 8pt;text-align:right;border:0.75pt solid ${T.border};font-weight:bold">${subTotal.toLocaleString("en-NP")}</td>
          </tr>
          ${vatAmt > 0 ? `
          <tr>
            <td colspan="3" style="padding:5pt 8pt;text-align:right;border:0.75pt solid ${T.border}">VAT @ 13%</td>
            <td style="padding:5pt 8pt;text-align:right;border:0.75pt solid ${T.border}">${vatAmt.toLocaleString("en-NP")}</td>
          </tr>` : ""}
          <!-- Grand Total -->
          <tr style="background:${T.total}">
            <td colspan="3" style="padding:7pt 8pt;text-align:right;border:0.75pt solid ${T.border};font-weight:bold;font-size:11pt;color:${T.primary}">GRAND TOTAL</td>
            <td style="padding:7pt 8pt;text-align:right;border:0.75pt solid ${T.border};font-weight:bold;font-size:12pt;color:${T.primary}">${grandTotal.toLocaleString("en-NP")}</td>
          </tr>
        </tbody>
      </table>

      <!-- In Words -->
      <div style="background:${T.lighter};border:0.75pt solid ${T.border};border-radius:4pt;padding:6pt 10pt;font-size:9.5pt;margin-bottom:10pt">
        <strong>Amount in Words:</strong> <em>Nepalese Rupees ${toWords(grandTotal)} Only</em> &nbsp;(NPR ${grandTotal.toLocaleString("en-NP")}${vatAmt > 0 ? " including VAT" : ""}/-${s.billRemarks ? " — " + esc(s.billRemarks) : ""})
      </div>

      <!-- Bank details -->
      ${s.companyBankAccount ? `
      <div style="border:0.75pt solid ${T.border};border-radius:4pt;padding:7pt 10pt;font-size:9pt;margin-bottom:10pt;background:#fafbfd">
        <div style="font-size:8pt;font-weight:bold;color:${T.primary};text-transform:uppercase;margin-bottom:3pt">Payment Details</div>
        <div style="white-space:pre-line;color:#333;line-height:1.6">${esc(s.companyBankAccount)}</div>
      </div>` : ""}

      <!-- NRB Fee Schedule reference -->
      <div style="margin-top:8pt">
        <div style="font-size:8.5pt;font-weight:bold;color:${T.primary};text-transform:uppercase;letter-spacing:0.5px;border-bottom:0.75pt solid ${T.border};padding-bottom:2pt;margin-bottom:4pt">
          Reference: New Valuation Fee Schedule for Financial Institutions
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:8pt">
          <thead>
            <tr style="background:${T.lighter}">
              <th style="padding:3pt 5pt;border:0.5pt solid ${T.border};width:5%;text-align:center;color:${T.primary}">S.No.</th>
              <th style="padding:3pt 5pt;border:0.5pt solid ${T.border};text-align:left;color:${T.primary}">Upto</th>
              <th style="padding:3pt 5pt;border:0.5pt solid ${T.border};text-align:left;color:${T.primary}">Fee Payable</th>
              <th style="padding:3pt 5pt;border:0.5pt solid ${T.border};text-align:right;color:${T.primary}">Amount (NPR)</th>
            </tr>
          </thead>
          <tbody>
            ${feeScheduleRows.map(([sno,u,f,a],i) => `
            <tr style="background:${i%2===0?'#fff':T.info}${finalFMV>0&&(
              (i===0&&finalFMV<=2500000)||(i===1&&finalFMV>2500000&&finalFMV<=5000000)||
              (i===2&&finalFMV>5000000&&finalFMV<=10000000)||(i===3&&finalFMV>10000000&&finalFMV<=50000000)||
              (i===4&&finalFMV>50000000&&finalFMV<=100000000)||(i===5&&finalFMV>100000000&&finalFMV<=200000000)||
              (i===6&&finalFMV>200000000&&finalFMV<=500000000)||(i===7&&finalFMV>500000000&&finalFMV<=1000000000)||
              (i===8&&finalFMV>1000000000)
            )?`;font-weight:bold;background:${T.lighter}`:''}">
              <td style="padding:2.5pt 5pt;border:0.5pt solid ${T.border};text-align:center">${sno}.</td>
              <td style="padding:2.5pt 5pt;border:0.5pt solid ${T.border}">${u}</td>
              <td style="padding:2.5pt 5pt;border:0.5pt solid ${T.border}">${f}</td>
              <td style="padding:2.5pt 5pt;border:0.5pt solid ${T.border};text-align:right">${a}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>

      <!-- Signature row -->
      <div style="display:flex;justify-content:space-between;margin-top:20pt;align-items:flex-end">
        <div style="font-size:9pt;color:#555;max-width:55%">
          <div style="font-style:italic;margin-bottom:3pt">This is a computer-generated bill.</div>
          ${s.billRemarks ? `<div style="color:#333"><strong>Remarks:</strong> ${esc(s.billRemarks)}</div>` : ""}
        </div>
        <div style="text-align:center;font-size:9.5pt">
          <div style="border-top:0.75pt solid #000;min-width:150pt;padding-top:3pt;margin-top:30pt">
            <div style="font-weight:bold">${esc(s.companyName||vi.company,"Valuation Company")}</div>
            ${vi.name ? `<div style="font-size:9pt">${esc(vi.name)}</div>` : ""}
            ${vi.licenseNo ? `<div style="font-size:8.5pt;color:#555">NEC Reg. No.: ${esc(vi.licenseNo)}</div>` : ""}
            <div style="font-size:8.5pt;color:#555;font-style:italic">Authorised Signatory</div>
          </div>
        </div>
      </div>
    </div>`;
    })()}

    <div style="margin-top:12pt;display:flex;justify-content:flex-end">
      <div style="text-align:center;font-family:'Times New Roman',Times,serif;font-size:10.5pt;line-height:1.5">
        <div style="border-top:1pt solid #000;padding-top:4pt;min-width:180pt">
          <div style="font-weight:bold">For ${esc(vi.company, "Neo-Civic Consulting (P). Ltd")}</div>
          <div style="margin-top:2pt">${esc(vi.name, "Er. Saakar Rimal")}</div>
          <div>NEC Registration No.: ${esc(vi.licenseNo, '11518 Civil "A"')}</div>
          ${vi.phone?`<div style="font-size:10pt">Tel. ${esc(vi.phone)}</div>`:""}
          ${vi.email?`<div style="font-size:10pt">Email: ${esc(vi.email)}</div>`:""}
        </div>
      </div>
    </div>

    <p class="disclaimer">Final Report &nbsp;|&nbsp; Generated: ${new Date().toLocaleDateString("en-NP",{year:"numeric",month:"long",day:"numeric"})} &nbsp;|&nbsp; ${esc(suggestedFilename, "")} &nbsp;|&nbsp; Prepared for the exclusive use of ${esc(s.bank, "the Bank")}.</p>
  </div>
  <!-- SITE PLAN PAGES (LANDSCAPE) -->
  ${final_sitePlanPages}
  <!-- PHOTO PAGES (LANDSCAPE) -->
  ${final_photoPages}

  <!-- LEGAL DOCUMENTS SECTION -->
  ${(()=>{
    const docs = (s.legalDocs||[]).filter(d => d.dataUrl && d.category);
    if(!docs.length) return '';

    const CAT_LABELS = {
      govt_rate:'Government Rate', lorc:'LORC', citizenship:'Citizenship',
      trace:'Trace', charkilla:'Charkilla', tiro_receipt:'Tiro Receipt',
      company_doc:'Company Document', building_approval:'Building Approval',
      completion_cert:'Building Completion Certificate',
      building_drawing:'Building Drawing', other:'Other Documents',
    };
    const catLabel = (key) => CAT_LABELS[key] || esc(key) || '—';

    const separator = `<div class="legal-doc-sep" id="toc-s12">
      <div style="text-align:center;font-family:'Times New Roman',Times,serif;">
        <div style="width:80mm;height:3pt;background:${T.primary};margin:0 auto 12pt;"></div>
        <div style="font-size:22pt;font-weight:bold;text-transform:uppercase;letter-spacing:4px;color:${T.primary};">
          Legal Documents
        </div>
        <div style="font-size:11pt;color:#666;margin-top:6pt;letter-spacing:1px;">
          ${docs.length} document${docs.length !== 1 ? "s" : ""}
        </div>
        <div style="width:80mm;height:3pt;background:${T.primary};margin:12pt auto 0;"></div>
      </div>
    </div>`;

    const grouped = {};
    docs.forEach((doc,i) => {
      const k = doc.category || 'other';
      if (!grouped[k]) grouped[k] = [];
      grouped[k].push({...doc, _idx: i+1});
    });
    const indexRows = Object.entries(grouped).map(([key, gdocs]) =>
      gdocs.map((doc, gi) => `
        <tr style="background:${gi%2===0?'#fff':'#f9f6f3'}">
          <td style="padding:5pt 8pt;border:0.5pt solid #ccc;text-align:center;color:${T.primary};font-weight:bold;width:6%">${doc._idx}</td>
          <td style="padding:5pt 8pt;border:0.5pt solid #ccc;font-weight:bold;color:${T.primary}">${catLabel(key)}</td>
        </tr>`).join('')
    ).join('');

    const indexPage = `<div class="legal-doc-page">
      <div style="font-size:14pt;font-weight:bold;text-transform:uppercase;letter-spacing:2px;color:${T.primary};border-bottom:2pt solid ${T.primary};padding-bottom:5pt;margin-bottom:10pt;font-family:'Times New Roman',Times,serif;">
        Legal Documents — Index
      </div>
      <table style="width:100%;border-collapse:collapse;font-size:9.5pt;">
        <thead><tr>
          <th style="background:${T.lighter};color:${T.primary};padding:3pt 5pt;text-align:center;width:6%;border:0.75pt solid ${T.border}">No.</th>
          <th style="background:${T.lighter};color:${T.primary};padding:3pt 5pt;text-align:left;border:0.75pt solid ${T.border}">Category</th>
        </tr></thead>
        <tbody>${indexRows}</tbody>
      </table>
    </div>`;

    const docImagePages = docs.map((doc,i)=>{
      const label = `${i+1}. ${catLabel(doc.category)}`;
      let body;
      if (doc.dataUrl.startsWith('data:image')) {
        const rot = doc.rotation || 0;
        const is90or270 = rot === 90 || rot === 270;
        // For 90/270 rotations we swap the container dimensions so the image fits within the page width
        const imgStyle = rot === 0
          ? `max-width:100%;max-height:170mm;object-fit:contain;display:block;margin:0 auto;`
          : is90or270
            ? `max-height:100%;max-width:170mm;object-fit:contain;display:block;margin:0 auto;transform:rotate(${rot}deg);transform-origin:center center;`
            : `max-width:100%;max-height:170mm;object-fit:contain;display:block;margin:0 auto;transform:rotate(${rot}deg);transform-origin:center center;`;
        const containerStyle = is90or270
          ? `text-align:center;border:0.75pt solid #ccc;background:#fafafa;padding:6pt;overflow:hidden;display:flex;align-items:center;justify-content:center;min-height:120mm;`
          : `text-align:center;border:0.75pt solid #ccc;background:#fafafa;padding:6pt;`;
        body = `<div style="${containerStyle}">
          <img src="${doc.dataUrl}" style="${imgStyle}"/>
        </div>`;
      } else if (doc.dataUrl.startsWith('data:application/pdf')) {
        body = `<div style="width:100%;height:170mm;border:0.75pt solid #ccc;overflow:hidden;">
          <object data="${doc.dataUrl}" type="application/pdf"
            style="width:100%;height:100%;display:block;">
            <iframe src="${doc.dataUrl}"
              style="width:100%;height:100%;border:none;display:block;">
              <p style="padding:20pt;text-align:center;color:#888;font-style:italic;">
                PDF: ${esc(doc.name, 'Document')} — open in PDF viewer to view
              </p>
            </iframe>
          </object>
        </div>`;
      } else {
        body = `<div style="border:0.75pt solid #ccc;padding:30pt;text-align:center;color:#888;font-style:italic;font-family:'Times New Roman',Times,serif;">
          Document: ${esc(doc.name, 'File')}
        </div>`;
      }
      return `
      <div class="legal-doc-page">
        <div style="font-family:'Times New Roman',Times,serif;margin-bottom:8pt;">
          <div style="background:${T.lighter};color:${T.primary};padding:5pt 10pt;font-weight:bold;font-size:10.5pt;border-left:3pt solid ${T.primary}">
            ${label}
          </div>
        </div>
        ${body}
      </div>`;
    }).join('');

    return separator + indexPage + docImagePages;
  })()}

  ${purifyScript}${autoScript}${tocScript}</body></html>`;
}

function buildBillOnlyHTML(s, suggestedFilename, autoPrint) {
  const T = buildTheme(s.reportColorTheme);

  const vi = (s.valuatorInfo||{});
  const mortProps = (s.properties||[]).filter(p=>(s.mortgagedIds||[]).includes(p.id));
  const plotList  = mortProps.map(p=>esc(p.plotNo||"—")).join(", ") || "—";
  const traceList = mortProps.map(p=>esc(p.traceSheetNo||"")).filter(Boolean).join(", ");
  const propLoc   = mortProps[0] ? esc(mortProps[0].district||mortProps[0].vdc||"") : "";

  // Fee calc
  const finalFMV   = Math.floor((parseFloat(s.finalFMV) || 0) / 100) * 100;
  const fieldFee   = parseFloat(s.fieldChargeAmount)    || 0;
  const transport  = parseFloat(s.transportationCharge) || 0;
  const fieldVisit = fieldFee + transport;
  const deductFieldVisit = s.deductFieldVisit !== false; // default true
  const billingSystemLabel = s.billingSystemLabel || "Nepal Valuators Association Schedule";
  // Use company-configured tiers if provided via state, else fall back to built-in schedule
  // Also produce a human-readable breakdown of how the fee was calculated
  const { valFee, valFeeBreakdown } = (() => {
    const fmt = (n) => Math.round(n).toLocaleString("en-NP");
    const tiers = s.feeTiers;
    if (!tiers || !Array.isArray(tiers) || tiers.length === 0) {
      // Built-in NVA schedule — show classic bracket table breakdown
      const fee = calcValFee(finalFMV);
      // Find which bracket applies
      const nvaSlabs = [
        [0,        2500000,   7500,      0],
        [2500000,  5000000,   7500,      0.002],
        [5000000,  10000000,  12500,     0.0015],
        [10000000, 50000000,  20000,     0.001],
        [50000000, 100000000, 60000,     0.0008],
        [100000000,200000000, 100000,    0.0005],
        [200000000,500000000, 150000,    0.0003],
        [500000000,1000000000,240000,    0.0002],
        [1000000000,Infinity, 340000,    0.0001],
      ];
      const fmv = finalFMV;
      const steps = [];
      if (fmv <= 0) { steps.push("FMV is 0 — no fee applicable."); }
      else {
        const slab = nvaSlabs.find(([lo,hi]) => fmv > lo && fmv <= hi) || nvaSlabs[nvaSlabs.length-1];
        const [lo,hi,base,rate] = slab;
        const diff = fmv - lo;
        const inc  = Math.round(diff * rate);
        steps.push(`FMV = NPR ${fmt(fmv)}`);
        if (fmv <= 2500000) {
          steps.push(`Slab: Up to NPR ${fmt(lo === 0 ? 2500000 : hi)}`);
          steps.push(`Fee = NPR ${fmt(base)} (flat fee for this slab)`);
        } else {
          steps.push(`Slab: NPR ${fmt(lo)} – ${hi === Infinity ? "above" : "NPR "+fmt(hi)}`);
          steps.push(`Base fee = NPR ${fmt(base)}`);
          steps.push(`Incremental: (${fmt(fmv)} − ${fmt(lo)}) × ${rate.toFixed(4)} = NPR ${fmt(inc)}`);
          steps.push(`Total fee = ${fmt(base)} + ${fmt(inc)} = NPR ${fmt(fee)}`);
        }
      }
      return { valFee: fee, valFeeBreakdown: steps };
    }
    // Custom tiers
    const fmv = finalFMV;
    if (fmv <= 0) return { valFee: 0, valFeeBreakdown: ["FMV is 0 — no fee applicable."] };
    const floors = tiers.map((_, i) => i === 0 ? 0 : (tiers[i-1].upto == null ? Infinity : Number(tiers[i-1].upto)));
    const steps = [`FMV = NPR ${fmt(fmv)}`];
    for (let i = 0; i < tiers.length; i++) {
      const ceil = tiers[i].upto == null ? Infinity : Number(tiers[i].upto);
      if (fmv <= ceil) {
        const base = Number(tiers[i].base);
        const rate = Number(tiers[i].rate);
        const diff = fmv - floors[i];
        const inc  = Math.round(diff * rate);
        const fee  = Math.round(base + diff * rate);
        steps.push(`Slab: NPR ${fmt(floors[i])} – ${ceil === Infinity ? "above" : "NPR "+fmt(ceil)}${tiers[i].label ? " ("+tiers[i].label+")" : ""}`);
        steps.push(`Base fee = NPR ${fmt(base)}`);
        steps.push(`Incremental: (${fmt(fmv)} − ${fmt(floors[i])}) × ${rate.toFixed(4)} = NPR ${fmt(inc)}`);
        steps.push(`Total fee = ${fmt(base)} + ${fmt(inc)} = NPR ${fmt(fee)}`);
        return { valFee: fee, valFeeBreakdown: steps };
      }
    }
    const last = tiers[tiers.length - 1];
    const base = Number(last.base);
    const rate = Number(last.rate);
    const diff = fmv - floors[floors.length - 1];
    const inc  = Math.round(diff * rate);
    const fee  = Math.round(base + diff * rate);
    steps.push(`Slab: NPR ${fmt(floors[floors.length-1])} and above${last.label ? " ("+last.label+")" : ""}`);
    steps.push(`Base fee = NPR ${fmt(base)}`);
    steps.push(`Incremental: (${fmt(fmv)} − ${fmt(floors[floors.length-1])}) × ${rate.toFixed(4)} = NPR ${fmt(inc)}`);
    steps.push(`Total fee = ${fmt(base)} + ${fmt(inc)} = NPR ${fmt(fee)}`);
    return { valFee: fee, valFeeBreakdown: steps };
  })();
  const extraAmt   = parseFloat(s.extraChargeAmount)    || 0;
  const subTotal   = fieldVisit + valFee + extraAmt;
  const advance    = deductFieldVisit ? fieldVisit : 0;
  const total      = subTotal - advance;
  const discount   = parseFloat(s.discountAmount)       || 0;
  const vatBase    = Math.max(0, total - discount);
  const vatAmt     = s.includeVat ? Math.round(vatBase * 0.13) : 0;
  const grandTotal = vatBase + vatAmt;

  const today      = new Date().toLocaleDateString("en-NP",{year:"numeric",month:"2-digit",day:"2-digit"});
  const todayLong  = new Date().toLocaleDateString("en-NP",{year:"numeric",month:"long",day:"numeric"});
  const prefix     = esc(s.billPrefix || "BILL");
  const billNumber = s.billNo ? esc(s.billNo) : `${prefix}/${today.replace(/\//g,"-")}`;

  // All clients
  const allClientNames = (s.clients||[]).map(cl => {
    const parts = [];
    if (cl.showPerson  && cl.person?.name)  parts.push(esc(fullName(cl.person)));
    if (cl.showCompany && cl.company?.name) parts.push(esc(cl.company.name));
    return parts.join(" / ");
  }).filter(Boolean);
  const clientNamesStr = allClientNames.join(", ") || "—";

  // Primary client contact/address for Bill To block
  const billClient  = (s.clients||[])[0] || {};
  const clientAddr    = (billClient.showPerson && billClient.person?.address)  ? esc(billClient.person.address)  : (billClient.showCompany && billClient.company?.address)  ? esc(billClient.company.address)  : "";
  const clientContact = (billClient.showPerson && billClient.person?.contact)  ? esc(billClient.person.contact)  : (billClient.showCompany && billClient.company?.contact)  ? esc(billClient.company.contact)  : "";

  const npr = (n) => `NPR ${Math.round(n).toLocaleString("en-NP")}`;

  // Build reference schedule rows from admin-configured tiers
  const adminTiers = (s.feeTiers && Array.isArray(s.feeTiers) && s.feeTiers.length > 0) ? s.feeTiers : null;
  const feeScheduleRows = adminTiers
    ? adminTiers.map((t, i) => {
        const alpha = String.fromCharCode(97 + i);
        const uptoAmt = t.upto == null || t.upto === Infinity ? null : Number(t.upto);
        const uptoStr = uptoAmt == null ? "Above last slab" : `Up to ${Math.round(uptoAmt).toLocaleString("en-NP")}`;
        const floor   = i === 0 ? 0 : (adminTiers[i-1].upto == null ? 0 : Number(adminTiers[i-1].upto));
        const feeStr  = i === 0
          ? `Base: NPR ${Math.round(Number(t.base)||0).toLocaleString("en-NP")} + FMV × ${Number(t.rate||0).toFixed(4)}`
          : `NPR ${Math.round(Number(t.base)||0).toLocaleString("en-NP")} + (FMV − ${Math.round(floor).toLocaleString("en-NP")}) × ${Number(t.rate||0).toFixed(4)}`;
        const sampleFMV = uptoAmt != null ? uptoAmt : floor + 10000000;
        const sampleFee = Math.round(Number(t.base||0) + (sampleFMV - floor) * Number(t.rate||0));
        return [alpha, uptoStr, feeStr, Math.round(sampleFee).toLocaleString("en-NP"), floor, uptoAmt];
      })
    : null;

  // ── Letterhead + text-box layout (same approach as letter page) ──
  const lhSrc = s.letterheadPng || "";
  const tb = s.letterheadTextBox;
  const contentStyle = tb
    ? `position:absolute;top:${tb.top}%;left:${tb.left}%;width:${tb.width}%;height:${tb.height}%;box-sizing:border-box;overflow:hidden;z-index:1;padding:2mm;font-size:8.5pt;line-height:1.3;`
    : `position:relative;z-index:1;padding:14mm 16mm 10mm 18mm;box-sizing:border-box;font-size:9pt;line-height:1.35;`;

  const wb = s.letterheadWatermarkBox;
  const wmHtml = (lhSrc && wb)
    ? `<div style="position:absolute;top:${wb.top}%;left:${wb.left}%;width:${wb.width}%;height:${wb.height}%;overflow:hidden;z-index:0;pointer-events:none;-webkit-print-color-adjust:exact;print-color-adjust:exact;">
        <img src="${lhSrc}" alt="" style="position:absolute;top:${-(wb.top)}%;left:${-(wb.left)}%;width:${(100/wb.width)*100}%;height:${(100/wb.height)*100}%;object-fit:fill;opacity:${wb.opacity||0.12};-webkit-print-color-adjust:exact;print-color-adjust:exact;pointer-events:none;"/>
      </div>`
    : "";

  const autoScript = autoPrint ? `<script>window.onload=function(){window.print();}</script>` : "";

  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">
  <title>${suggestedFilename||"Valuation Bill"}</title>
  <style>
    @page { size:A4 portrait; margin:0; }
    *,*::before,*::after { box-sizing:border-box; margin:0; padding:0; }
    body { font-family:"Times New Roman",Times,serif; font-size:9pt; color:#111; background:#f0f0f0; }
    .no-print { display:flex; align-items:center; gap:10px; padding:10px 20px; background:#1a1714; color:#fff;
      font-family:Arial,sans-serif; font-size:13px; position:sticky; top:0; z-index:9999; }
    .no-print button { padding:7px 20px; border:none; border-radius:5px; font-weight:700; cursor:pointer; font-size:13px; }
    .no-print .btn-print { background:#c0392b; color:#fff; }
    .no-print .btn-close { background:rgba(255,255,255,0.15); color:#fff; border:1px solid rgba(255,255,255,0.3); }
    .bill-page {
      width:210mm; height:297mm; min-height:297mm; max-height:297mm;
      position:relative; background:#fff; overflow:hidden;
      font-family:"Times New Roman",Times,serif;
      box-sizing:border-box;
    }
    .bill-page-bg {
      position:absolute; top:0; left:0; width:100%; height:100%;
      z-index:0; pointer-events:none;
      -webkit-print-color-adjust:exact; print-color-adjust:exact;
    }
    .bill-page-bg img { width:100%; height:100%; object-fit:fill; display:block; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
    table { width:100%; border-collapse:collapse; }
    @media screen {
      body { padding:20px; }
      .bill-page { margin:0 auto; box-shadow:0 2px 16px rgba(0,0,0,0.18); }
    }
    @media print {
      body { background:#fff !important; padding:0 !important; }
      .no-print { display:none !important; }
      .bill-page { margin:0; box-shadow:none; page-break-after:always; }
    }
  </style>
  </head><body>
  <div class="no-print">
    <span style="flex:1;font-weight:700;">🧾 Valuation Bill</span>
    <button class="btn-print" onclick="window.print()">🖨 Print / Save as PDF</button>
    <button class="btn-close" onclick="window.close()">✕ Close</button>
  </div>

  <div class="bill-page">
    ${lhSrc ? `<div class="bill-page-bg"><img src="${lhSrc}" alt="Letterhead"/></div>` : ""}
    ${wmHtml}

    <div style="${contentStyle}">

      <!-- Bill header row -->
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:4pt">
        <div style="font-size:9pt;font-weight:bold;color:${T.primary};text-transform:uppercase;letter-spacing:0.5px">
          Valuation Bill
        </div>
        <div style="text-align:right;font-size:8pt;color:#333;line-height:1.5">
          <div><strong>Bill No.:</strong> ${billNumber}</div>
          <div><strong>Date:</strong> ${todayLong}</div>
        </div>
      </div>
      <div style="border-top:1.5pt solid ${T.primary};margin-bottom:5pt"></div>

      <!-- Bill To / Property -->
      <table style="margin-bottom:5pt;font-size:8pt">
        <tr>
          <td style="width:52%;vertical-align:top;padding-right:6pt;border:none">
            <div style="font-size:7.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:0.6px;color:${T.primary};border-bottom:0.5pt solid #ccc;padding-bottom:1.5pt;margin-bottom:3pt">Bill To</div>
            <div style="font-weight:bold">${clientNamesStr}</div>
            ${clientAddr    ? `<div style="color:#444;margin-top:1pt">${clientAddr}</div>` : ""}
            ${clientContact ? `<div style="color:#444">Tel: ${clientContact}</div>` : ""}
            ${s.bank ? `<div style="margin-top:2pt;color:#555">Bank: <strong>${esc(s.bank)}${s.branch?" · "+esc(s.branch):""}</strong></div>` : ""}
          </td>
          <td style="width:48%;vertical-align:top;border:none">
            <div style="font-size:7.5pt;font-weight:bold;text-transform:uppercase;letter-spacing:0.6px;color:${T.primary};border-bottom:0.5pt solid #ccc;padding-bottom:1.5pt;margin-bottom:3pt">Property Details</div>
            <div>Plot No.: <strong>${plotList}</strong></div>
            ${traceList ? `<div style="margin-top:1pt">Trace Sheet No.: <strong>${traceList}</strong></div>` : ""}
            ${propLoc   ? `<div style="color:#444;margin-top:1pt">Location: ${propLoc}</div>` : ""}
            <div style="margin-top:2pt">FMV: <strong>${npr(finalFMV)}</strong></div>
          </td>
        </tr>
      </table>

      <!-- Intro paragraph -->
      <div style="font-size:8pt;line-height:1.45;margin-bottom:5pt;color:#222">
        We are pleased to quote the rates of Valuation charge as per agreement with <strong>${s.billingSystem === "bank" ? esc(s.bank||"[Bank Name]")+(s.branch?" — "+esc(s.branch):"") : "Nepal Valuators Association"}</strong>.
        Please find the valuation charge sheet as per your requirement.
      </div>

      <!-- Fee Table (new structure) -->
      <table style="margin-bottom:4pt;font-size:8.5pt;border:0.75pt solid #ccc">
        <thead>
          <tr style="background:${T.primary};color:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <th style="padding:3pt 6pt;text-align:left;width:8%;border:0.5pt solid ${T.border}">S.No.</th>
            <th style="padding:3pt 6pt;text-align:left;border:0.5pt solid ${T.border}">Description</th>
            <th style="padding:3pt 6pt;text-align:right;width:33%;border:0.5pt solid ${T.border}">Amount (NPR)</th>
          </tr>
        </thead>
        <tbody>
          <tr style="background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd">1.</td>
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd">Field Visit Charge${transport>0?` (incl. transportation: ${npr(transport)})`:"" }</td>
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd;text-align:right">${npr(fieldVisit)}</td>
          </tr>
          <tr style="background:${T.info};-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd">2.</td>
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd;font-weight:bold">Valuation Charge<br/><span style="font-size:7.5pt;font-weight:normal;color:#555">${esc(billingSystemLabel)}</span>${extraAmt>0?`<br/><span style="font-size:7.5pt;font-weight:normal;color:#555">&nbsp;&nbsp;+ ${esc(s.extraChargeLabel||"Extra Charge")}: ${npr(extraAmt)}</span>`:""}</td>
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd;text-align:right;font-weight:bold;color:${T.primary}">${npr(valFee + extraAmt)}</td>
          </tr>
          <tr style="background:#fff8e1;font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd">3.</td>
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd">Sub Total</td>
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd;text-align:right">${npr(subTotal)}</td>
          </tr>
          ${deductFieldVisit?`<tr style="background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd">4.</td>
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd">Advance (Field Visit)</td>
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd;text-align:right;color:#c0392b">− ${npr(advance)}</td>
          </tr>`:""}
          ${(()=>{
            let n = deductFieldVisit ? 4 : 3;
            return `<tr style="background:${T.info};font-weight:bold;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd">${++n}.</td>
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd">Total</td>
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd;text-align:right">${npr(total)}</td>
          </tr>
          <tr style="background:#fff;-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd">${++n}.</td>
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd">Discount</td>
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd;text-align:right;color:#c0392b">− ${npr(discount)}</td>
          </tr>
          ${vatAmt>0?`<tr style="background:${T.info};-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd">${++n}.</td>
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd">VAT @ 13%</td>
            <td style="padding:3pt 6pt;border:0.5pt solid #ddd;text-align:right;color:#e67e22">${npr(vatAmt)}</td>
          </tr>`:""}
          <tr style="background:${T.lighter};border-top:1.5pt solid ${T.primary};-webkit-print-color-adjust:exact;print-color-adjust:exact">
            <td style="padding:4pt 6pt;font-weight:bold;border:0.5pt solid #ccc">${++n}.</td>
            <td style="padding:4pt 6pt;font-weight:bold;border:0.5pt solid #ccc">Grand Total Payable</td>`;
          })()}
            <td style="padding:4pt 6pt;font-weight:bold;font-size:10pt;text-align:right;color:${T.primary};border:0.5pt solid #ccc">${npr(grandTotal)}</td>
          </tr>
        </tbody>
      </table>
      <div style="font-size:7.5pt;color:#555;font-style:italic;margin-bottom:5pt;padding:0 1pt">
        In Words: <strong style="color:#111">${toWords(grandTotal)} Rupees Only</strong>
      </div>

      <!-- Payment Details: structured bank account + QR -->
      ${(() => {
        const pm = s.selectedPaymentMethod;
        const qr = (pm && pm.qrCode) ? pm.qrCode : (s.billQrCode || "");
        const hasPm = pm && (pm.bankName || pm.accountName || pm.accountNumber);
        const hasFallback = !hasPm && s.companyBankAccount;
        if (!hasPm && !hasFallback && !qr) return "";
        const bankLines = hasPm ? [
          pm.bankName && `<div style="font-weight:bold;font-size:8pt;color:${T.primary}">${esc(pm.bankName)}</div>`,
          pm.branch   && `<div>${esc(pm.branch)}${pm.location?" — "+esc(pm.location):""}</div>`,
          !pm.branch && pm.location && `<div>${esc(pm.location)}</div>`,
          pm.accountName   && `<div>Account Name: <strong>${esc(pm.accountName)}</strong></div>`,
          pm.accountNumber && `<div>Account No.: <strong>${esc(pm.accountNumber)}</strong></div>`,
        ].filter(Boolean).join("") : `<div style="white-space:pre-line">${esc(s.companyBankAccount)}</div>`;
        return `<div style="border:0.75pt solid #ccc;border-radius:3pt;margin-bottom:5pt;overflow:hidden;-webkit-print-color-adjust:exact;print-color-adjust:exact">
          <div style="font-size:7pt;font-weight:bold;color:#fff;background:${T.primary};text-transform:uppercase;padding:2.5pt 7pt;letter-spacing:0.4px;-webkit-print-color-adjust:exact;print-color-adjust:exact">Payment Details</div>
          <div style="display:flex;align-items:stretch">
            <div style="flex:1;padding:5pt 8pt;font-size:7.5pt;line-height:1.6;color:#333;border-right:${qr?"0.5pt solid #eee":"none"}">${bankLines}</div>
            ${qr ? `<div style="padding:4pt 8pt;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:60pt;background:#fafbfd;-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <img src="${qr}" alt="Payment QR" style="width:54pt;height:54pt;object-fit:contain;display:block;-webkit-print-color-adjust:exact;print-color-adjust:exact"/>
              <div style="font-size:6.5pt;color:#666;margin-top:2pt;text-align:center">Scan to Pay</div>
            </div>` : ""}
          </div>
        </div>`;
      })()}

      <!-- Fee Calculation Breakdown -->
      <div style="margin-bottom:6pt;background:#f8fafb;border:0.5pt solid #dde1e7;border-radius:4pt;padding:5pt 8pt">
        <div style="font-size:7pt;font-weight:bold;color:${T.primary};text-transform:uppercase;letter-spacing:0.4px;border-bottom:0.5pt solid #ddd;padding-bottom:2pt;margin-bottom:4pt">
          Valuation Fee Calculation — ${esc(billingSystemLabel)}
        </div>
        <table style="font-size:7.5pt;width:100%;border-collapse:collapse">
          ${valFeeBreakdown.map((step, i) => `
          <tr>
            <td style="padding:1.5pt 3pt;color:#555;width:18pt;vertical-align:top">${i === 0 ? "" : "→"}</td>
            <td style="padding:1.5pt 3pt;font-weight:${i === valFeeBreakdown.length - 1 ? "bold" : "400"};color:${i === valFeeBreakdown.length - 1 ? T.primary : "#333"}">${esc(step)}</td>
          </tr>`).join("")}
        </table>
      </div>

      <!-- Fee Schedule Reference (admin-configured tiers) -->
      ${feeScheduleRows ? `<div style="margin-bottom:5pt">
        <div style="font-size:7pt;font-weight:bold;color:${T.primary};text-transform:uppercase;letter-spacing:0.4px;border-bottom:0.5pt solid #ccc;padding-bottom:1.5pt;margin-bottom:3pt">
          Reference: ${esc(billingSystemLabel)}
        </div>
        <table style="font-size:7pt;width:100%;border-collapse:collapse">
          <thead>
            <tr style="background:${T.lighter};-webkit-print-color-adjust:exact;print-color-adjust:exact">
              <th style="padding:2pt 3pt;border:0.5pt solid #ccc;width:5%;text-align:center;color:${T.primary}">S.No.</th>
              <th style="padding:2pt 3pt;border:0.5pt solid #ccc;text-align:left;color:${T.primary}">Label</th>
              <th style="padding:2pt 3pt;border:0.5pt solid #ccc;text-align:left;color:${T.primary}">Upto FMV</th>
              <th style="padding:2pt 3pt;border:0.5pt solid #ccc;text-align:left;color:${T.primary}">Fee Formula</th>
              <th style="padding:2pt 3pt;border:0.5pt solid #ccc;text-align:right;color:${T.primary}">Fee at Upto (NPR)</th>
            </tr>
          </thead>
          <tbody>
            ${feeScheduleRows.map(([sno,uptoStr,feeStr,sampleFee,floor,uptoAmt], i) => {
              const active = finalFMV > 0 && (
                (uptoAmt == null && finalFMV > floor) ||
                (uptoAmt != null && finalFMV > floor && finalFMV <= uptoAmt)
              );
              const bg = active ? T.lighter : i%2===0 ? "#fff" : T.info;
              const label = esc(adminTiers[i].label || "");
              return `<tr style="background:${bg};${active?"font-weight:bold;":""}-webkit-print-color-adjust:exact;print-color-adjust:exact">
                <td style="padding:1.5pt 3pt;border:0.5pt solid #ccc;text-align:center">${sno}.</td>
                <td style="padding:1.5pt 3pt;border:0.5pt solid #ccc">${label}</td>
                <td style="padding:1.5pt 3pt;border:0.5pt solid #ccc">${uptoStr}</td>
                <td style="padding:1.5pt 3pt;border:0.5pt solid #ccc">${feeStr}</td>
                <td style="padding:1.5pt 3pt;border:0.5pt solid #ccc;text-align:right">${uptoAmt == null ? "—" : sampleFee}</td>
              </tr>`;
            }).join("")}
          </tbody>
        </table>
      </div>` : ""}

      <!-- Signature -->
      <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:6pt">
        <div style="font-size:7.5pt;color:#555;max-width:55%">
          <div style="font-style:italic;margin-bottom:2pt">This is a computer-generated bill.</div>
          ${s.billRemarks ? `<div style="color:#333"><strong>Remarks:</strong> ${esc(s.billRemarks)}</div>` : ""}
        </div>
        <div style="text-align:center;font-size:8pt">
          <div style="min-width:120pt;padding-top:2pt;margin-top:18pt;border-top:0.75pt solid #000">
            <div style="font-weight:bold">${esc(s.companyName||vi.company||"Valuation Company")}</div>
            ${vi.name ? `<div style="font-size:7.5pt">${esc(vi.name)}</div>` : ""}
            ${vi.licenseNo ? `<div style="font-size:7pt;color:#555">NEC Reg. No.: ${esc(vi.licenseNo)}</div>` : ""}
            <div style="font-size:7pt;color:#555;font-style:italic">Authorised Signatory</div>
          </div>
        </div>
      </div>

    </div><!-- end content box -->
  </div><!-- end bill-page -->
  ${autoScript}</body></html>`;
}