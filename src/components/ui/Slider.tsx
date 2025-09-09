import React from "react";


export const Slider: React.FC<{ value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number }>
= ({ value, onChange, min = 0, max = 1, step = 0.01 }) => (
<input type="range" min={min} max={max} step={step} value={value} className="w-full" onChange={(e) => onChange(parseFloat(e.target.value))} />
);
