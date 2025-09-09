import React from "react";


export const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }>
= ({ checked, onChange, label }) => (
<label className="flex items-center gap-2 select-none cursor-pointer">
<input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
<span>{label}</span>
</label>
);
