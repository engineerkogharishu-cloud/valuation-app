// ─── OLC (Open Location Code / Plus Code) decoder ────────────────────────────
const OLC = (() => {
  const ALPHABET = "23456789CFGHJMPQRVWX";
  const BASE = 20;
  const SEP = "+";
  const SEP_POS = 8;
  const PAIR_LEN = 10;
  const GRID_COLS = 4;
  const GRID_ROWS = 5;

  function isValid(code) {
    if (!code || code.length < 2) return false;
    const c = code.toUpperCase();
    const si = c.indexOf(SEP);
    if (si < 0 || si > SEP_POS || si % 2 !== 0) return false;
    if (c.indexOf(SEP, si + 1) >= 0) return false;
    if (c.length < si + 2) return false;
    if (c.length - si - 1 === 1) return false;
    for (let i = 0; i < c.length; i++) {
      const ch = c[i];
      if (ch !== SEP && ch !== "0" && ALPHABET.indexOf(ch) < 0) return false;
    }
    return true;
  }

  function isFull(code) {
    if (!isValid(code)) return false;
    return code.toUpperCase().indexOf(SEP) === SEP_POS;
  }

  function isShort(code) {
    if (!isValid(code)) return false;
    const c = code.toUpperCase();
    const si = c.indexOf(SEP);
    return si >= 0 && si < SEP_POS;
  }

  function decode(code) {
    if (!isFull(code)) return null;
    const c = code.toUpperCase().replace(SEP, "").replace(/0+$/, "");
    let latLo = -90, lngLo = -180;
    let latPV = BASE * BASE, lngPV = BASE * BASE;
    let i = 0;
    while (i < Math.min(c.length, PAIR_LEN)) {
      latPV /= BASE; lngPV /= BASE;
      latLo += ALPHABET.indexOf(c[i])   * latPV;
      lngLo += ALPHABET.indexOf(c[i+1]) * lngPV;
      i += 2;
    }
    while (i < c.length) {
      const gi = ALPHABET.indexOf(c[i]);
      latPV /= GRID_ROWS; lngPV /= GRID_COLS;
      latLo += Math.floor(gi / GRID_COLS) * latPV;
      lngLo += (gi % GRID_COLS) * lngPV;
      i++;
    }
    return { latitudeCenter: latLo + latPV/2, longitudeCenter: lngLo + lngPV/2 };
  }

  function _buildPrefix(latDeg, lngDeg, numChars) {
    // Encode lat/lng into numChars characters (must be even)
    let tmpLat = latDeg + 90.0;
    let tmpLng = lngDeg + 180.0;
    let div = BASE * BASE; // 400
    const chars = [];
    for (let p = 0; p < numChars / 2; p++) {
      div /= BASE;                                    // 20, then 1, then 0.05 ...
      chars.push(ALPHABET[Math.floor(tmpLat / div)]); tmpLat = tmpLat % div;
      chars.push(ALPHABET[Math.floor(tmpLng / div)]); tmpLng = tmpLng % div;
    }
    return chars.join("");
  }

  function recoverNearest(shortCode, refLat, refLng) {
    if (isFull(shortCode)) return decode(shortCode);
    if (!isShort(shortCode)) return null;

    const c = shortCode.toUpperCase();
    const sepIdx = c.indexOf(SEP);
    const digitsToRecover = SEP_POS - sepIdx;            // 2, 4, or 6
    const resolution = Math.pow(BASE, 2 - (digitsToRecover / 2)); // 400, 20, or 1

    refLat = Math.max(-90, Math.min(90, refLat));
    refLng = Math.max(-180, Math.min(180, refLng));

    // Floor reference to resolution grid
    let refLatR = Math.floor(refLat / resolution) * resolution;
    let refLngR = Math.floor(refLng / resolution) * resolution;

    let full = _buildPrefix(refLatR, refLngR, digitsToRecover) + c;
    let result = decode(full);
    if (!result) return null;
    let { latitudeCenter: lat, longitudeCenter: lng } = result;

    // Adjust latitude if off by one cell
    if (refLat - lat > resolution / 2) {
      full = _buildPrefix(refLatR + resolution, refLngR, digitsToRecover) + c;
      result = decode(full) || result;
      lat = result.latitudeCenter; lng = result.longitudeCenter;
    } else if (lat - refLat > resolution / 2) {
      full = _buildPrefix(refLatR - resolution, refLngR, digitsToRecover) + c;
      result = decode(full) || result;
      lat = result.latitudeCenter; lng = result.longitudeCenter;
    }

    // Adjust longitude if off by one cell
    const latR2 = Math.floor(lat / resolution) * resolution;
    if (refLng - lng > resolution / 2) {
      full = _buildPrefix(latR2, refLngR + resolution, digitsToRecover) + c;
      result = decode(full) || result;
    } else if (lng - refLng > resolution / 2) {
      full = _buildPrefix(latR2, refLngR - resolution, digitsToRecover) + c;
      result = decode(full) || result;
    }

    return result;
  }

  // Encode lat/lng to a full 10-character plus code (precision ~14 m)
  function encode(lat, lng) {
    lat = Math.max(-90,  Math.min( 90, lat));
    lng = Math.max(-180, Math.min(180, lng));
    let tmpLat = lat + 90;
    let tmpLng = lng + 180;
    let div = BASE * BASE; // 400
    const chars = [];
    for (let p = 0; p < 5; p++) {
      div /= BASE;
      const ld = Math.floor(tmpLat / div);
      const nd = Math.floor(tmpLng / div);
      chars.push(ALPHABET[ld]);
      chars.push(ALPHABET[nd]);
      tmpLat -= ld * div;
      tmpLng -= nd * div;
    }
    chars.splice(8, 0, SEP); // insert '+' at position 8
    return chars.join("");
  }

  return { isValid, isFull, isShort, decode, recoverNearest, encode };
})();

