import { propAreaSqm, areaDisplay, sqmToRadp, sqmToAana, sqmToBkd, sqmToDhur, AANA_TO_SQM, DHUR_TO_SQM } from "../utils/areaConversions";
const _isBkdRate = (p) => p.areaUnit === "bkd" || (p.areaUnit === "sqm" && p.rateSystem === "bkd");
const _uf  = (p) => _isBkdRate(p) ? DHUR_TO_SQM : AANA_TO_SQM;
const _ul  = (p) => _isBkdRate(p) ? "Dhur" : "Aana";
const _ud  = (p, sqm) => _isBkdRate(p) ? sqmToDhur(sqm).toFixed(3) : sqmToAana(sqm).toFixed(4);
const _uda = (p, sqm) => _isBkdRate(p) ? sqmToDhur(sqm) : sqmToAana(sqm);
const _nativeStr = (p, sqm) => {
  if (_isBkdRate(p)) { const x=sqmToBkd(sqm); return `${x.b}-${x.k}-${parseFloat(x.d).toFixed(3)}`; }
  const x=sqmToRadp(sqm); return `${x.r}-${x.a}-${x.p}-${x.d}`;
};
import { toWords } from "../utils/numberWords";
import { esc } from "../utils/htmlEscape";
import { buildTheme } from "../utils/reportTheme";
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

