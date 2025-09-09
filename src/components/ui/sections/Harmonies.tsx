import React from "react";
import { Toggle } from "@/components/ui/Toggle";
import { Slider } from "@/components/ui/Slider";
import { Harmony } from "@/types/audio";


export function Harmonies(props: {
harmonies: Harmony[];
toggleHarmony: (id: string, on: boolean) => void;
setHarmonyLevel: (id: string, level: number) => void;
}) {
const { harmonies, toggleHarmony, setHarmonyLevel } = props;
return (
<section className="space-y-4 p-4 rounded-2xl border bg-white">
<h2 className="font-semibold">Stemmer</h2>
<p className="text-xs text-neutral-500">Start med +3 og +5 for klassiske 2./3. stemmer. Justér niveau efter smag. (+3 = lille terts op, +5 = kvint op, -3 = lille terts ned, -5 = kvint ned)</p>
<div className="grid md:grid-cols-2 gap-3">
{harmonies.map((h) => (
<div key={h.id} className={`p-3 rounded-xl border ${h.enabled ? "bg-neutral-50" : "bg-white"}`}>
<div className="flex items-center justify-between">
<Toggle checked={h.enabled} onChange={(v) => toggleHarmony(h.id, v)} label={`${h.id} (${h.semitones > 0 ? '+'+h.semitones : h.semitones})`} />
</div>
<div className="mt-2">
<label className="text-xs text-neutral-600">Niveau</label>
<Slider value={h.gain.gain.value} onChange={(v) => setHarmonyLevel(h.id, v)} min={0} max={1.5} step={0.01} />
</div>
</div>
))}
</div>
</section>
);
}
