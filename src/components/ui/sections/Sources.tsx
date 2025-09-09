import React, { useRef } from "react";
status: "idle" | "ready" | "live" | "playing";
startMic: () => Promise<void>;
stopMic: () => void;
loadFile: (f: File) => Promise<void>;
playFile: () => Promise<void>;
stopFile: () => void;
fileName: string;
inputLevel: number;
analyserCanvasRef: React.RefObject<HTMLCanvasElement>;
}) {
const fileInputRef = useRef<HTMLInputElement | null>(null);
const {
sourceMode, setSourceMode, selectedMicId, setSelectedMicId, micDevices,
refreshMicDevices, status, startMic, stopMic, loadFile, playFile, stopFile, fileName, inputLevel, analyserCanvasRef
} = props;


return (
<section className="space-y-4 p-4 rounded-2xl border bg-white">
<div className="flex items-center justify-between">
<h2 className="font-semibold">Kilder</h2>
<div className="flex items-center gap-4">
<Pot value={inputLevel} label="Input" />
<div className="hidden sm:block">
<canvas ref={analyserCanvasRef} width={360} height={72} className="w-[240px] sm:w-[360px] h-[72px] bg-neutral-100 rounded-xl" />
</div>
</div>
</div>


<div className="flex flex-wrap items-center gap-2">
<Button className={sourceMode === "mic" ? "bg-black text-white" : ""} onClick={() => setSourceMode("mic")}>Mikrofon</Button>
<Button className={sourceMode === "file" ? "bg-black text-white" : ""} onClick={() => setSourceMode("file")}>Lydfil</Button>
</div>


{sourceMode === "mic" ? (
<div className="space-y-3">
<div className="flex flex-col sm:flex-row gap-2 sm:items-center">
<label className="text-xs text-neutral-600 sm:w-32">Mikrofon</label>
<select className="border rounded-xl px-3 py-2 flex-1" value={selectedMicId} onChange={(e) => setSelectedMicId(e.target.value)} onFocus={refreshMicDevices}>
<option value="">Systemstandard</option>
{micDevices.map((d, i) => (
<option key={d.deviceId || i} value={d.deviceId}>{d.label || `Mikrofon ${i + 1}`}</option>
))}
</select>
<Button className="px-3 py-2" onClick={refreshMicDevices}>Opdater</Button>
</div>


{status !== "live" ? (
<Button onClick={startMic}>🎤 Start mikrofon</Button>
) : (
<Button className="bg-red-600 text-white" onClick={stopMic}>⏹ Stop mikrofon</Button>
)}
<p className="text-xs text-neutral-500">Brug helst headset for at undgå akustisk feedback.</p>
</div>
) : (
<div className="space-y-3">
<input ref={fileInputRef} type="file" accept="audio/*" onChange={(e) => e.target.files && loadFile(e.target.files[0])} />
<div className="flex gap-2">
<Button onClick={playFile}>▶️ Afspil</Button>
<Button onClick={stopFile}>⏹ Stop</Button>
</div>
{fileName ? <p className="text-xs text-neutral-600">Valgt fil: {fileName}</p> : <p className="text-xs text-neutral-500">Ingen fil valgt endnu.</p>}
</div>
)}
</section>
);
}