export function buildPreliminaryHTML(s, suggestedFilename, autoPrint = false, mapSnapshots = {}) {
  const T = buildTheme(s.reportColorTheme);
  const vi = s.valuatorInfo || {};
  const lhSrc = s.letterheadPng || "";
  const lhBlock = lhSrc
    ? `<div style="width:100%;overflow:hidden;margin-bottom:0;-webkit-print-color-adjust:exact;print-color-adjust:exact"><img src="${lhSrc}" style="width:100%;display:block;height:auto;object-fit:contain;object-position:top center" alt="Company Letterhead"/></div>`
    : `<div style="text-align:center;padding:16pt 0 10pt;border-bottom:2pt solid #888;margin-bottom:0">
        <div style="font-size:15pt;font-weight:bold;color:${T.primary};letter-spacing:2px;text-transform:uppercase">${esc(vi.company, "Property Valuation Company")}</div>
        ${vi.phone ? `<div style="font-size:9.5pt;color:#555;margin-top:3pt">Tel: ${esc(vi.phone)}${vi.email ? " &nbsp;|&nbsp; " + esc(vi.email) : ""}</div>` : ""}
      </div>`;

  const mortProps = (s.properties || []).filter(p => (s.mortgagedIds || []).includes(p.id));
  const allBkdMort = mortProps.length > 0 && mortProps.every(p => _isBkdRate(p));
  const anyBkdMort = mortProps.some(p => _isBkdRate(p));
  const nativeHdr = allBkdMort ? "B-K-D" : anyBkdMort ? "R-A-P-D / B-K-D" : "R-A-P-D";
  const unitHdr = allBkdMort ? "Dhur" : anyBkdMort ? "Aana / Dhur" : "Aana";
  const allProps = s.properties || [];
  const _allBkd = allProps.length > 0 && allProps.every(p => p.areaUnit === "bkd");
  const _anyBkd = allProps.some(p => p.areaUnit === "bkd");
  const allPropNativeHdr = _allBkd ? "B-K-D" : _anyBkd ? "Native Area" : "R-A-P-D";

  const fullName = (person) => [person?.salutation, person?.name].filter(Boolean).join(" ");

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
  const clientsHTML = (s.clients || []).map((cl, i) => {
    let html = `<div class="sub-section-head">${clientLabel} ${i + 1}</div>`;
    if (cl.showPerson) html += `<table class="info-table">${personRows(cl.person || {})}</table>`;
    if (cl.showCompany) {
      html += `<table class="info-table" style="margin-top:5pt">
        <tr><td>Company Name</td><td>${esc(cl.company?.name)}</td><td>PAN/VAT</td><td>${esc(cl.company?.panVat)}</td></tr>
        <tr><td>Reg. No.</td><td>${esc(cl.company?.regNo)}</td><td>Reg. Date (BS)</td><td>${esc(cl.company?.regDate)}</td></tr>
        <tr><td>Registered On</td><td colspan="3">${esc(cl.company?.regOn)}</td></tr>
        <tr><td>Contact</td><td>${esc(cl.company?.contact)}</td><td>Address</td><td>${esc(cl.company?.address)}</td></tr>
      </table>`;
      (cl.company?.directors || []).forEach((d, di) => {
        html += `<div style="margin:5pt 0 2pt;font-style:italic;font-size:10.5pt">Director ${di + 1}${d.name ? ": " + esc(fullName(d)) : ""}</div><table class="info-table">${personRows(d)}</table>`;
      });
    }
    return html;
  }).join('<div class="divider"></div>');

  // ── 3.2 Owners / Sellers
  const ownersInfoHTML = (s.owners || []).map((ow, i) => {
    let html = `<div class="sub-section-head">${ownerLabel} ${i + 1}</div>`;
    if (ow.showPerson) html += `<table class="info-table">${personRows(ow.person || {})}</table>`;
    if (ow.showCompany) {
      html += `<table class="info-table" style="margin-top:5pt">
        <tr><td>Company Name</td><td>${esc(ow.company?.name)}</td><td>PAN/VAT</td><td>${esc(ow.company?.panVat)}</td></tr>
        <tr><td>Reg. No.</td><td>${esc(ow.company?.regNo)}</td><td>Reg. Date (BS)</td><td>${esc(ow.company?.regDate)}</td></tr>
        <tr><td>Registered On</td><td colspan="3">${esc(ow.company?.regOn)}</td></tr>
        <tr><td>Contact</td><td>${esc(ow.company?.contact)}</td><td>Address</td><td>${esc(ow.company?.address)}</td></tr>
      </table>`;
      (ow.company?.directors || []).forEach((d, di) => {
        html += `<div style="margin:5pt 0 2pt;font-style:italic;font-size:10.5pt">Director ${di + 1}${d.name ? ": " + esc(fullName(d)) : ""}</div><table class="info-table">${personRows(d)}</table>`;
      });
    }
    return html;
  }).join('<div class="divider"></div>');

  // ── 3.3 Property Detail Rows
  const propDetailRows = (s.properties || []).map(p => {
    const sqm = propAreaSqm(p);
    const radp = sqmToRadp(sqm);
    return `<tr>
      <td>${esc(p.plotNo)}</td><td>${esc(p.traceSheetNo)}</td><td>${esc(p.landType)}</td>
      <td>${sqm.toFixed(3)}</td><td>${_nativeStr(p, sqm)}</td>
      <td>${esc([p.ownerSalutation,p.ownerName].filter(Boolean).join(' '))}</td><td>${esc(p.addressLalpurja)}</td><td>${esc(p.presentAddress)}</td>
    </tr>`;
  }).join("");

  // ── 4. Area to be Mortgaged
  const mortAreaRows = mortProps.map(p => {
    const lSqm = propAreaSqm(p);
    const measured = parseFloat(s.areaMeasured?.[p.id]) || lSqm;
    const radp = sqmToRadp(lSqm);
    return `<tr>
      <td>${esc(p.plotNo)}</td><td>${esc(p.traceSheetNo)}</td><td>${esc([p.ownerSalutation,p.ownerName].filter(Boolean).join(' '))}</td>
      <td>${areaDisplay(p)}</td>
      <td>${lSqm.toFixed(3)}</td><td>${measured.toFixed(3)}</td>
    </tr>`;
  }).join("");

  // ── 5. Deduction
  const deductionRows = mortProps.map(p => `
    <tr>
      <td>${esc(p.plotNo)}</td>
      <td>${esc(s.deductions?.[p.id]?.dim)}</td>
      <td>${s.deductions?.[p.id]?.area || "0"}</td>
      <td>${esc(s.deductions?.[p.id]?.reason)}</td>
    </tr>`).join("");

  // ── 6. Considered Area
  const consideredRows = mortProps.map(p => {
    const lSqm = propAreaSqm(p);
    const lRadp = sqmToRadp(lSqm);
    const measured = parseFloat(s.areaMeasured?.[p.id]) || lSqm;
    const deduct = parseFloat(s.deductions?.[p.id]?.area) || 0;
    const considered = Math.max(0, Math.min(lSqm, measured) - deduct);
    const radp = sqmToRadp(considered);
    return `<tr>
      <td>${esc(p.plotNo)}</td>
      <td>${lSqm.toFixed(3)}</td><td>${_nativeStr(p, lSqm)}</td>
      <td>${measured.toFixed(3)}</td><td>${deduct.toFixed(3)}</td>
      <td class="cell-hl">${considered.toFixed(3)}</td>
      <td class="cell-hl">${_nativeStr(p, considered)}</td>
      <td class="cell-hl">${_ud(p, considered)}</td>
    </tr>`;
  }).join("");

  // ── 7. Road Access
  const roadAccessHTML = (s.properties || []).map(p => {
    const rows = s.roadAccess?.[p.id] || [];
    if (!rows.length) return `<tr><td>${esc(p.plotNo)}</td><td colspan="5" class="empty-cell">No access rows entered</td></tr>`;
    return rows.map(r => `<tr>
      <td>${esc(p.plotNo)}</td><td>${esc(r.roadType)}</td><td>${esc(r.frontage)}</td>
      <td>${esc(r.widthField)}</td><td>${esc(r.widthTrace)}</td><td>${esc(r.remarks)}</td>
    </tr>`).join("");
  }).join("");

  // ── 8. Hazards / Encumbrances
  const HAZARD_DEFS = [
    { flag:"highTensionLine", label:"High Tension Line",   hasSide:true,  hasDist:true  },
    { flag:"river",           label:"River",                hasSide:true,  hasDist:true  },
    { flag:"kuloKholchi",     label:"Kulo / Kholchi",       hasSide:true,  hasDist:true  },
    { flag:"floodZone",       label:"Flood Zone",           hasSide:false, hasDist:false },
    { flag:"landslide",       label:"Landslide / Erosion",  hasSide:true,  hasDist:true  },
    { flag:"graveyard",       label:"Graveyard / Cemetery", hasSide:true,  hasDist:true  },
    { flag:"encroachment",    label:"Encroachment",         hasSide:true,  hasDist:false },
  ];
  const hazardRows = (s.properties || []).map((p, pi) => {
    const pd = (s.propDescriptions || {})[p.id] || {};
    const activeItems = HAZARD_DEFS.filter(h => pd[h.flag]).map(h => {
      const parts = [];
      if (h.hasDist && pd[h.flag + "Distance"]) parts.push(`Dist: ${esc(pd[h.flag + "Distance"])}`);
      if (h.hasSide && pd[h.flag + "Side"])     parts.push(`Side: ${esc(pd[h.flag + "Side"])}`);
      if (pd[h.flag + "Comment"])               parts.push(`Min. Req: ${esc(pd[h.flag + "Comment"])}`);
      return `<strong>${esc(h.label)}</strong>${parts.length ? " — " + parts.join(", ") : ""}`;
    });
    const inactiveItems = HAZARD_DEFS.filter(h => !pd[h.flag]).map(h => esc(h.label));
    const complies = pd.meetsMinReq;
    const complianceCell = complies === true
      ? `<span style="color:#1a7a3a;font-weight:bold">✔ Fulfills All Requirements</span>`
      : complies === false
      ? `<span style="color:#c0392b;font-weight:bold">✘ Does Not Fulfill</span>`
      : `<span style="font-style:italic">—</span>`;
    return `<tr>
      <td style="white-space:nowrap;text-align:center">${pi + 1}</td>
      <td style="white-space:nowrap">${esc(p.plotNo)}</td>
      <td>${activeItems.length ? activeItems.join("<br/>") : `<span style="font-style:italic">None</span>`}</td>
      <td style="font-size:9.5pt">${inactiveItems.join(", ")}</td>
      <td style="white-space:nowrap;text-align:center">${complianceCell}${pd.meetsMinReqComment ? `<br/><span style="font-size:8.5pt;color:#555">${esc(pd.meetsMinReqComment)}</span>` : ""}</td>
    </tr>`;
  }).join("");

  // ── 9. Boundary
  const boundaryRows = [
    ...mortProps.map(p => {
      const ac = s.access?.[p.id] || {};
      return `<tr>
        <td>${esc(p.plotNo)}</td><td>${esc(ac.east)}</td><td>${esc(ac.west)}</td>
        <td>${esc(ac.north)}</td><td>${esc(ac.south)}</td><td>${esc(ac.remarks)}</td>
      </tr>`;
    }),
    ...(s.extraBoundaryRows||[]).map(row => `<tr>
      <td>${esc(row.plotNo)}</td><td>${esc(row.east)}</td><td>${esc(row.west)}</td>
      <td>${esc(row.north)}</td><td>${esc(row.south)}</td><td>${esc(row.remarks)}</td>
    </tr>`),
  ].join("");

  // ── 9. Building Detail
  const buildingDetailHTML = (s.buildings || []).map((b, i) => {
    const totalActual = (b.areaTable || []).reduce((sum, a) => sum + (parseFloat(a.areaActual) || 0), 0);
    const totalApproved = (b.areaTable || []).reduce((sum, a) => sum + (parseFloat(a.areaApproved) || 0), 0);
    const totalCert = (b.areaTable || []).reduce((sum, a) => sum + (parseFloat(a.areaCertificate) || 0), 0);
    const areaRows = (b.areaTable || []).map(a => `
      <tr>
        <td>${esc(a.description)}</td>
        <td>${parseFloat(a.areaActual) || 0}</td>
        <td>${parseFloat(a.areaApproved) || 0}</td>
        <td>${parseFloat(a.areaCertificate) || 0}</td>
      </tr>`).join("");
    return `<div class="sub-section-head">Building ${i + 1}${b.plotNo ? ` — Plot No. ${esc(b.plotNo)}` : ""}</div>
    <table class="info-table">
      <tr><td>Owner Name</td><td>${esc(b.ownerName)}</td><td>Plot No.</td><td>${esc(b.plotNo)}</td></tr>
      <tr><td>Face Direction</td><td>${esc(b.faceDirection)}</td><td>No. of Floors</td><td>${esc(b.numFloors)}</td></tr>
      <tr><td>Permitted Floors</td><td>${esc(b.floorPermission)}</td><td>Year of Construction</td><td>${esc(b.yearOfConstruction)}</td></tr>
      <tr><td>Completion Date (BS)</td><td>${esc(b.completionDate)}</td><td>Age of Building (yrs)</td><td>${esc(b.ageOfBuilding)}</td></tr>
      <tr><td>Expected Life (yrs)</td><td>${esc(b.expectedLife)}</td><td>Structure Type</td><td>${esc(b.structureType)}</td></tr>
      <tr><td>Foundation Type</td><td colspan="3">${esc(b.foundationType)}</td></tr>
    </table>
    <table>
      <thead><tr><th>Floor / Description</th><th>Actual Construction (sq.ft)</th><th>Approved Map (sq.ft)</th><th>Completion Cert. (sq.ft)</th></tr></thead>
      <tbody>
        ${areaRows || `<tr><td colspan="4" class="empty-cell">No area data</td></tr>`}
        <tr class="total-row">
          <td><strong>TOTAL</strong></td>
          <td><strong>${totalActual.toFixed(2)}</strong></td>
          <td><strong>${totalApproved.toFixed(2)}</strong></td>
          <td><strong>${totalCert.toFixed(2)}</strong></td>
        </tr>
      </tbody>
    </table>`;
  }).join('<div class="divider"></div>');

  // ── 10. Land Valuation
  const _distressMult = Math.min(100, Math.max(0, parseFloat(s.distressPct) || 80)) / 100;
  let totalLandCommercial = 0, totalLandFMV = 0, totalLandGov = 0;
  let landRateRows = "", landValueRows = "";
  mortProps.forEach(p => {
    const lSqm = propAreaSqm(p);
    const measured = parseFloat(s.areaMeasured?.[p.id]) || lSqm;
    const deduct = parseFloat(s.deductions?.[p.id]?.area) || 0;
    const considered = Math.max(0, Math.min(lSqm, measured) - deduct);
    const splits = s.plotRateSplits?.[p.id] || [];

    if (splits.length > 0) {
      let plotCommTotal = 0, plotFmvTotal = 0;
      const spGovRate = parseFloat(splits[0]?.govRate) || 0;
      const gVal = spGovRate * _uda(p, considered);
      const gValR = Math.floor(gVal / 100) * 100;
      splits.forEach(sp => {
        const spArea = parseFloat(sp.areaSqm) || 0;
        const spCRate = parseFloat(sp.commercialRate) || 0;
        const spCW = sp.commercialWeight !== undefined ? parseFloat(sp.commercialWeight) : 70;
        const spGW = sp.govWeight !== undefined ? parseFloat(sp.govWeight) : 30;
        const spFmvRate = (spCRate * spCW / 100) + ((parseFloat(sp.govRate) || 0) * spGW / 100);
        const spCVal = spArea * spCRate / _uf(p);
        const spFVal = spArea * spFmvRate / _uf(p);
        plotCommTotal += spCVal;
        plotFmvTotal += spFVal;
        const spZoneGovRate = parseFloat(sp.govRate) || 0;
        const spGovVal = spZoneGovRate * _uda(p, spArea);
        landRateRows += `<tr>
          <td style="padding-left:16pt;font-style:italic;color:#2c5f9a">${esc(p.plotNo)} (${esc(sp.label) || "Zone"})</td>
          <td>${spArea.toFixed(3)}</td>
          <td>${_nativeStr(p, spArea)}</td>
          <td>${_ud(p, spArea)}</td>
          <td style="color:#1565c0">${spZoneGovRate ? spZoneGovRate.toLocaleString("en-NP", { minimumFractionDigits: 2 }) : "—"}</td>
          <td>${spCRate.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td>
          <td>${spFmvRate.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td>
        </tr>`;
        landValueRows += `<tr>
          <td style="padding-left:16pt;font-style:italic;color:#2c5f9a">${esc(p.plotNo)} (${esc(sp.label) || "Zone"})</td>
          <td>${_ud(p, spArea)}</td>
          <td style="color:#1565c0">${spZoneGovRate ? spGovVal.toLocaleString("en-NP", { minimumFractionDigits: 2 }) : "—"}</td>
          <td>${spCVal.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td>
          <td>${spFVal.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td>
          <td>${(Math.floor(spFVal * _distressMult / 100) * 100).toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td>
        </tr>`;
      });
      const cValR = Math.floor(plotCommTotal / 100) * 100;
      const fValR = Math.floor(plotFmvTotal / 100) * 100;
      const dValR = Math.floor(fValR * _distressMult / 100) * 100;
      totalLandCommercial += cValR;
      totalLandFMV += fValR;
      totalLandGov += gValR;
      landRateRows += `<tr class="subtotal-row">
        <td>${esc(p.plotNo)} — Sub-total</td>
        <td>${considered.toFixed(3)}</td>
        <td>${_nativeStr(p, considered)}</td>
        <td>${_ud(p, considered)}</td>
        <td style="color:#555;font-style:italic">—</td>
        <td colspan="2" style="text-align:center;font-style:italic">Multiple rates</td>
      </tr>`;
      landValueRows += `<tr class="subtotal-row">
        <td>${esc(p.plotNo)} — Sub-total</td>
        <td>${_ud(p, considered)}</td>
        <td style="color:#1565c0"><strong>${gVal.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</strong></td>
        <td><strong>${plotCommTotal.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</strong></td>
        <td><strong>${plotFmvTotal.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</strong></td>
        <td><strong>${(Math.floor(plotFmvTotal * _distressMult / 100) * 100).toLocaleString("en-NP", { minimumFractionDigits: 2 })}</strong></td>
      </tr>
      <tr class="rounded-row">
        <td colspan="2" style="font-size:9.5pt"><em>Rounded Down (nearest NPR 100)</em></td>
        <td style="color:#1565c0"><strong>NPR ${gValR.toLocaleString("en-NP")}</strong></td>
        <td><strong>NPR ${cValR.toLocaleString("en-NP")}</strong></td>
        <td><strong>NPR ${fValR.toLocaleString("en-NP")}</strong></td>
        <td><strong>NPR ${dValR.toLocaleString("en-NP")}</strong></td>
      </tr>`;
    } else {
      const r = s.rates?.[p.id] || {};
      const cRate = parseFloat(r.commercialRate) || 0;
      const govRate = parseFloat(r.govRate) || 0;
      const commW = parseFloat(r.commercialWeight) || 70;
      const govW = parseFloat(r.govWeight) || 30;
      const fmvRate = (cRate * commW / 100) + (govRate * govW / 100);
      const cVal = considered * cRate / _uf(p);
      const fVal = considered * fmvRate / _uf(p);
      const gVal = govRate * _uda(p, considered);
      const cValR = Math.floor(cVal / 100) * 100;
      const fValR = Math.floor(fVal / 100) * 100;
      const gValR = Math.floor(gVal / 100) * 100;
      const dValR = Math.floor(fValR * _distressMult / 100) * 100;
      totalLandCommercial += cValR;
      totalLandFMV += fValR;
      totalLandGov += gValR;
      landRateRows += `<tr>
        <td>${esc(p.plotNo)}</td>
        <td>${considered.toFixed(3)}</td>
        <td>${_nativeStr(p, considered)}</td>
        <td>${_ud(p, considered)}</td>
        <td style="color:#1565c0">${govRate.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td>
        <td>${cRate.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td>
        <td>${fmvRate.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td>
      </tr>`;
      landValueRows += `<tr>
        <td>${esc(p.plotNo)}</td>
        <td>${_ud(p, considered)}</td>
        <td style="color:#1565c0">${gVal.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td>
        <td>${cVal.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td>
        <td>${fVal.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td>
        <td>${(Math.floor(fVal * _distressMult / 100) * 100).toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td>
      </tr>
      <tr class="rounded-row">
        <td colspan="2" style="font-size:9.5pt"><em>Rounded Down (nearest NPR 100)</em></td>
        <td style="color:#1565c0"><strong>NPR ${gValR.toLocaleString("en-NP")}</strong></td>
        <td><strong>NPR ${cValR.toLocaleString("en-NP")}</strong></td>
        <td><strong>NPR ${fValR.toLocaleString("en-NP")}</strong></td>
        <td><strong>NPR ${dValR.toLocaleString("en-NP")}</strong></td>
      </tr>`;
    }
  });

  // ── 11. Building Valuation
  const bv = s.buildingVals || {};
  let totalBuildingValue = 0;
  const buildingValHTML = (s.buildings || []).map((b, i) => {
    const v = bv[b.id] || {};
    const floorRates = v.floorRates || {};
    const floorCalcs = (b.areaTable || []).map(row => {
      const area = parseFloat(row.areaActual) || 0;
      const rate = parseFloat(floorRates[row.id]) || 0;
      return { description: row.description || "—", area, rate, cost: area * rate };
    });
    const baseCost = floorCalcs.reduce((sum, f) => sum + f.cost, 0);
    const totalArea = floorCalcs.reduce((sum, f) => sum + f.area, 0);
    const sanCost = baseCost * (parseFloat(v.sanitaryPct) || 0) / 100;
    const elecCost = baseCost * (parseFloat(v.electricalPct) || 0) / 100;
    const finCost = baseCost * (parseFloat(v.finishingPct) || 0) / 100;
    const totalWithFix = baseCost + sanCost + elecCost + finCost;
    const age = parseFloat(b.ageOfBuilding) || 0;
    const depRate = parseFloat(v.depreciationRate) || 2.25;
    const totalDepPct = Math.min(100, age * depRate);
    const totalDep = totalWithFix * totalDepPct / 100;
    const actual = Math.max(0, totalWithFix - totalDep);
    const rounded = Math.floor(actual / 100) * 100;
    totalBuildingValue += rounded;
    const floorRows = floorCalcs.map(f => `
      <tr>
        <td>${esc(f.description)}</td>
        <td>${f.area.toFixed(2)}</td>
        <td>${f.rate.toLocaleString("en-NP")}</td>
        <td>${f.cost.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td>
      </tr>`).join("");
    return `<div class="sub-section-head">Building ${i + 1}${b.plotNo ? ` — Plot ${esc(b.plotNo)}` : ""}</div>
    <table>
      <thead><tr><th>Floor</th><th>Area (sq.ft)</th><th>Rate (NPR/sq.ft)</th><th>Floor Cost (NPR)</th></tr></thead>
      <tbody>
        ${floorRows}
        <tr class="total-row">
          <td colspan="3"><strong>Total Base Construction Cost</strong></td>
          <td><strong>${baseCost.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</strong></td>
        </tr>
      </tbody>
    </table>
    <table style="margin-top:4pt">
      <thead><tr><th>Description</th><th>Calculation</th><th>Amount (NPR)</th></tr></thead>
      <tbody>
        <tr><td>Total Base Construction Cost</td><td>${totalArea.toFixed(2)} sq.ft</td><td>${baseCost.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td></tr>
        <tr><td>Sanitary Cost</td><td>${parseFloat(v.sanitaryPct) || 0}% of base</td><td>${sanCost.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td></tr>
        <tr><td>Electrical Cost</td><td>${parseFloat(v.electricalPct) || 0}% of base</td><td>${elecCost.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td></tr>
        <tr><td>Finishing Cost</td><td>${parseFloat(v.finishingPct) || 0}% of base</td><td>${finCost.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td></tr>
        <tr class="subtotal-row"><td><strong>Total Cost (with fixtures)</strong></td><td></td><td><strong>${totalWithFix.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</strong></td></tr>
        <tr><td>Total Depreciation</td><td>${age} yr × ${depRate}% = ${totalDepPct.toFixed(2)}%</td><td>− ${totalDep.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</td></tr>
        <tr class="total-row"><td colspan="2"><strong>Actual Cost of Building (Depreciated)</strong></td><td><strong>NPR ${actual.toLocaleString("en-NP", { minimumFractionDigits: 2 })}</strong></td></tr>
        <tr class="rounded-row"><td><strong>Rounded Down (nearest NPR 100)</strong></td><td style="font-size:9.5pt;color:#555">floor(÷100)×100</td><td><strong>NPR ${rounded.toLocaleString("en-NP")}</strong></td></tr>
      </tbody>
    </table>`;
  }).join('<div class="divider"></div>');

  // ── 12. Summary Calculations
  const fmv = Math.floor((totalLandFMV + totalBuildingValue) / 100) * 100;
  const commercialVal = Math.floor((totalLandCommercial + totalBuildingValue) / 100) * 100;
  const distressMult = _distressMult;
  const distressVal = Math.floor(fmv * distressMult / 100) * 100;

  const totalGovLand = mortProps.reduce((sum, p) => {
    const r = (s.rates || {})[p.id] || {};
    const splits = (s.plotRateSplits || {})[p.id] || [];
    const gRate = splits.length > 0 ? (parseFloat(splits[0].govRate) || 0) : (parseFloat(r.govRate) || 0);
    const am = parseFloat((s.areaMeasured || {})[p.id]) || 0;
    const lSqm = propAreaSqm(p);
    const ded = parseFloat(((s.deductions || {})[p.id] || {}).area) || 0;
    const ca = Math.max(0, (am || lSqm) - ded);
    return sum + gRate * (ca / 31.795);
  }, 0);
  const finalGovVal = Math.floor(totalGovLand / 100) * 100;

  const hasBldg = (s.buildings || []).length > 0 && s.hasBuilding === true;

  // ── Site plan pages (landscape, before photos)
  const sitePlanPages = (() => {
    const plans = (s.sitePlans || []).filter(sp => sp && sp.dataUrl);
    if (!plans.length) return "";
    const docPages = plans.map((sp, i) => {
      const label = esc(sp.name || `Plan ${i + 1}`);
      const isImg = sp.dataUrl.startsWith("data:image");
      const rot = sp.rotation || 0;
      const inner = isImg
        ? `<img src="${sp.dataUrl}" class="plan-img" style="transform:rotate(${rot}deg);transform-origin:center center" alt="${label}"/>`
        : `<object data="${sp.dataUrl}" type="application/pdf" style="width:100%;height:100%;border:none;display:block"><p style="text-align:center;padding:20pt;color:#666;font-style:italic">${label} (PDF)</p></object>`;
      const cls = i === 0 ? "photo-page-first" : "photo-page";
      return `<div class="${cls}">` +
        `<div class="photo-page-header"><span>Site and Location Plan</span><span>${i + 1} / ${plans.length} &mdash; ${label}</span></div>` +
        `<div class="photo-grid-1"><div class="photo-cell">` +
        inner +
        `</div></div>` +
        `</div>`;
    }).join("");
    const sitePlanSep = `<div class="photo-sep"><div style="text-align:center"><div style="font-size:22pt;font-weight:bold;text-transform:uppercase;letter-spacing:4px;color:${T.primary};margin-bottom:12pt">Site and Location Plan</div><div style="width:60mm;height:2pt;background:${T.medium};margin:0 auto"></div></div></div>`;
    return sitePlanSep + docPages;
  })();

  // ── Photo pages (fixed: i += PER_PAGE)
  const photoPages = (() => {
    const photos = (s.photos || []).filter(p => p && (p.dataUrl || p.data));
    if (!photos.length) return "";
    const PER_PAGE = 4;
    const pages = [];
    for (let i = 0; i < photos.length; i += PER_PAGE) pages.push(photos.slice(i, i + PER_PAGE));
    const photoSep = `<div class="photo-sep"><div style="text-align:center"><div style="font-size:22pt;font-weight:bold;text-transform:uppercase;letter-spacing:4px;color:${T.primary};margin-bottom:12pt">Property Photographs</div><div style="width:60mm;height:2pt;background:${T.medium};margin:0 auto"></div></div></div>`;
    return photoSep + pages.map((group, pi) => {
      const cells = group.map((ph, ci) => {
        const num = pi * PER_PAGE + ci + 1;
        const capEsc = esc(ph.caption || ph.label || `Photo ${num}`);
        const src = ph.dataUrl || ph.data || "";
        return `<div class="photo-cell"><img src="${src}" class="photo-img" alt="${capEsc}"/><div class="photo-caption">${num}. ${capEsc}</div></div>`;
      }).join("");
      const cls = pi === 0 ? "photo-page-first" : "photo-page";
      return `<div class="${cls}">` +
        `<div class="photo-page-header"><span>Property Photographs</span><span>Page ${pi + 1} of ${pages.length}</span></div>` +
        `<div class="photo-grid-4">${cells}</div>` +
        `</div>`;
    }).join("");
  })();

  const autoScript = autoPrint
    ? `<script>window.addEventListener('load',function(){setTimeout(function(){window.focus();window.print();},600);});<\/script>`
    : "";

  const purifyScript = `<script>
  window.addEventListener('load', function() {
    if (typeof DOMPurify === 'undefined') return;
    document.querySelectorAll('td, p, li, span').forEach(function(el) {
      if (el.children.length === 0 && el.innerHTML !== el.textContent) {
        el.innerHTML = DOMPurify.sanitize(el.innerHTML, { ALLOWED_TAGS: ['strong','em','br','b','i'] });
      }
    });
  });
  <\/script>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'self' 'unsafe-inline' data: blob:; script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com;">
  <title>${suggestedFilename || "Preliminary Valuation Report"}</title>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/dompurify/3.0.6/purify.min.js"><\/script>
  <style>
    @page {
      size: A4 portrait;
      margin: 25mm 15mm 18mm 25mm;
    }
    @page portrait-p {
      size: A4 portrait;
      margin: 25mm 15mm 18mm 25mm;
      @bottom-left   { content: "Page " counter(page); font-family:"Times New Roman",Times,serif; font-size:8pt; color:#555; font-weight:bold; }
      @bottom-center { content: "Note:- ${(s.bank||"").replace(/"/g,"'").replace(/\\/g,"\\\\")}${s.branch ? " · "+(s.branch||"").replace(/"/g,"'").replace(/\\/g,"\\\\") : ""}"; font-family:"Times New Roman",Times,serif; font-size:7.5pt; color:#666; }
      @bottom-right  { content: "${(s.companyName||"").replace(/"/g,"'").replace(/\\/g,"\\\\")}"; font-family:"Times New Roman",Times,serif; font-size:7.5pt; color:#555; font-weight:bold; }
    }
    @page photo-p {
      size: A4 landscape;
      margin: 12mm 12mm 12mm 12mm;
      @bottom-left   { content: ""; }
      @bottom-center { content: ""; }
      @bottom-right  { content: ""; }
    }
    @media print {
      .no-print { display: none !important; }
      html, body {
        margin: 0 !important; padding: 0 !important;
        background: white !important;
        print-color-adjust: exact; -webkit-print-color-adjust: exact;
      }
      /* Portrait content — pin to printable width (210 − 25left − 15right) */
      .page {
        page: portrait-p;
        width: 170mm !important; max-width: 170mm !important;
        margin: 0 !important; padding: 0 !important;
        box-shadow: none !important; background: white !important;
        overflow: hidden !important;
      }
      table { table-layout: fixed !important; word-break: break-word; }
      td, th { overflow-wrap: break-word; word-break: break-word; }
      img { max-width: 100% !important; height: auto; }
      /*
        Landscape pages: CSS named pages (@page photo-p) change the page BOX
        but NOT the content layout width — content still inherits from body
        which is sized to the default portrait @page. Explicit width breaks out.
        Usable landscape width  = 297mm − 12mm−12mm margin = 273mm.
        Usable landscape height = 210mm − 12mm−12mm margin = 186mm.
        Header (~18pt) + gap (4pt) leaves ~180mm for the grid.
      */
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
        box-shadow: none !important; margin: 0 !important; padding: 0 !important;
        display: flex !important; flex-direction: column !important;
        overflow: hidden !important; box-sizing: border-box !important;
      }
      .photo-grid-4 { flex: 1 1 0 !important; min-height: 0 !important; display: grid !important; grid-template-columns: 1fr 1fr !important; grid-template-rows: 1fr 1fr !important; gap: 5pt !important; }
      .photo-grid-1 { flex: 1 1 0 !important; min-height: 0 !important; display: grid !important; grid-template-columns: 1fr !important; grid-template-rows: 1fr !important; gap: 0 !important; }
      .photo-cell { overflow: hidden !important; display: flex !important; flex-direction: column !important; }
      .photo-img { width: 100% !important; height: 100% !important; object-fit: cover !important; display: block !important; flex: 1 !important; min-height: 0 !important; }
      .plan-img { width: 100% !important; height: 100% !important; object-fit: contain !important; display: block !important; flex: 1 !important; min-height: 0 !important; }
    }

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: "Times New Roman", Times, serif; font-size: 11pt; line-height: 1.3; color: #111; background: #e8e8e8; }
    .page { max-width: 165mm; margin: 0 auto; background: white; }

    .no-print {
      display: flex; align-items: center; gap: 10px; padding: 10px 20px;
      background: #5b9bd5; color: #fff; font-family: Arial, sans-serif; font-size: 13px;
      position: sticky; top: 0; z-index: 9999; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
    }
    .no-print button { padding: 7px 18px; border: none; border-radius: 4px; font-weight: 700; cursor: pointer; font-size: 13px; }
    .no-print .btn-print { background: #c9a227; color: #fff; }
    .no-print .btn-close { background: rgba(255,255,255,0.15); color: #fff; border: 1px solid rgba(255,255,255,0.3); }

    .cover-header {
      text-align: center; border-top: 2pt solid ${T.medium}; border-bottom: 1pt solid ${T.border};
      padding: 6pt 0 6pt; margin-bottom: 8pt;
    }
    .cover-header .bank-name { font-size: 10.5pt; font-weight: bold; letter-spacing: 1.5px; text-transform: uppercase; color: ${T.primary}; margin-bottom: 4pt; }
    .cover-header h1 { font-size: 15pt; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; color: #222; margin-bottom: 5pt; }
    .badge { display: inline-block; border: 1pt solid ${T.medium}; padding: 2pt 18pt; font-size: 10pt; font-weight: bold; letter-spacing: 3px; text-transform: uppercase; color: ${T.primary}; background: ${T.light}; }
    .cover-dates { margin-top: 6pt; font-size: 10pt; color: #555; }

    .sec-h3 {
      font-size: 10pt; font-weight: bold; color: ${T.primary}; background: ${T.light};
      padding: 2pt 6pt 2pt 8pt; margin: 5pt 0 2pt;
      text-transform: uppercase; letter-spacing: 0.5px;
      page-break-after: avoid;
      border-left: 4pt solid ${T.medium};
      border-bottom: 1pt solid ${T.border};
    }
    .sec-num { display: inline-block; background: none; color: ${T.primary}; font-size: 10pt; font-weight: bold; padding: 0 3pt 0 0; margin-right: 3pt; }
    .sub-section-head { font-size: 10pt; font-weight: bold; margin: 4pt 0 2pt; padding-bottom: 1pt; border-bottom: 1pt solid ${T.border}; color: ${T.primary}; page-break-after: avoid; break-after: avoid; }
    .sub-label { font-size: 10pt; font-weight: bold; margin: 4pt 0 2pt; color: ${T.primary}; padding-left: 4pt; border-left: 3pt solid ${T.medium}; page-break-after: avoid; break-after: avoid; }
    .divider { border-top: 1pt dashed ${T.border}; margin: 3pt 0; }

    table { width: 100%; border-collapse: collapse; margin-bottom: 3pt; font-size: 10pt; font-family: "Times New Roman", Times, serif; }
    th { background: ${T.lighter}; color: ${T.dark}; padding: 3pt 4pt; text-align: left; font-size: 9pt; font-weight: bold; text-transform: uppercase; letter-spacing: 0.3px; border: 0.75pt solid ${T.border}; border-bottom: 1.5pt solid ${T.medium}; }
    th.v { writing-mode: vertical-lr; transform: rotate(180deg); white-space: nowrap; vertical-align: bottom; padding: 6pt 3pt 3pt; height: 80pt; min-height: 80pt; text-align: left; font-size: 9pt; font-weight: bold; overflow: visible; background: ${T.lighter}; color: ${T.dark}; border: 0.5pt solid ${T.border}; border-bottom: 1.5pt solid ${T.medium}; letter-spacing: 0.3px; }
    th.th-light { background: ${T.lighter}; color: ${T.dark}; border: 0.75pt solid ${T.border}; border-bottom: 1.5pt solid ${T.medium}; font-size: 8.5pt; white-space: normal; vertical-align: middle; padding: 2pt 4pt; text-transform: none; letter-spacing: 0; }
    td { padding: 2pt 4pt; border: 0.75pt solid ${T.border}; vertical-align: top; }
    tr:nth-child(even) td { background: ${T.row}; }
    .info-table td { border: 0.75pt solid ${T.border}; font-size: 10.5pt; }
    .info-table td:nth-child(odd) { background: ${T.info}; font-weight: bold; width: 20%; font-size: 9.5pt; text-transform: uppercase; color: ${T.primary}; }
    .total-row td { background: ${T.total} !important; color: #fff !important; font-weight: bold; border-top: 2pt solid ${T.medium}; font-size: 11pt; }
    .subtotal-row td { background: ${T.lighter} !important; font-weight: bold; border-top: 1pt solid ${T.border}; color: ${T.dark}; }
    .rounded-row td { background: #e8f5ee !important; font-weight: bold; color: #2e7d52; }
    .cell-hl { font-weight: bold; color: ${T.primary}; }
    .empty-cell { font-style: italic; color: #aac; text-align: center; }
    .tbl-v { table-layout: auto !important; }
    .tbl-v td { padding: 3pt 5pt; font-size: 10pt; vertical-align: top; word-break: break-word; border: 0.5pt solid ${T.border}; }
    .tbl-v tr:nth-child(odd)  td { background: #fff; }
    .tbl-v tr:nth-child(even) td { background: ${T.row}; }
    .tbl-v td:first-child { font-weight: bold; color: ${T.primary}; text-align: center; white-space: nowrap; }
    .tbl-v td:nth-child(2) { white-space: nowrap; text-align: center; }
    .tbl-v td:nth-child(3) { white-space: nowrap; }
    .tbl-v td:nth-child(4) { text-align: right; white-space: nowrap; }
    .tbl-v td:nth-child(5) { text-align: center; font-family: monospace; font-size: 9pt; white-space: nowrap; }
    .tbl-v td:nth-child(6) { min-width: 65pt; }
    .tbl-v td:nth-child(7) { min-width: 80pt; overflow-wrap: anywhere; word-break: break-word; }
    .tbl-v td:nth-child(8) { min-width: 90pt; overflow-wrap: anywhere; word-break: break-word; }

    .summary-box { border: 1pt solid ${T.border}; padding: 5pt; margin: 3pt 0; page-break-inside: avoid; }
    .summary-box h4 { font-size: 10pt; font-weight: bold; text-align: center; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 4pt; border-bottom: 1pt solid ${T.border}; padding-bottom: 2pt; color: ${T.primary}; }
    .sum-card { border: 1pt solid; border-radius: 2pt; padding: 4pt 6pt; page-break-inside: avoid; }
    .sum-card-title { font-weight: bold; font-size: 9pt; text-transform: uppercase; letter-spacing: 0.3px; margin-bottom: 2pt; }
    .sum-card-row { display: flex; justify-content: space-between; font-size: 9pt; padding: 1pt 0; border-bottom: 0.5pt dashed rgba(0,0,0,0.10); }
    .sum-card-total { font-weight: bold; font-size: 12pt; margin-top: 3pt; }
    .sum-card-words { font-size: 8pt; font-style: italic; margin-top: 2pt; line-height: 1.25; }
    .vc-comm { background: #eef8f0; border-color: #80c898; color: #2a6e42; }
    .vc-fmv  { background: #fdf6ee; border-color: #d4a96a; color: #7a5020; }
    .vc-dist { background: #fff0f0; border-color: #e8a0a2; color: #8b2020; }
    .vc-gov  { background: ${T.light}; border-color: ${T.medium}; color: ${T.dark}; }

    .remarks-box { border: 1pt solid ${T.border}; padding: 4pt; min-height: 24pt; white-space: pre-wrap; font-size: 11pt; margin-bottom: 3pt; }
    .sig-block { display: flex; justify-content: flex-end; margin-top: 12pt; page-break-inside: avoid; }
    .sig-card { text-align: center; font-size: 10pt; line-height: 1.5; min-width: 160pt; }
    .sig-line { border-top: 1pt solid #888; padding-top: 4pt; margin-top: 18pt; }
    .disclaimer { font-size: 9pt; color: #666; font-style: italic; border-top: 0.5pt solid #cfe0f0; padding-top: 5pt; margin-top: 8pt; }

    .photo-page { page: photo-p; page-break-before: always; break-before: page; page-break-inside: avoid; break-inside: avoid; width: 100%; display: flex; flex-direction: column; }
    .photo-page-first { page: photo-p; page-break-before: avoid; break-before: avoid; page-break-inside: avoid; break-inside: avoid; width: 100%; display: flex; flex-direction: column; }
    .photo-sep  { page: photo-p; page-break-before: always; break-before: page; display: flex; align-items: center; justify-content: center; min-height: 186mm; }
    .photo-page-header { display: flex; justify-content: space-between; align-items: center; font-size: 10pt; font-weight: bold; border-top: 1.5pt solid ${T.medium}; border-bottom: 0.75pt solid ${T.border}; padding: 3pt 0; margin-bottom: 5pt; color: ${T.primary}; text-transform: uppercase; letter-spacing: 0.4px; flex-shrink: 0; }
    .photo-grid-4 { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 5pt; flex: 1; min-height: 0; }
    .photo-grid-1 { display: grid; grid-template-columns: 1fr; grid-template-rows: 1fr; flex: 1; min-height: 0; }
    .photo-cell { display: flex; flex-direction: column; border: 0.75pt solid ${T.border}; overflow: hidden; background: ${T.row}; page-break-inside: avoid; }
    .photo-cell-empty { background: #eef5fb !important; border: 0.75pt dashed #c0d8ef !important; }
    .photo-img { flex: 1; width: 100%; object-fit: cover; display: block; min-height: 0; }
    .plan-img { flex: 1; width: 100%; height: 100%; object-fit: contain; display: block; min-height: 0; }
    .photo-caption { font-size: 8.5pt; font-style: italic; text-align: center; padding: 2pt 4pt; background: #e8f3fb; border-top: 0.5pt solid #c0d8ef; color: #3a6ea8; flex-shrink: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    @media screen {
      body { padding: 10px 0; }
      .page { max-width: 170mm; margin: 0 auto; padding: 8mm 10mm; box-shadow: 0 2px 16px rgba(0,0,0,0.18); }
      .photo-page, .photo-page-first { background: white; width: 273mm; max-width: 273mm; margin: 20px auto; padding: 12mm; box-shadow: 0 2px 12px rgba(0,0,0,0.12); box-sizing: border-box; }
      .photo-sep { background: white; width: 273mm; max-width: 273mm; margin: 20px auto; padding: 12mm; box-shadow: 0 2px 12px rgba(0,0,0,0.12); box-sizing: border-box; min-height: 186mm; }
      .photo-grid-4 { display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: auto auto; gap: 8pt; }
      .photo-grid-1 { display: grid; grid-template-columns: 1fr; grid-template-rows: 1fr; }
      .photo-cell { height: 220px; }
      .photo-grid-1 .photo-cell { height: 500px; }
      .photo-img { height: 100%; object-fit: cover; }
      .plan-img { width: 100%; height: 100%; object-fit: contain; display: block; }
    }
    .page-break { page-break-before: always; }
    .no-break { page-break-inside: avoid; }
    p { margin-bottom: 2pt; margin-top: 0; }
    .page-footer { display: flex; align-items: center; justify-content: space-between; margin-top: 12pt; padding-top: 5pt; border-top: 0.5pt solid #bbb; font-family: "Times New Roman", Times, serif; font-size: 8pt; color: #666; }
  </style>
</head>
<body>

<div class="no-print">
  <span style="font-weight:600;flex:1">&#128196; ${esc(suggestedFilename, "Preliminary Valuation Report")}</span>
  <button class="btn-print" onclick="window.print()">&#128438; Print / Save as PDF &nbsp;(Ctrl+P)</button>
  <button class="btn-close" onclick="window.close()">&#10005; Close</button>
</div>

<div class="page">

<div class="cover-header">
  <div class="bank-name">${esc(s.bank, "Bank Name")}${s.branch ? " &mdash; " + esc(s.branch) : ""}</div>
  <h1>Property Valuation Report</h1>
  <div class="badge">Preliminary Report</div>
  <div class="cover-dates">
    Field Visit: <strong>${esc(s.visitDate)}</strong>
    &emsp;|&emsp;
    Report Date: <strong>${esc(s.reportDate)}</strong>
  </div>
</div>

<h3 class="sec-h3"><span class="sec-num">1</span>Bank Name and Branch</h3>
<table class="info-table">
  <tr><td>Bank</td><td>${esc(s.bank)}</td><td>Branch</td><td>${esc(s.branch)}</td></tr>
</table>

<h3 class="sec-h3"><span class="sec-num">2</span>General Information</h3>

<div class="sub-label">2.1 &nbsp;${clientLabel}'s Information</div>
${clientsHTML || `<p style="font-style:italic;color:#aaa">No ${clientLabel.toLowerCase()} information entered.</p>`}

<div class="sub-label" style="margin-top:5pt">2.2 &nbsp;${ownerLabel}'s Information</div>
${ownersInfoHTML || `<p style="font-style:italic;color:#aaa">No ${ownerLabel.toLowerCase()} information entered.</p>`}

<div class="sub-label" style="margin-top:5pt">2.3 &nbsp;Detail of Property Information</div>
<table class="tbl-v" style="table-layout:auto;width:100%">
  <thead>
    <tr>
      <th class="th-light" rowspan="2" style="vertical-align:middle;text-align:center">Plot No.</th>
      <th class="th-light" rowspan="2" style="vertical-align:middle;text-align:center">Trace Sheet</th>
      <th class="th-light" rowspan="2" style="vertical-align:middle;text-align:center">Land Type</th>
      <th class="th-light" colspan="2" style="text-align:center;border-bottom:0.5pt solid ${T.border}">Area (Lalpurja)</th>
      <th class="th-light" rowspan="2" style="vertical-align:middle;text-align:center">Owner Name</th>
      <th class="th-light" rowspan="2" style="vertical-align:middle;text-align:center;min-width:80pt">Addr. (Lalpurja)</th>
      <th class="th-light" rowspan="2" style="vertical-align:middle;text-align:center;min-width:90pt">Present Address</th>
    </tr>
    <tr>
      <th class="th-light" style="text-align:right">sq.m</th>
      <th class="th-light" style="text-align:center">${allPropNativeHdr}</th>
    </tr>
  </thead>
  <tbody>${propDetailRows || `<tr><td colspan="8" class="empty-cell">No property data</td></tr>`}</tbody>
</table>

<div class="sub-label" style="margin-top:5pt">2.4 &nbsp;Location Maps</div>
${(() => {
    const _groups = [];
    const _keys = new Map();
    (s.properties || []).forEach(p => {
      const lat = parseFloat(p.lat), lng = parseFloat(p.lng);
      const hasCoords = !isNaN(lat) && !isNaN(lng);
      const snap = mapSnapshots[p.id] || {};
      const hasMap = hasCoords || snap.z15 || snap.z18;
      let key;
      if (p.googlePlusCode && p.googlePlusCode.trim()) key = 'plus:' + p.googlePlusCode.trim();
      else if (hasCoords) key = 'coords:' + lat.toFixed(4) + ',' + lng.toFixed(4);
      else key = 'nomap';
      if (_keys.has(key)) { _keys.get(key).props.push(p); }
      else { const g={key,props:[p]}; _keys.set(key,g); _groups.push(g); }
    });
    const _badges = (props) => props.map(p=>'<span style="display:inline-block;background:#2c5f9a;color:#fff;font-size:8.5pt;font-weight:bold;padding:2pt 6pt;border-radius:3pt;margin:1pt 2pt 1pt 0">' + (p.plotNo||'—') + '</span>').join('');
    return _groups.map(({key, props}) => {
      const rep = props[0];
      const lat = parseFloat(rep.lat), lng = parseFloat(rep.lng);
      const hasCoords = !isNaN(lat) && !isNaN(lng);
      const gmUrl = hasCoords ? `https://www.google.com/maps?q=${lat.toFixed(6)},${lng.toFixed(6)}` : "";
      const snap = mapSnapshots[rep.id] || {};
      const multiPlot = props.length > 1;
      const plotLabel = props.map(p=>p.plotNo||'—').join(', ');
      if (key === 'nomap') {
        return (
          '<div style="page-break-inside:avoid;break-inside:avoid;margin-bottom:4pt">' +
          '<p style="font-weight:bold;font-size:10.5pt;margin-bottom:4pt;color:#2c5f9a">Plot No. ' + plotLabel + '</p>' +
          '<div style="display:flex;align-items:center;justify-content:center;min-height:60pt;border:1pt solid #ddd;border-radius:4pt;background:#fafafa;text-align:center;padding:12pt">' +
            '<div>' +
              '<div style="margin-bottom:5pt">' + _badges(props) + '</div>' +
              (multiPlot ? '<div style="font-size:9pt;color:#555;margin-bottom:3pt">Plot Nos: <strong>' + plotLabel + '</strong></div>' : '') +
              '<div style="font-size:8.5pt;color:#aaa;margin-top:4pt;font-style:italic">Location map not attached</div>' +
            '</div>' +
          '</div>' +
          '</div>'
        );
      }
      const plusCode = rep.googlePlusCode || '';
      const location = rep.location || '';
      return (
        '<div style="page-break-inside:avoid;break-inside:avoid;page-break-before:auto;margin-bottom:4pt">' +
        '<p style="font-weight:bold;font-size:10.5pt;margin-bottom:3pt;color:#2c5f9a">' +
          'Plot No. ' + plotLabel +
          (location ? ' &nbsp;|&nbsp; ' + location : '') +
          (plusCode ? ' &nbsp;|&nbsp; Plus Code: ' + plusCode : '') +
        '</p>' +
        (multiPlot ? '<p style="font-size:9pt;color:#555;margin-bottom:4pt">Plots at this location: ' + _badges(props) + '</p>' : '') +
        '<table class="info-table" style="margin-bottom:5pt"><tr>' +
          '<td>Latitude</td><td>' + (hasCoords ? lat.toFixed(6) : '—') + '</td>' +
          '<td>Longitude</td><td>' + (hasCoords ? lng.toFixed(6) : '—') + '</td>' +
          (hasCoords ? '<td><a href="' + gmUrl + '" style="color:#2c5f9a;font-weight:bold">View in Google Maps</a></td>' : '<td>—</td>') +
        '</tr></table>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8pt">' +
          '<div>' +
            '<p style="font-size:8.5pt;font-weight:bold;margin-bottom:3pt;padding:2pt 6pt;background:#eef2f9;border-left:3pt solid #7aa8d8;color:#2c5f9a">Overview (Area Context)</p>' +
            (snap.z15
              ? '<img src="' + snap.z15 + '" style="width:100%;max-height:80mm;object-fit:cover;border:1pt solid #bbb;display:block" alt="Overview map"/>'
              : '<div style="padding:14pt;border:1pt solid #ddd;text-align:center;font-style:italic;color:#aaa;background:#fafafa;font-size:9pt">Map not available &mdash; <a href="' + gmUrl + '" style="color:#2c5f9a">Google Maps</a></div>') +
            '<p style="font-size:7.5pt;color:#aaa;text-align:right;margin-top:1pt;font-style:italic">© OpenStreetMap contributors</p>' +
          '</div>' +
          '<div>' +
            '<p style="font-size:8.5pt;font-weight:bold;margin-bottom:3pt;padding:2pt 6pt;background:#eef2f9;border-left:3pt solid #7aa8d8;color:#2c5f9a">Detail (Property Location)</p>' +
            (snap.z18
              ? '<img src="' + snap.z18 + '" style="width:100%;max-height:80mm;object-fit:cover;border:1pt solid #bbb;display:block" alt="Detail map"/>'
              : '<div style="padding:14pt;border:1pt solid #ddd;text-align:center;font-style:italic;color:#aaa;background:#fafafa;font-size:9pt">Map not available &mdash; <a href="' + gmUrl + '" style="color:#2c5f9a">Google Maps</a></div>') +
            '<p style="font-size:7.5pt;color:#aaa;text-align:right;margin-top:1pt;font-style:italic">© OpenStreetMap contributors</p>' +
          '</div>' +
        '</div>' +
        '</div>'
      );
    }).join('<div class="divider"></div>') || `<p style="font-style:italic;color:#aaa">No property data.</p>`;
  })()}

