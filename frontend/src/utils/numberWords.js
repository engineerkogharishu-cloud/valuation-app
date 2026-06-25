export function toWords(n) {
  if (!n || isNaN(n)) return "Zero";
  const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
    "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen","Seventeen",
    "Eighteen","Nineteen"];
  const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];
  function helper(num) {
    if (num === 0) return "";
    if (num < 20) return ones[num] + " ";
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? " "+ones[num%10]+" " : " ");
    if (num < 1000) return ones[Math.floor(num/100)]+" Hundred "+(num%100?helper(num%100):"");
    if (num < 100000) return helper(Math.floor(num/1000))+"Thousand "+helper(num%1000);
    if (num < 10000000) return helper(Math.floor(num/100000))+"Lakh "+helper(num%100000);
    return helper(Math.floor(num/10000000))+"Crore "+helper(num%10000000);
  }
  const rounded = Math.round(n);
  return (helper(rounded) || "Zero").trim();
}

// ─── Number to Nepali (Devanagari) words ──────────────────────────────────────
export function toWordsNepali(n) {
  if (!n || isNaN(n)) return "शून्य";
  const ones = ["","एक","दुई","तीन","चार","पाँच","छ","सात","आठ","नौ",
    "दश","एघार","बाह्र","तेह्र","चौध","पन्ध्र","सोह्र","सत्र","अठार","उन्नाइस"];
  const tens = ["","","बीस","तीस","चालीस","पचास","साठी","सत्तरी","असी","नब्बे"];
  function helper(num) {
    if (num === 0) return "";
    if (num < 20) return ones[num] + " ";
    if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? " " + ones[num%10] + " " : " ");
    if (num < 1000) return ones[Math.floor(num/100)] + " सय " + (num%100 ? helper(num%100) : "");
    if (num < 100000) return helper(Math.floor(num/1000)) + "हजार " + helper(num%1000);
    if (num < 10000000) return helper(Math.floor(num/100000)) + "लाख " + helper(num%100000);
    if (num < 1000000000) return helper(Math.floor(num/10000000)) + "करोड " + helper(num%10000000);
    return helper(Math.floor(num/1000000000)) + "अरब " + helper(num%1000000000);
  }
  const rounded = Math.round(n);
  return (helper(rounded) || "शून्य").trim();
}

// Convert digits to Devanagari numerals
export function toDevanagariNum(n) {
  const map = {0:"०",1:"१",2:"२",3:"३",4:"४",5:"५",6:"६",7:"७",8:"८",9:"९"};
  return String(n).split("").map(c => map[c] !== undefined ? map[c] : c).join("");
}
