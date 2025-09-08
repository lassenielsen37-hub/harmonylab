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
      </svg>
      <span className="text-xs text-neutral-600 mt-1">{label}</span>
    </div>
  );
};

// ============================== TYPES & PRESETS ==============================
type Harmony = {
  id: string;
  semitones: number;
  gain: Tone.Gain;
  shifter: Tone.PitchShift;
  enabled: boolean;
};

const HARMONY_PRESETS = [
  { id: "+3", semitones: 3 },
  { id: "+5", semitones: 7 },
  { id: "-3", semitones: -3 },
  { id: "-5", semitones: -7 },
] as const;

const KEYS = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];

// ============================== COMPONENT ==============================
export default function HarmonyLab() {
  // UI state
  const [status, setStatus] = useState<"idle" | "ready" | "live" | "playing">("idle");
  const [sourceMode, setSourceMode] = useState<"mic" | "file">("mic");
  const [selectedKey, setSelectedKey] = useState<string>("C");
  const [scale, setScale] = useState<string>("Major");
  const [fileName, setFileName] = useState<string>("");

  // Mic device selection
  const micRef = useRef<Tone.UserMedia | null>(null);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("");

  const playerRef = useRef<Tone.Player | null>(null);

  // Audio graph
  const bus = useMemo(() => new Tone.Gain(1), []);
  const dryGain = useMemo(() => new Tone.Gain(0.9), []);
  const analyser = useMemo(() => new Tone.Analyser("fft", 1024), []);
  const monitorGain = useMemo(() => new Tone.Gain(1), []); // controls speaker monitoring
  const meter = useMemo(() => new Tone.Meter(), []); // input level meter

  const [harmonies, setHarmonies] = useState<Harmony[]>(() => {
    return HARMONY_PRESETS.map((p) => ({
      id: p.id,
      semitones: p.semitones,
      gain: new Tone.Gain(0.7),
      shifter: new Tone.PitchShift({ pitch: p.semitones, windowSize: 0.1, delayTime: 0 }),
      enabled: p.id === "+3" || p.id === "+5",
    }));
  });

  // wire outputs once
  useEffect(() => {
    dryGain.connect(bus);
    harmonies.forEach((h) => h.gain.connect(bus));
    // Route: bus -> monitorGain -> destination, plus analysis taps
    bus.connect(monitorGain);
    monitorGain.connect(Tone.getDestination());
    bus.connect(analyser);
    bus.connect(meter);
    return () => {
      try { monitorGain.disconnect(); } catch {}
      try { bus.disconnect(); } catch {}
      try { analyser.dispose(); } catch {}
      try { meter.dispose(); } catch {}
    };
  }, []); // eslint-disable-line

  // Visualizer
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let raf: number;
    const draw = () => {
      const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext("2d"); if (!ctx) return;
      const data = analyser.getValue() as Float32Array;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      const n = data.length;
      for (let i = 0; i < n; i++) {
        const x = (i / (n - 1)) * canvas.width;
        const y = (1 - (data[i] + 140) / 140) * canvas.height;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "#555"; ctx.lineWidth = 1.5; ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  // Input attach/detach
  const attachNode = (node: Tone.ToneAudioNode) => {
    node.connect(dryGain);
    harmonies.forEach((h) => node.connect(h.shifter).connect(h.gain));
  };
  const detachNode = (node: Tone.ToneAudioNode) => {
    try { node.disconnect(); } catch {}
    harmonies.forEach((h) => { try { h.shifter.disconnect(); } catch {}; try { h.gain.disconnect(); } catch {}; });
  };

  const initAudio = async () => { await Tone.start(); setStatus("ready"); };

  const refreshMicDevices = async () => {
    if (!(navigator.mediaDevices && navigator.mediaDevices.enumerateDevices)) return;
    const devices = await navigator.mediaDevices.enumerateDevices();
    setMicDevices(devices.filter((d) => d.kind === "audioinput"));
  };

  useEffect(() => {
    if (!navigator.mediaDevices?.addEventListener) return;
    const onChange = () => refreshMicDevices();
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    return () => navigator.mediaDevices.removeEventListener("devicechange", onChange);
  }, []);

  useEffect(() => {
    if (status === "live" && micRef.current) {
      try { stopMic(); } catch {}
      startMic();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMicId]);

  const startMic = async () => {
    await initAudio();
    const constraints: MediaStreamConstraints = selectedMicId
      ? { audio: { deviceId: { exact: selectedMicId } }, video: false }
      : { audio: true, video: false };
    const mic = new Tone.UserMedia();
    await mic.open(constraints);
    micRef.current = mic; attachNode(mic); setStatus("live");
    try { await refreshMicDevices(); } catch {}
  };
  const stopMic = () => {
    const mic = micRef.current; if (mic) { detachNode(mic); mic.close(); mic.dispose(); micRef.current = null; }
    setStatus("idle");
  };

  const loadFile = async (file: File) => {
    await initAudio(); const url = URL.createObjectURL(file); setFileName(file.name);
    if (playerRef.current) { try { detachNode(playerRef.current); playerRef.current.dispose(); } catch {} }
    const player = new Tone.Player({ url, autostart: false, loop: false }).toDestination();
    playerRef.current = player; attachNode(player); setStatus("ready");
  };
  const playFile = async () => { if (!playerRef.current) return; await Tone.start(); playerRef.current.start(); setStatus("playing"); playerRef.current.onstop = () => setStatus("ready"); };
  const stopFile = () => { playerRef.current?.stop(); setStatus("ready"); };

  const toggleHarmony = (id: string, on: boolean) => {
    setHarmonies((prev) => prev.map((h) => {
      if (h.id === id) { if (!on) h.gain.gain.value = 0; return { ...h, enabled: on }; }
      return h;
    }));
  };
  const setHarmonyLevel = (id: string, level: number) => {
    setHarmonies((prev) => prev.map((h) => { if (h.id === id) { h.gain.gain.value = level; return { ...h }; } return h; }));
  };

  // ============================== RECORDER ==============================
  const [muteDuringRec, setMuteDuringRec] = useState(true);
  const recorderRef = useRef<Tone.Recorder | null>(null);
  const recStatusRef = useRef<"idle" | "recording" | "stopping">("idle");
  const [isRec, setIsRec] = useState(false);
  const [isStartingRec, setIsStartingRec] = useState(false);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [toast, setToast] = useState<string>("");
  const [elapsedMs, setElapsedMs] = useState(0);
  const tickRef = useRef<number | null>(null);
  const recStartRef = useRef<number | null>(null);

  // Preview element + blob URL cleanup
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const lastBlobUrlRef = useRef<string | null>(null);

  // Mute monitoring while recording to avoid feedback
  useEffect(() => {
    try { monitorGain.gain.value = (isRec && muteDuringRec) ? 0 : 1; } catch {}
  }, [isRec, muteDuringRec, monitorGain]);

  // Lazy ensure recorder (avoids race if effects haven't run)
  const ensureRecorder = () => {
    if (!recorderRef.current) {
      const rec = new Tone.Recorder();
      recorderRef.current = rec; try { bus.connect(rec); } catch {}
    }
  };
  useEffect(() => () => {
    try { recorderRef.current?.stop(); } catch {}
    try { if (recorderRef.current) bus.disconnect(recorderRef.current); } catch {}
    recorderRef.current?.dispose(); recorderRef.current = null;
    if (lastBlobUrlRef.current) { try { URL.revokeObjectURL(lastBlobUrlRef.current); } catch {} }
  }, [bus]);

  const showToast = (msg: string, ttl = 2500) => {
    setToast(msg);
    (showToast as any)._t && clearTimeout((showToast as any)._t);
    (showToast as any)._t = setTimeout(() => setToast(""), ttl);
  };
  const formatMMSS = (ms: number) => { const s = Math.floor(ms / 1000); const mm = String(Math.floor(s / 60)).padStart(2,'0'); const ss = String(s % 60).padStart(2,'0'); return `${mm}:${ss}`; };

  const startRecord = async () => {
    if (isRec || isStartingRec || recStatusRef.current === "recording") return; // guard double start
    const hasInput = !!micRef.current || !!playerRef.current;
    if (!hasInput) { showToast("Start mikrofon eller afspil en fil først."); return; }

    // stop any preview playback
    try { audioPreviewRef.current?.pause(); } catch {}

    setIsStartingRec(true); setDownloadUrl(null);
    try {
      ensureRecorder(); await Tone.start(); await recorderRef.current?.start();
      recStatusRef.current = "recording"; setIsRec(true);
      recStartRef.current = Date.now(); setElapsedMs(0);
      tickRef.current = window.setInterval(() => { if (recStartRef.current) setElapsedMs(Date.now() - recStartRef.current); }, 200) as unknown as number;
      showToast("Optager…");
    } catch (e: any) {
      const msg = e?.message || String(e); if (!msg.toLowerCase().includes("already started")) showToast("Kunne ikke starte optagelse: " + msg, 4000);
    } finally { setIsStartingRec(false); }
  };

  const stopRecord = async () => {
    if (!isRec && recStatusRef.current !== "recording") return;
    recStatusRef.current = "stopping"; showToast("Stopper og gemmer…");
    try {
      const blob = await recorderRef.current?.stop();
      if (blob) {
        const url = URL.createObjectURL(blob);
        if (lastBlobUrlRef.current) { try { URL.revokeObjectURL(lastBlobUrlRef.current); } catch {} }
        lastBlobUrlRef.current = url;
        setDownloadUrl(url);
        showToast("Optagelse klar – klik Download mix.", 4000);
      }
    } catch (e) { showToast("Kunne ikke stoppe optagelse.", 4000); }
    finally {
      recStatusRef.current = "idle"; setIsRec(false);
      recStartRef.current = null; if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    }
  };

  // Input level sampling for pot meter
  const [inputLevel, setInputLevel] = useState(0);
  useEffect(() => {
    let id: number;
    const sample = () => {
      const db = meter.getValue();
      const norm = Number.isFinite(db) ? Math.max(0, Math.min(1, (db + 60) / 60)) : 0; // -60..0 dB -> 0..1
      setInputLevel(norm);
      id = requestAnimationFrame(sample);
    };
    id = requestAnimationFrame(sample);
    return () => cancelAnimationFrame(id);
  }, [meter]);

  // ============================== DEV TESTS (logic only) ==============================
  const DevTests: React.FC = () => {
    const [result, setResult] = useState<string | null>(null);
    const run = () => {
      class FakeRecorder { started = false; async start(){ if (this.started) throw new Error("Recorder is already started"); this.started = true; } async stop(){ if (!this.started) throw new Error("Recorder is already stopped"); this.started = false; return new Blob(); } }
      const fake = new FakeRecorder(); let isRec = false; let isStarting = false; const ref = { cur: "idle" as "idle"|"recording"|"stopping" };
      const safeStart = async () => { if (isRec || isStarting || ref.cur === "recording") return "ignored"; isStarting = true; try { await fake.start(); ref.cur = "recording"; isRec = true; return "started"; } catch (e:any){ return "error:"+e.message; } finally { isStarting = false; } };
      const safeStop = async () => { if (!isRec && ref.cur !== "recording") return "ignored"; ref.cur = "stopping"; try { await fake.stop(); return "stopped"; } catch (e:any){ return "error:"+e.message; } finally { ref.cur = "idle"; isRec = false; } };
      (async () => { const a = await safeStart(); const b = await safeStart(); const c = await safeStop(); const d = await safeStop(); setResult(JSON.stringify({ a, b, c, d })); })();
    };
    return (<div className="mt-2 text-xs"><Button onClick={run} className="px-2 py-1">Kør logik-tests</Button>{result && <pre className="mt-2 p-2 bg-neutral-100 rounded">{result}</pre>}</div>);
  };

  // ============================== UI ==============================
  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-sm px-4 py-2 rounded-xl shadow">{toast}</div>
      )}

      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">HarmonyLab</h1>
          <p className="text-sm text-neutral-600">Syng eller upload en sang – få hurtige 2. og 3. stemmer med faste interval-skift.</p>
        </div>
        <div className="flex gap-6 items-center">
          <div className="hidden md:flex"><Pot value={inputLevel} label="Input" /></div>
          <div className="flex gap-2">
            <Select value={selectedKey} onChange={setSelectedKey} options={KEYS} />
            <Select value={scale} onChange={setScale} options={["Major","Minor"]} />
          </div>
        </div>
      </header>

      <section className="grid md:grid-cols-2 gap-6">
        <div className="space-y-4 p-4 rounded-2xl border bg-white">
          <h2 className="font-semibold">Kilde</h2>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Button className={sourceMode === "mic" ? "bg-black text-white" : ""} onClick={() => setSourceMode("mic")}>Mikrofon</Button>
              <Button className={sourceMode === "file" ? "bg-black text-white" : ""} onClick={() => setSourceMode("file")}>Upload fil</Button>
              <div className="md:hidden ml-auto"><Pot value={inputLevel} label="Input" /></div>
            </div>

            {sourceMode === "mic" ? (
              <div className="space-y-3">
                {/* Input source selector */}
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
                  <label className="text-xs text-neutral-600 sm:w-32">Mikrofon-kilde</label>
                  <select
                    className="border rounded-xl px-3 py-2 flex-1"
                    value={selectedMicId}
                    onChange={(e) => setSelectedMicId(e.target.value)}
                    onFocus={() => refreshMicDevices()}
                  >
                    <option value="">System standard</option>
                    {micDevices.map((d, i) => (
                      <option key={d.deviceId || i} value={d.deviceId}>
                        {d.label || `Mikrofon ${i + 1}`}
                      </option>
                    ))}
                  </select>
                  <Button className="px-3 py-2" onClick={refreshMicDevices}>Opdater enheder</Button>
                </div>

                {status !== "live" ? (
                  <Button onClick={startMic}>🎤 Start live</Button>
                ) : (
                  <Button className="bg-red-600 text-white" onClick={stopMic}>⏹ Stop</Button>
                )}
                <p className="text-xs text-neutral-500">
                  {status === "live" ? "Mikrofonen er live. Skift kilde fra listen ovenfor for at hoppe til en anden mikrofon." : "Vælg evt. mikrofon ovenfor og tryk ‘Start live’. Efter tilladelse vises enhedsnavne."}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <input type="file" accept="audio/*" onChange={(e) => e.target.files && loadFile(e.target.files[0])} />
                <div className="flex gap-2">
                  <Button onClick={playFile} disabled={!playerRef.current}>▶️ Afspil</Button>
                  <Button onClick={stopFile} disabled={!playerRef.current}>⏹ Stop</Button>
                </div>
                {fileName ? <p className="text-xs text-neutral-600">Valgt: {fileName} {status === "playing" && "(afspiller)"}</p> : <p className="text-xs text-neutral-500">Ingen fil valgt endnu.</p>}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 p-4 rounded-2xl border bg-white">
          <h2 className="font-semibold">Harmonier</h2>
          <div className="grid grid-cols-2 gap-3">
            {harmonies.map((h) => (
              <div key={h.id} className={`p-3 rounded-xl border ${h.enabled ? "bg-neutral-50" : "bg-white"}`}>
                <div className="flex items-center justify-between">
                  <Toggle checked={h.enabled} onChange={(v) => toggleHarmony(h.id, v)} label={`${h.id} semitoner`} />
                </div>
                <div className="mt-2">
                  <label className="text-xs text-neutral-600">Niveau</label>
                  <Slider value={h.gain.gain.value} onChange={(v) => setHarmonyLevel(h.id, v)} min={0} max={1.5} step={0.01} />
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-neutral-500">Tip: Begynd med +3 og +5 for klassiske 2./3. stemmer, og justér niveauer efter smag.</p>
        </div>
      </section>

      <section className="p-4 rounded-2xl border bg-white space-y-4">
        <h2 className="font-semibold">Optag / Eksport</h2>
        <div className="flex flex-wrap gap-3 items-center">
          {!isRec ? (
            <Button onClick={startRecord} disabled={isStartingRec || (!micRef.current && !playerRef.current)} title={(!micRef.current && !playerRef.current) ? "Start mikrofon eller fil først" : (isStartingRec ? "Starter..." : undefined)}>⏺ Start optag</Button>
          ) : (
            <Button className="bg-red-600 text-white" onClick={stopRecord}>⏹ Stop & gem</Button>
          )}
          <span className="text-xs text-neutral-600 min-w-[60px]">Varighed: {isRec ? formatMMSS(elapsedMs) : "00:00"}</span>
          {isRec && (
            <div className="flex items-center gap-2 text-red-600 text-sm" aria-live="polite" aria-label="Optagelse kører">
              <span className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></span>
              <span>Optager</span>
            </div>
          )}
          {downloadUrl && (
            <div className="flex flex-col gap-2">
              <a href={downloadUrl} download={`harmonylab-${Date.now()}.webm`} className="text-blue-600 underline">Download mix</a>
              <audio ref={audioPreviewRef} src={downloadUrl || undefined} controls className="w-full max-w-md" />
            </div>
          )}
          <DevTests />
        </div>
        <div className="pt-2">
          <Toggle checked={muteDuringRec} onChange={setMuteDuringRec} label="Mute afspilning under optagelse (anti-feedback)" />
          <p className="text-xs text-neutral-500 mt-1">Når dette er slået til, sendes lyden stadig til optageren, men ikke til højttalerne.</p>
        </div>
      </section>

      <section className="p-4 rounded-2xl border bg-white">
        <h2 className="font-semibold mb-2">Niveau-meter</h2>
        <canvas ref={canvasRef} width={800} height={160} className="w-full h-40 bg-neutral-100 rounded-xl" />
      </section>
    </div>
  );
}