<div class="sub-label" style="margin-top:5pt">2.5 &nbsp;Hazards / Encumbrances</div>
<table>
  <thead><tr><th style="text-align:center;width:30pt">SN</th><th>Plot No.</th><th>Associated Hazards / Encumbrances</th><th>Not Associated</th><th style="text-align:center">Minimum Requirement</th></tr></thead>
  <tbody>${hazardRows}</tbody>
</table>

<div class="sub-label" style="margin-top:5pt">2.6 &nbsp;Mode &amp; Date of Transfer</div>
<table>
  <thead><tr>
    <th style="text-align:center;width:30pt">SN</th>
    <th>Plot No.</th>
    <th>Mode of Transfer</th>
    <th>Transfer Date (BS)</th>
    <th>Duration (YY-MM-DD)</th>
  </tr></thead>
  <tbody>${(s.properties || []).map((p, pi) => {
    const dur = transferDuration(p.transferDate);
    const durFmt = dur ? dur.replace(/Y /,"Y ").replace(/M /,"M ").replace(/D/,"D") : "—";
    return `<tr>
      <td style="text-align:center">${pi + 1}</td>
      <td style="white-space:nowrap">${esc(p.plotNo)}</td>
      <td>${esc(p.modeOfTransfer) || "—"}</td>
      <td style="white-space:nowrap">${esc(p.transferDate) || "—"}</td>
      <td style="white-space:nowrap">${durFmt}</td>
    </tr>`;
  }).join("") || `<tr><td colspan="5" class="empty-cell">No transfer data</td></tr>`}</tbody>