// Nepal locality reference coordinates (no network needed)
const NEPAL_LOCALITIES = {
  // Bagmati Province
  "kathmandu":             [27.7172, 85.3240],
  "lalitpur":              [27.6644, 85.3188],
  "patan":                 [27.6644, 85.3188],
  "bhaktapur":             [27.6710, 85.4298],
  "kirtipur":              [27.6767, 85.2797],
  "madhyapur thimi":       [27.6792, 85.3870],
  "budhanilkantha":        [27.7906, 85.3624],
  "kageshwor":             [27.7406, 85.3500],
  "kageshwori manohara":   [27.7406, 85.3500],
  "gokarneshwor":          [27.7553, 85.3834],
  "sankhu":                [27.7897, 85.4563],
  "tokha":                 [27.7802, 85.3230],
  "tarakeshwor":           [27.7967, 85.2633],
  "nagarjun":              [27.7500, 85.2667],
  "chandragiri":           [27.6744, 85.2395],
  "dakshinkali":           [27.6167, 85.2333],
  "mahankal":              [27.7583, 85.4167],
  "shankharapur":          [27.7667, 85.4500],
  "hetauda":               [27.4271, 85.0314],
  "bharatpur":             [27.6833, 84.4333],
  "chitwan":               [27.5291, 84.3542],
  "sindhuli":              [27.2592, 85.9692],
  "sindhulimadhi":         [27.2592, 85.9692],
  "kamalamai":             [27.2592, 85.9692],
  "dhulikhel":             [27.6200, 85.5500],
  "panauti":               [27.5833, 85.5167],
  "banepa":                [27.6333, 85.5167],
  "nuwakot":               [27.9167, 85.1667],
  "bidur":                 [27.9167, 85.1667],
  "trishuli":              [27.9833, 85.0833],
  "ratmate":               [27.8500, 85.0500],
  "belkot":                [27.8667, 85.2833],
  "kakani":                [27.8333, 85.3167],
  "panchakanya":           [27.9500, 85.2667],
  "dupcheshwar":           [27.9833, 85.3333],
  "likhu":                 [27.8667, 85.0833],
  "suryagadhi":            [27.8833, 85.1667],
  "siddhalek":             [27.9167, 85.3000],
  "kispang":               [27.9000, 85.0167],
  "myagang":               [27.8167, 85.0000],
  "tadi":                  [27.8000, 85.1333],
  "tarkeshwar":            [27.8333, 85.1000],
  "jambu":                 [27.8333, 84.9833],
  "sundaradevi":           [27.9667, 85.2333],
  "shivapuri":             [27.7900, 85.3800],
  "meghang":               [27.8667, 85.3000],
  "vishnu":                [27.9333, 85.2000],
  "rasuwa":                [28.1000, 85.3667],
  "dhading":               [27.8667, 84.9000],
  "nilkantha":             [27.8667, 84.9000],
  "makwanpur":             [27.4167, 85.0000],
  "ramechhap":             [27.3333, 86.0833],
  "manthali":              [27.3333, 86.0833],
  "dolakha":               [27.6667, 86.2500],
  "charikot":              [27.6667, 86.2500],
  "kavrepalanchok":        [27.6500, 85.5500],
  "kavre":                 [27.6500, 85.5500],
  "sindhupalchok":         [27.9500, 85.6833],
  "chautara":              [27.9500, 85.6833],
  // Gandaki Province
  "pokhara":               [28.2096, 83.9856],
  "lekhnath":              [28.1667, 83.9833],
  "syangja":               [28.0833, 83.8667],
  "waling":                [28.0833, 83.8667],
  "gorkha":                [28.0000, 84.6333],
  "manang":                [28.5500, 84.0167],
  "mustang":               [28.9667, 83.7167],
  "myagdi":                [28.3500, 83.5500],
  "baglung":               [28.2667, 83.5833],
  "kaski":                 [28.2000, 83.9833],
  "lamjung":               [28.1333, 84.3833],
  "tanahu":                [27.9167, 84.3333],
  "damauli":               [27.9167, 84.3333],
  "nawalparasi":           [27.7000, 83.7500],
  "nawalapur":             [27.7000, 83.7500],
  "palpa":                 [27.8667, 83.5500],
  "tansen":                [27.8667, 83.5500],
  // Lumbini Province
  "butwal":                [27.7006, 83.4532],
  "bhairahawa":            [27.5050, 83.4580],
  "siddharthanagar":       [27.5050, 83.4580],
  "rupandehi":             [27.6167, 83.4500],
  "arghakhanchi":          [27.9500, 83.1167],
  "sandhikharka":          [27.9500, 83.1167],
  "gulmi":                 [28.0833, 83.2667],
  "tamghas":               [28.0833, 83.2667],
  "kapilvastu":            [27.5500, 83.0500],
  "taulihawa":             [27.5500, 83.0500],
  "dang":                  [28.0833, 82.3000],
  "ghorahi":               [28.0300, 82.4900],
  "tulsipur":              [28.1300, 82.2900],
  "banke":                 [28.0500, 81.6167],
  "nepalgunj":             [28.0500, 81.6167],
  "bardiya":               [28.3500, 81.5000],
  "gulariya":              [28.3500, 81.5000],
  "rolpa":                 [28.3333, 82.6667],
  "libang":                [28.3333, 82.6667],
  "rukum":                 [28.6167, 82.6333],
  "salyan":                [28.3667, 82.1667],
  "pyuthan":               [28.0833, 82.8667],
  // Koshi Province
  "biratnagar":            [26.4525, 87.2718],
  "dharan":                [26.8120, 87.2840],
  "itahari":               [26.6640, 87.2740],
  "damak":                 [26.6622, 87.6994],
  "birtamod":              [26.6458, 87.9919],
  "mechinagar":            [26.6264, 88.0672],
  "morang":                [26.6667, 87.5000],
  "sunsari":               [26.7000, 87.2833],
  "jhapa":                 [26.5333, 87.8667],
  "ilam":                  [26.9167, 87.9333],
  "panchthar":             [27.1500, 87.7500],
  "taplejung":             [27.3500, 87.6667],
  "sankhuwasabha":         [27.3500, 87.2667],
  "dhankuta":              [26.9833, 87.3333],
  "terhathum":             [27.1500, 87.5500],
  "bhojpur":               [27.1667, 87.0500],
  "solukhumbu":            [27.6667, 86.7167],
  "salleri":               [27.5000, 86.5833],
  "khotang":               [27.1333, 86.8333],
  "okhaldhunga":           [27.3167, 86.5000],
  "udayapur":              [26.9167, 86.5333],
  "triyuga":               [26.9167, 86.5333],
  // Madhesh Province
  "janakpur":              [26.7288, 85.9242],
  "birgunj":               [27.0104, 84.8777],
  "rajbiraj":              [26.5333, 86.7500],
  "saptari":               [26.5833, 86.7500],
  "siraha":                [26.6500, 86.2000],
  "lahan":                 [26.7167, 86.4833],
  "dhanusha":              [26.8167, 85.9167],
  "mahottari":             [26.8333, 85.7500],
  "jaleshwar":             [26.8333, 85.7500],
  "sarlahi":               [26.9167, 85.5000],
  "malangwa":              [26.9167, 85.5000],
  "rautahat":              [27.0000, 85.0833],
  "gaur":                  [26.7667, 85.2833],
  "bara":                  [27.0833, 84.9167],
  "kalaiya":               [27.0333, 84.9667],
  "parsa":                 [27.1833, 84.8667],
  // Sudurpashchim Province
  "mahendranagar":         [28.9667, 80.1833],
  "dhangadhi":             [28.7000, 80.5833],
  "dipayal":               [29.2667, 81.2167],
  "silgadhi":              [29.2667, 81.2167],
  "bajhang":               [29.5667, 81.1500],
  "chainpur":              [29.5500, 81.1833],
  "bajura":                [29.4833, 81.4833],
  "martadi":               [29.4833, 81.4833],
  "dadeldhura":            [29.2833, 80.5667],
  "baitadi":               [29.5333, 80.4167],
  "darchula":              [29.8500, 80.5333],
  "kanchanpur":            [28.8333, 80.2167],
  "kailali":               [28.7167, 81.0000],
  "tikapur":               [28.5167, 81.1167],
  "accham":                [29.1000, 81.2333],
  "mangalsen":             [29.1000, 81.2333],
  // Karnali Province
  "birendranagar":         [28.6000, 81.6167],
  "surkhet":               [28.6000, 81.6167],
  "jumla":                 [29.2833, 82.1833],
  "dailekh":               [28.8500, 81.7167],
  "dullu":                 [28.8500, 81.7167],
  "kalikot":               [29.1333, 81.6333],
  "mugu":                  [29.5667, 82.4833],
  "humla":                 [29.9833, 82.0167],
  "dolpa":                 [29.0000, 82.8500],
  "dunai":                 [28.9500, 82.9167],
  "rukum west":            [28.6167, 82.6333],
  "jajarkot":              [28.7167, 82.2000],
  // Common alternative spellings / shorthand
  "ktm":                   [27.7172, 85.3240],
  "pkr":                   [28.2096, 83.9856],
  "brt":                   [26.4525, 87.2718],
  "nepal":                 [28.3949, 84.1240],
};

