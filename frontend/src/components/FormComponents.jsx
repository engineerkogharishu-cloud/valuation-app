import React from "react";
import { adToBs } from "../utils/bsDate";
import NepaliDatePicker from "./NepaliDatePicker";

export function Field({ label, required, children }) {
  return (
    <div className="field">
      <label>{label}{required && <span className="req"> *</span>}</label>
      {children}
    </div>
  );
}

export function SectionHeader({ num, title }) {
  return (
    <div className="section-header">
      <span className="sec-num">{num}</span>
      <span className="sec-title">{title}</span>
    </div>
  );
}

export function PersonForm({ data, onChange }) {
  const f = (k) => (v) => onChange({ ...data, [k]: v });
  const todayBs = adToBs(new Date());
  return (
    <div className="sub-grid">
      <Field label="Full Name" required><input value={data.name} onChange={e=>f("name")(e.target.value)} placeholder="Full name"/></Field>
      <Field label="Citizenship No." required><input value={data.citizenshipNo} onChange={e=>f("citizenshipNo")(e.target.value)} placeholder="xxx-xx-xxxxx"/></Field>
      <Field label="Issued Date (BS)">
        <NepaliDatePicker value={data.issuedDate} onChange={f("issuedDate")} maxBs={todayBs} />
      </Field>
      <Field label="Issued By"><input value={data.issuedBy} onChange={e=>f("issuedBy")(e.target.value)} placeholder="District Admin. Office"/></Field>
      <Field label="Father's Name"><input value={data.fatherName} onChange={e=>f("fatherName")(e.target.value)}/></Field>
      <Field label="Grandfather's Name"><input value={data.grandfatherName} onChange={e=>f("grandfatherName")(e.target.value)}/></Field>
      <Field label="Husband's Name"><input value={data.husbandName} onChange={e=>f("husbandName")(e.target.value)}/></Field>
      <Field label="Contact Number"><input value={data.contact} onChange={e=>f("contact")(e.target.value)} placeholder="98xxxxxxxx"/></Field>
      <Field label="Address"><textarea value={data.address} onChange={e=>f("address")(e.target.value)} rows={2} placeholder="Ward, VDC/Municipality, District"/></Field>
    </div>
  );
}