</table>

<h3 class="sec-h3"><span class="sec-num">3</span>Area to Be Mortgaged</h3>
<table>
  <thead><tr><th>Plot No.</th><th>Trace Sheet No.</th><th>Owner Name</th><th>Area (Lalpurja)</th><th>sq.m</th><th>As Per Measurement (sq.m)</th></tr></thead>
  <tbody>${mortAreaRows || `<tr><td colspan="6" class="empty-cell">No mortgaged properties selected</td></tr>`}</tbody>
</table>

<h3 class="sec-h3"><span class="sec-num">4</span>Deduction Declaration</h3>
<table>
  <thead><tr><th>Plot No.</th><th>Dimension</th><th>Deduction Area (sq.m)</th><th>Reason / Remarks</th></tr></thead>
  <tbody>${deductionRows || `<tr><td colspan="4" class="empty-cell">No deductions</td></tr>`}</tbody>
</table>

<h3 class="sec-h3"><span class="sec-num">5</span>Considered Area for Valuation</h3>
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
      <th style="min-width:52pt">${nativeHdr}</th>
      <th>Sq.m</th>
      <th>Sq.M</th>
      <th>Sq.M</th>
      <th style="min-width:52pt">${nativeHdr}</th>
      <th>${unitHdr}</th>
    </tr>
  </thead>
  <tbody>${consideredRows || `<tr><td colspan="8" class="empty-cell">No data</td></tr>`}</tbody>
