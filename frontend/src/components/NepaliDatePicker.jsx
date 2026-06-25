import React from "react";
import { BS_MONTH_DAYS, BS_MONTHS, adToBs, bsToAd, formatBs, parseBsStr } from "../utils/bsDate";

export default function NepaliDatePicker({ value, onChange, maxBs, label, required }) {
  const todayAd = new Date();
  const todayBs = adToBs(todayAd);
  const maxYear = maxBs ? maxBs.y : todayBs.y;

  const parsed = parseBsStr(value);
  const selY = parsed?.y || todayBs.y;
  const selM = parsed?.m || 1;
  const selD = parsed?.d || 1;

  const daysInMonth = (BS_MONTH_DAYS[selY] || BS_MONTH_DAYS[2080])[selM - 1];

  const handleChange = (y, m, d) => {
    const days = BS_MONTH_DAYS[y] || BS_MONTH_DAYS[2080];
    const maxD = days[m-1];
    const safeD = Math.min(d, maxD);
    onChange(formatBs({y, m, d: safeD}));
  };

  return (
    <div className="nepali-date-picker">
      <div className="ndp-selects">
        {/* Year — wider to fit 4-digit number */}
        <select
          value={selY}
          onChange={e=>handleChange(parseInt(e.target.value),selM,selD)}
          style={{flex:"1.4"}}>
          {Array.from({length: maxYear - 1999}, (_,i) => 2000+i).map(yr=>(
            <option key={yr} value={yr}>{yr}</option>
          ))}
        </select>
        {/* Month — widest for full name */}
        <select
          value={selM}
          onChange={e=>handleChange(selY,parseInt(e.target.value),selD)}
          style={{flex:"1.6"}}>
          {BS_MONTHS.map((mn,i)=>(
            <option key={i} value={i+1}>{mn}</option>
          ))}
        </select>
        {/* Day */}
        <select
          value={selD}
          onChange={e=>handleChange(selY,selM,parseInt(e.target.value))}
          style={{flex:"1"}}>
          {Array.from({length:daysInMonth},(_,i)=>i+1).map(d=>(
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>
      {value && (
        <div className="ndp-ad-equiv">
          ≈ AD {bsToAd(selY,selM,selD).toLocaleDateString("en-NP",{year:"numeric",month:"short",day:"numeric"})}
        </div>
      )}
    </div>
  );
}