export function resolveLocalityCoords(name) {
  if (!name) return null;
  // Normalize: lowercase, strip punctuation, collapse spaces
  const key = name.toLowerCase().replace(/[,\.;]/g, ' ').replace(/\s+/g, ' ').trim();

  // 1. Exact match
  if (NEPAL_LOCALITIES[key]) return NEPAL_LOCALITIES[key];

  // 2. Match each individual word (handles "Ratmate, Nuwakot" or "Kageshwori Manohara")
  const words = key.split(' ').filter(w => w.length >= 3);
  for (const word of words) {
    if (NEPAL_LOCALITIES[word]) return NEPAL_LOCALITIES[word];
  }

  // 3. Substring: key contains a locality name or vice versa
  for (const [k, v] of Object.entries(NEPAL_LOCALITIES)) {
    if (key.includes(k) || k.includes(key)) return v;
  }

  // 4. Word-level fuzzy: any word of input matches any word of a key
  for (const word of words) {
    if (word.length < 4) continue;
    for (const [k, v] of Object.entries(NEPAL_LOCALITIES)) {
      const kWords = k.split(' ');
      if (kWords.some(kw => kw.includes(word) || word.includes(kw))) return v;
    }
  }

  return null; // Unknown — caller will try Nominatim geocoding
}