</table>

<h3 class="sec-h3"><span class="sec-num">6</span>Access to Property</h3>
<table>
  <thead><tr><th>Plot No.</th><th>Type of Road</th><th>Frontage of Plot</th><th>Width (Field)</th><th>Width (Trace)</th><th>Remarks</th></tr></thead>
  <tbody>${roadAccessHTML || `<tr><td colspan="6" class="empty-cell">No road access data</td></tr>`}</tbody>
</table>

<h3 class="sec-h3"><span class="sec-num">7</span>Boundary Declaration</h3>
<table>
  <thead><tr><th>Plot No.</th><th>East</th><th>West</th><th>North</th><th>South</th><th>Remarks</th></tr></thead>
  <tbody>${boundaryRows || `<tr><td colspan="6" class="empty-cell">No boundary data</td></tr>`}</tbody>
</table>

${s.hasBuilding === false || (!s.hasBuilding && !(s.buildings || []).length)
  ? ``
  : `<h3 class="sec-h3"><span class="sec-num">8</span>Building Detail</h3>
${s.hasBuilding === "skip"
  ? `<p style="font-style:italic;color:#e67e22;border:1pt solid #e67e22;padding:8pt">Building exists on this property but valuation has not been carried out.</p>`
  : buildingDetailHTML}`}

