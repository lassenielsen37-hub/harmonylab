import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";


// ============================== UI HELPERS ==============================
const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = "", ...props }) => (
<button
className={`px-4 py-2 rounded-2xl shadow-sm border border-neutral-300 hover:shadow transition disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
{...props}
/>
);


const Slider: React.FC<{ value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }> = ({ value, onChange, min = 0, max = 1, step = 0.01 }) => (
<input type="range" min={min} max={max} step={step} value={value} className="w-full" onChange={(e) => onChange(parseFloat(e.target.value))} />
);


const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
<label className="flex items-center gap-2 select-none cursor-pointer">
<input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
<span>{label}</span>
</label>
);


const Select: React.FC<{ value: string; onChange: (v: string) => void; options: string[] }> = ({ value, onChange, options }) => (
<select className="border rounded-xl px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)}>
{options.map((o) => (
<option key={o} value={o}>{o}</option>
))}
</select>
);


// Simple circular potmeter / gauge (read-only, 0..1)
const Pot: React.FC<{ value: number; label?: string }> = ({ value, label = "Input" }) => {
// Clamp 0..1
const v = Math.max(0, Math.min(1, value));
const size = 84;
const stroke = 10;
const r = (size - stroke) / 2;
const cx = size / 2;
const cy = size / 2;


// Top semicircle sweep: 140° (left-top) -> 40° (right-top)
const deg2rad = (d: number) => (d * Math.PI) / 180;
const startAngle = deg2rad(140);
const endAngle = deg2rad(40);
const total = endAngle - startAngle; // negative (~ -100°) = clockwise
const angle = startAngle + total * v;


const pt = (ang: number) => ({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
const s = pt(startAngle);
const e = pt(angle);
const eBg = pt(endAngle);


// Arc flags: always a small arc (< 180°), clockwise across the top
const largeArcFlag = 0;
const sweepFlag = 1;


const bgPath = `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${eBg.x} ${eBg.y}`;
const fgPath = `M ${s.x} ${s.y} A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${e.x} ${e.y}`;


return (
<div className="flex flex-col items-center">
<svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} level`}>
<path d={bgPath} fill="none" stroke="#e5e5e5" strokeWidth={stroke} strokeLinecap="round" />
<path d={fgPath} fill="none" stroke="#0ea5e9" strokeWidth={stroke} strokeLinecap="round" />
<circle cx={cx} cy={cy} r={r - 8} fill="#fff" />
{/* Needle */}
<line x1={cx} y1={cy} x2={cx + (r - 14) * Math.cos(angle)} y2={cy + (r - 14) * Math.sin(angle)} stroke="#111" strokeWidth={3} strokeLinecap="round" />
}
