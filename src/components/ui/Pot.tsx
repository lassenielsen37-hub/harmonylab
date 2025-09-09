import React from "react";


export const Pot: React.FC<{ value: number; label?: string }>
= ({ value, label = "Input" }) => {
const v = Math.max(0, Math.min(1, value));
const size = 72; const stroke = 8; const r = (size - stroke) / 2; const cx = size / 2; const cy = size / 2;
const deg2rad = (d: number) => (d * Math.PI) / 180;
const startAngle = deg2rad(140); const endAngle = deg2rad(40);
const total = endAngle - startAngle;
const angle = startAngle + total * v;
const pt = (ang: number) => ({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
const s = pt(startAngle); const e = pt(angle); const eBg = pt(endAngle);
const bgPath = `M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${eBg.x} ${eBg.y}`;
const fgPath = `M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`;
return (
<div className="flex flex-col items-center">
<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} niveau`}>
<path d={bgPath} fill="none" stroke="#e5e5e5" strokeWidth={stroke} strokeLinecap="round" />
<path d={fgPath} fill="none" stroke="#0ea5e9" strokeWidth={stroke} strokeLinecap="round" />
<circle cx={cx} cy={cy} r={r - 7} fill="#fff" />
<line x1={cx} y1={cy} x2={cx + (r - 12) * Math.cos(angle)} y2={cy + (r - 12) * Math.sin(angle)} stroke="#111" strokeWidth={3} strokeLinecap="round" />
</svg>
<span className="text-xs text-neutral-600 mt-1">{label}</span>
</div>
);
};