<h3 class="sec-h3"><span class="sec-num">9</span>Valuation of Land</h3>
<p style="font-weight:bold;font-size:9.5pt;margin:4pt 0 2pt">9A. Land Rates per ${unitHdr}</p>
<table>
  <thead><tr>
    <th class="th-light">Plot No.</th>
    <th class="th-light">Considered (sq.m)</th>
    <th class="th-light" style="min-width:52pt">${nativeHdr}</th>
    <th class="th-light">${unitHdr}</th>
    <th class="th-light" style="color:#1565c0">Govt. Rate (NPR/${unitHdr})</th>
    <th class="th-light">Commercial Rate (NPR/${unitHdr})</th>
    <th class="th-light">FMV Rate (NPR/${unitHdr})</th>
  </tr></thead>
  <tbody>
    ${landRateRows || `<tr><td colspan="7" class="empty-cell">No data</td></tr>`}
  </tbody>
</table>
<p style="font-weight:bold;font-size:9.5pt;margin:8pt 0 2pt">9B. Value of Property</p>
<table>
  <thead><tr>
    <th class="th-light">Plot No.</th>
    <th class="th-light">${unitHdr}</th>
    <th class="th-light" style="color:#1565c0">Govt. Value (NPR)</th>
    <th class="th-light">Commercial Value (NPR)</th>
    <th class="th-light">FMV Value (NPR)</th>
    <th class="th-light">Distress Value (${Math.round(_distressMult * 100)}% of FMV)</th>
  </tr></thead>
  <tbody>
    ${landValueRows || `<tr><td colspan="6" class="empty-cell">No data</td></tr>`}
    <tr class="total-row">
      <td colspan="2"><strong>TOTAL LAND VALUE (Rounded Down)</strong></td>
      <td style="color:#1565c0"><strong>NPR ${totalLandGov.toLocaleString("en-NP")}</strong></td>
      <td><strong>NPR ${totalLandCommercial.toLocaleString("en-NP")}</strong></td>
      <td><strong>NPR ${totalLandFMV.toLocaleString("en-NP")}</strong></td>
      <td><strong>NPR ${(Math.floor(totalLandFMV * _distressMult / 100) * 100).toLocaleString("en-NP")}</strong></td>
    </tr>
  </tbody>
