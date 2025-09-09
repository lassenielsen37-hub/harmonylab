import React, { useEffect, useRef, useState } from "react";
import { Select as SelectUI } from "@/components/ui/Select";
import { Sources } from "@/components/sections/Sources";
import { Harmonies } from "@/components/sections/Harmonies";
import { Transport } from "@/components/sections/Transport";
import { KEYS } from "@/types/audio";
import { useAudioEngine } from "@/hooks/useAudioEngine";


export default function HarmonyLab() {
const [sourceMode, setSourceMode] = useState<"mic" | "file">("mic");
const [selectedKey, setSelectedKey] = useState<string>("C");
const [scale, setScale] = useState<string>("Dur");
const analyserCanvasRef = useRef<HTMLCanvasElement | null>(null);


const eng = useAudioEngine();


// small analyser
useEffect(() => {
let raf = 0;
const draw = () => {
const canvas = analyserCanvasRef.current; if (!canvas) return; const ctx = canvas.getContext("2d"); if (!ctx) return;
const data = eng.analyser.getValue() as Float32Array;
ctx.clearRect(0, 0, canvas.width, canvas.height);
ctx.beginPath();
const n = data.length;
for (let i = 0; i < n; i++) {
const x = (i / (n - 1)) * canvas.width;
const y = (1 - (data[i] + 140) / 140) * canvas.height;
i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
}
ctx.strokeStyle = "#555"; ctx.lineWidth = 1.25; ctx.stroke();
raf = requestAnimationFrame(draw);
};
raf = requestAnimationFrame(draw);
return () => cancelAnimationFrame(raf);
}, [eng.analyser]);


return (
<div className="p-6 max-w-5xl mx-auto space-y-6 bg-white text-neutral-900">
<header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
<div className="space-y-1">
<h1 className="text-2xl font-bold">HarmonyLab</h1>
<p className="text-sm text-neutral-600">Syng eller upload en sang. Få hurtige 2. og 3. stemmer via faste intervaller.</p>
</div>
<div className="grid grid-cols-2 gap-2">
<div className="text-xs text-neutral-600 col-span-2">Toneart</div>
<SelectUI value={selectedKey} onChange={setSelectedKey} options={KEYS} />
<SelectUI value={scale} onChange={setScale} options={["Dur","Mol"]} />
</div>
</header>
}
