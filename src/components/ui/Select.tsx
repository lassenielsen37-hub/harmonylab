import React from "react";


export const Select: React.FC<{ value: string; onChange: (v: string) => void; options: string[] }>
= ({ value, onChange, options }) => (
<select className="border rounded-xl px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)}>
{options.map((o) => (
<option key={o} value={o}>{o}</option>
))}
</select>
);