</table>

${hasBldg
  ? `<h3 class="sec-h3"><span class="sec-num">10</span>Valuation of Building</h3>
${buildingValHTML}
<table style="margin-top:6pt;page-break-before:avoid;break-before:avoid"><tbody>
  <tr class="total-row"><td><strong>TOTAL BUILDING VALUE (Rounded Down)</strong></td><td style="text-align:right"><strong>NPR ${totalBuildingValue.toLocaleString("en-NP")}</strong></td></tr>
</tbody></table>`
  : s.hasBuilding === "skip"
    ? `<h3 class="sec-h3"><span class="sec-num">10</span>Valuation of Building</h3>
<p style="font-style:italic;color:#e67e22;border:1pt solid #e67e22;padding:8pt">Building exists but valuation has not been carried out.</p>`
    : ``}

<div style="page-break-before:always;break-before:page">

<h3 class="sec-h3" style="margin-top:0"><span class="sec-num">11</span>Valuation Summary</h3>
<div class="summary-box">
  <h4>Summary of Property Valuation</h4>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:6pt">

    <!-- A: Commercial -->
    <div class="sum-card vc-comm">
      <div class="sum-card-title">A. Commercial Value of Property</div>
      ${hasBldg ? `<div class="sum-card-row"><span>Land</span><span>NPR ${totalLandCommercial.toLocaleString("en-NP")}</span></div><div class="sum-card-row"><span>Building</span><span>NPR ${totalBuildingValue.toLocaleString("en-NP")}</span></div>` : ""}
      <div class="sum-card-total">NPR ${commercialVal.toLocaleString("en-NP")}</div>
      <div class="sum-card-words">In Words: Nepalese Rupees ${toWords(commercialVal)} Only</div>
    </div>

    <!-- B: FMV -->
    <div class="sum-card vc-fmv">
      <div class="sum-card-title">B. Fair Market Value (FMV)</div>
      ${hasBldg ? `<div class="sum-card-row"><span>Land</span><span>NPR ${totalLandFMV.toLocaleString("en-NP")}</span></div><div class="sum-card-row"><span>Building</span><span>NPR ${totalBuildingValue.toLocaleString("en-NP")}</span></div>` : ""}
      <div class="sum-card-total">NPR ${fmv.toLocaleString("en-NP")}</div>
      <div class="sum-card-words">In Words: Nepalese Rupees ${toWords(fmv)} Only</div>
    </div>

    <!-- C: Distress -->
    <div class="sum-card vc-dist">
      <div class="sum-card-title">C. Distress Value (${Math.round(distressMult * 100)}% of FMV)</div>
      ${hasBldg ? `<div class="sum-card-row"><span>Land (${Math.round(distressMult * 100)}%)</span><span>NPR ${(Math.floor(totalLandFMV * distressMult / 100) * 100).toLocaleString("en-NP")}</span></div><div class="sum-card-row"><span>Building (${Math.round(distressMult * 100)}%)</span><span>NPR ${(Math.floor(totalBuildingValue * distressMult / 100) * 100).toLocaleString("en-NP")}</span></div>` : ""}
      <div class="sum-card-total">NPR ${distressVal.toLocaleString("en-NP")}</div>
      <div class="sum-card-words">In Words: Nepalese Rupees ${toWords(distressVal)} Only</div>
    </div>

    <!-- D: Government (if applicable) -->
    ${finalGovVal > 0
      ? `<div class="sum-card vc-gov">
          <div class="sum-card-title">D. Government Value of Land</div>
          <div class="sum-card-total">NPR ${finalGovVal.toLocaleString("en-NP")}</div>
          <div class="sum-card-words">In Words: Nepalese Rupees ${toWords(finalGovVal)} Only</div>
        </div>`
      : `<div></div>`}

  </div>