// Resolve a Plus Code string (full or short+locality) → {latitudeCenter, longitudeCenter}
export async function resolvePlusCode(raw) {
  if (!raw || !raw.trim()) throw new Error("No Plus Code entered.");
  const trimmed = raw.trim();

  // Split on whitespace: first token = code, rest = locality
  // Handle Google Maps formats:
  //   "P977+95 Kathmandu"
  //   "7MQP+GF Kageshwori Manohara, Kathmandu"
  //   "8JMQ7MQP+GF"  (full, no locality needed)
  const firstSpace = trimmed.indexOf(" ");
  const codePart  = (firstSpace < 0 ? trimmed : trimmed.slice(0, firstSpace)).toUpperCase().trim();
  const locality  = (firstSpace < 0 ? ""      : trimmed.slice(firstSpace + 1)).trim();

  // ── 1. Full Plus Code — decode directly ──────────────────────────
  if (OLC.isFull(codePart)) {
    const r = OLC.decode(codePart);
    if (!r) throw new Error("Could not decode Plus Code.");
    return r;
  }

  // ── 2. Short Plus Code — needs reference coords ───────────────────
  if (OLC.isShort(codePart)) {
    // Helper: try recovery with given ref coords
    const tryRecover = (refLat, refLng) => {
      try { return OLC.recoverNearest(codePart, refLat, refLng); } catch(e) { return null; }
    };

    // a) Local lookup table (instant, no network)
    if (locality) {
      const localRef = resolveLocalityCoords(locality);
      if (localRef) {
        const r = tryRecover(localRef[0], localRef[1]);
        if (r) return r;
      }
    }

    // b) Nominatim geocoding (free, no API key needed)
    if (locality) {
      try {
        const q = encodeURIComponent(locality + " Nepal");
        const res = await fetch(
          "https://nominatim.openstreetmap.org/search?q=" + q + "&format=json&limit=1&countrycodes=np",
          { headers: { "Accept-Language": "en", "User-Agent": "NeoCivicValuation/1.0" } }
        );
        const data = await res.json();
        if (data && data[0]) {
          const r = tryRecover(parseFloat(data[0].lat), parseFloat(data[0].lon));
          if (r) return r;
        }
      } catch(e) { /* network unavailable */ }
    }

    // c) Default to Nepal center (works for most Nepal codes if no locality given)
    const nepCenter = NEPAL_LOCALITIES["kathmandu"] || [27.7172, 85.3240];
    const r = tryRecover(nepCenter[0], nepCenter[1]);
    if (r) return r;

    throw new Error(
      'Could not locate "' + codePart + '". ' +
      'Add the area name, e.g. "' + codePart + ' Kathmandu"'
    );
  }

  throw new Error(
    '"' + codePart + '" is not a valid Plus Code. ' +
    'Copy it directly from Google Maps (e.g. "P977+95 Kathmandu").'
  );
}

export function loadPlusCodeLibrary(cb) { cb(); }
