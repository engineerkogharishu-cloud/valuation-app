// ─── Area Conversion Helpers ──────────────────────────────────────────────────
// Ropani system (hilly Nepal): 1 Ropani = 16 Aana, 1 Aana = 4 Paisa, 1 Paisa = 4 Dam
// 1 Ropani = 508.72 sqm  (standard GoN value)
export const ROPANI_TO_SQM = 508.72;
export const AANA_TO_SQM   = ROPANI_TO_SQM / 16;   // 31.795
export const PAISA_TO_SQM  = AANA_TO_SQM   / 4;    //  7.949
export const DAM_TO_SQM    = PAISA_TO_SQM  / 4;    //  1.987

// Bigha-Kattha-Dhur system (Terai Nepal): 1 Bigha = 20 Kattha, 1 Kattha = 20 Dhur
// 1 Bigha = 6772.63 sqm  (standard GoN value)
export const BIGHA_TO_SQM  = 6772.63;
export const KATTHA_TO_SQM = BIGHA_TO_SQM / 20;    // 338.6315
export const DHUR_TO_SQM   = KATTHA_TO_SQM / 20;   //  16.93158

export function bkdToSqm({ b=0, k=0, d=0 }) {
  return (parseFloat(b)||0)*BIGHA_TO_SQM + (parseFloat(k)||0)*KATTHA_TO_SQM + (parseFloat(d)||0)*DHUR_TO_SQM;
}

export function sqmToBkd(sqm) {
  let rem = parseFloat(sqm)||0;
  const b = Math.floor(rem / BIGHA_TO_SQM); rem -= b * BIGHA_TO_SQM;
  const k = Math.floor(rem / KATTHA_TO_SQM); rem -= k * KATTHA_TO_SQM;
  const d = rem / DHUR_TO_SQM; // decimal — caller formats to desired precision
  return { b, k, d };
}

export function sqmToDhur(sqm) { return (parseFloat(sqm)||0) / DHUR_TO_SQM; }

export function radpToSqm({ r=0, a=0, p=0, d=0 }) {
  return (parseFloat(r)||0)*ROPANI_TO_SQM
       + (parseFloat(a)||0)*AANA_TO_SQM
       + (parseFloat(p)||0)*PAISA_TO_SQM
       + (parseFloat(d)||0)*DAM_TO_SQM;
}

export function sqmToRadp(sqm) {
  let rem = parseFloat(sqm)||0;
  const r = Math.floor(rem / ROPANI_TO_SQM); rem -= r * ROPANI_TO_SQM;
  const a = Math.floor(rem / AANA_TO_SQM);   rem -= a * AANA_TO_SQM;
  const p = Math.floor(rem / PAISA_TO_SQM);  rem -= p * PAISA_TO_SQM;
  const d = Math.floor(rem / DAM_TO_SQM);
  return { r, a, p, d };
}

export function sqmToAana(sqm) { return (parseFloat(sqm)||0) / AANA_TO_SQM; }
export function aanaToSqm(a)   { return (parseFloat(a)||0) * AANA_TO_SQM; }

// Get total sqm from a property's area fields
export function propAreaSqm(prop) {
  if (prop.areaUnit === "sqm")  return parseFloat(prop.areaSqm)||0;
  if (prop.areaUnit === "radp") return radpToSqm(prop.areaRadp||{});
  if (prop.areaUnit === "bkd")  return bkdToSqm(prop.areaBkd||{});
  return 0;
}

// Display string for area
export function areaDisplay(prop) {
  if (prop.areaUnit === "sqm") return `${parseFloat(prop.areaSqm)||0} sq.m`;
  if (prop.areaUnit === "bkd") {
    const { b,k,d } = prop.areaBkd||{};
    return `${b||0}-${k||0}-${d||0} (B-K-D)`;
  }
  const { r,a,p,d } = prop.areaRadp||{};
  return `${r||0}-${a||0}-${p||0}-${d||0} (R-A-P-D)`;
}

// Unit factor for rate calculation (sqm per rate unit)
export function rateUnitFactor(prop) {
  if (!prop) return AANA_TO_SQM;
  if (prop.areaUnit === "bkd") return DHUR_TO_SQM;
  if (prop.areaUnit === "sqm" && prop.rateSystem === "bkd") return DHUR_TO_SQM;
  return AANA_TO_SQM;
}

// Rate unit label
export function rateUnitLabel(prop) {
  if (!prop) return "Anna";
  if (prop.areaUnit === "bkd") return "Dhur";
  if (prop.areaUnit === "sqm" && prop.rateSystem === "bkd") return "Dhur";
  return "Anna";
}