</div>

<h3 class="sec-h3" style="margin-top:8pt"><span class="sec-num">12</span>Limiting Conditions and Remarks</h3>
<p style="font-weight:bold;margin:4pt 0 2pt">Remarks:</p>
<div class="remarks-box" style="min-height:20pt">${esc(s.remarks)}</div>
${s.includeLimitingConditions ? `<p style="font-weight:bold;margin:4pt 0 2pt">Limiting Conditions:</p>
<div class="remarks-box" style="min-height:20pt;font-weight:bold">${esc(s.limitingConditions)}</div>` : ""}

<div class="sig-block">
  <div class="sig-card">
    <div style="font-weight:bold">For ${esc(vi.company, "Neo-Civic Consulting (P). Ltd")}</div>
    <div class="sig-line">
      <div style="font-weight:bold">${esc(vi.name, "Er. Saakar Rimal")}</div>
      <div>NEC Reg. No.: ${esc(vi.licenseNo, "11518 Civil “A”")}</div>
      ${vi.phone ? `<div style="font-size:10pt">Tel. ${esc(vi.phone)}</div>` : ""}
      ${vi.email ? `<div style="font-size:10pt">Email: ${esc(vi.email)}</div>` : ""}
    </div>
  </div>
</div>

<p class="disclaimer">
  Report Type: PRELIMINARY &nbsp;|&nbsp;
  Generated: ${new Date().toLocaleDateString("en-NP", { year: "numeric", month: "long", day: "numeric" })} &nbsp;|&nbsp;
  ${suggestedFilename || ""} &nbsp;|&nbsp;
  This report is prepared for the sole use of ${esc(s.bank, "the Bank")} and may not be used for any other purpose.
</p>

</div><!-- end sec12+13 page -->

</div>

${sitePlanPages}

${purifyScript}${autoScript}
</body>
</html>`;
}
