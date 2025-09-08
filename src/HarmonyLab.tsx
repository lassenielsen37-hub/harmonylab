import React, { useEffect, useMemo, useRef, useState } from "react";
import * as Tone from "tone";

// ============================== UI HELPERS ==============================
const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className = "", ...props }) => (
  <button
    className={`px-3 py-2 md:py-1.5 text-sm md:text-base rounded-lg shadow-sm border border-neutral-300 dark:border-neutral-700 hover:shadow transition disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
    {...props}
  />
);

// Studio fader with (optional) dB scale
const Fader: React.FC<{
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  height?: number;
  showScale?: boolean;
}> = ({ value, onChange, min = 0, max = 1.5, step = 0.01, height = 180, showScale = true }) => {
  const labels = ["0 dB", "-3", "-6", "-12", "-24", "-∞"];
  return (
    <div className="flex items-center gap-3" style={{ height }}>
      {/* scale */}
      {showScale && (
        <div className="flex flex-col justify-between h-full text-[10px] text-neutral-500 dark:text-neutral-400 select-none pr-1">
          {labels.map((l) => (
            <span key={l} className="tabular-nums">{l}</span>
          ))}
        </div>
      )}
      {/* fader */}
      <div className="flex flex-col items-center">
        <div className="relative">
          <div className="absolute -inset-2 rounded-lg bg-gradient-to-b from-neutral-200/40 to-neutral-100/10 dark:from-neutral-700/30 dark:to-neutral-800/20" />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            className="relative [appearance:none] w-28 sm:w-36 md:w-40 h-4"
            style={{ transform: "rotate(-90deg)" }}
          />
        </div>
        <div className="text-[10px] text-neutral-500 dark:text-neutral-400 mt-2 tabular-nums">{value.toFixed(2)}</div>
      </div>
    </div>
  );
};

const Toggle: React.FC<{ checked: boolean; onChange: (v: boolean) => void; label: string }> = ({ checked, onChange, label }) => (
  <label className="flex items-center gap-2 select-none cursor-pointer">
    <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    <span>{label}</span>
  </label>
);

const Select: React.FC<{ value: string; onChange: (v: string) => void; options: string[] }> = ({ value, onChange, options }) => (
  <select className="border rounded-xl px-3 py-2 bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700" value={value} onChange={(e) => onChange(e.target.value)}>
    {options.map((o) => (
      <option key={o} value={o}>{o}</option>
    ))}
  </select>
);

// Simple circular potmeter / gauge (read-only, 0..1)
const Pot: React.FC<{ value: number; label?: string }> = ({ value, label = "Input" }) => {
  const v = Math.max(0, Math.min(1, value));
  const size = 88; const stroke = 10; const r = (size - stroke) / 2; const cx = size / 2; const cy = size / 2;
  const deg2rad = (d: number) => (d * Math.PI) / 180;
  const startAngle = deg2rad(140); const endAngle = deg2rad(40);
  const total = endAngle - startAngle; // negative -> clockwise across top
  const angle = startAngle + total * v;
  const pt = (ang: number) => ({ x: cx + r * Math.cos(ang), y: cy + r * Math.sin(ang) });
  const s = pt(startAngle); const e = pt(angle); const eBg = pt(endAngle);
  const bgPath = `M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${eBg.x} ${eBg.y}`;
  const fgPath = `M ${s.x} ${s.y} A ${r} ${r} 0 0 1 ${e.x} ${e.y}`;
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label} niveau`}>
        <path d={bgPath} fill="none" stroke="#3f3f46" className="dark:stroke-neutral-700" strokeWidth={stroke} strokeLinecap="round" />
        <path d={fgPath} fill="none" stroke="#0ea5e9" strokeWidth={stroke} strokeLinecap="round" />
        <circle cx={cx} cy={cy} r={r - 8} className="fill-white dark:fill-neutral-900" />
        <line x1={cx} y1={cy} x2={cx + (r - 14) * Math.cos(angle)} y2={cy + (r - 14) * Math.sin(angle)} className="stroke-neutral-900 dark:stroke-white" strokeWidth={3} strokeLinecap="round" />
      </svg>
      <span className="text-xs text-neutral-600 dark:text-neutral-300 mt-1">{label}</span>
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
  solo: boolean;
  prevLevel: number;
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
  // THEME (dark mode)
  const getInitialTheme = () => {
    try {
      const saved = localStorage.getItem('theme');
      if (saved === 'dark' || saved === 'light') return saved as 'dark'|'light';
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch {}
    return 'light';
  };
  const [theme, setTheme] = useState<'light'|'dark'>(getInitialTheme());
  useEffect(() => { try { localStorage.setItem('theme', theme); } catch {} }, [theme]);

  // UI state (basic)
  const [status, setStatus] = useState<"idle" | "ready" | "live" | "playing">("idle");
  const [sourceMode, setSourceMode] = useState<"mic" | "file">("mic");
  const [selectedKey, setSelectedKey] = useState<string>("C");
  const [scale, setScale] = useState<string>("Dur");
  const [fileName, setFileName] = useState<string>("");

  // Mic selection
  const micRef = useRef<Tone.UserMedia | null>(null);
  const [micDevices, setMicDevices] = useState<MediaDeviceInfo[]>([]);
  const [selectedMicId, setSelectedMicId] = useState<string>("");

  // Audio graph
  const bus = useMemo(() => new Tone.Gain(1), []);
  const dryGain = useMemo(() => new Tone.Gain(0.9), []); // main (hovedstemme)
  const dryDefault = 0.9;
  const analyser = useMemo(() => new Tone.Analyser("fft", 1024), []);
  const meter = useMemo(() => new Tone.Meter(), []);
  const monitorGain = useMemo(() => new Tone.Gain(1), []); // speaker monitor

  // Player (file) and harmonies
  const playerRef = useRef<Tone.Player | null>(null);
  const [harmonies, setHarmonies] = useState<Harmony[]>(() =>
    HARMONY_PRESETS.map((p) => ({
      id: p.id,
      semitones: p.semitones,
      gain: new Tone.Gain(0.7),
      shifter: new Tone.PitchShift({ pitch: p.semitones, windowSize: 0.1, delayTime: 0 }),
      enabled: p.id === "+3" || p.id === "+5",
      solo: false,
      prevLevel: 0.7,
    }))
  );

  // Wire graph once
  useEffect(() => {
    dryGain.connect(bus);
    harmonies.forEach((h) => h.gain.connect(bus));
    // taps
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

  // Visualiser
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    let raf: number;
    const draw = () => {
      const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext("2d"); if (!ctx) return;
      const data = analyser.getValue() as Float32Array;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.beginPath();
      for (let i = 0; i < data.length; i++) {
        const x = (i / (data.length - 1)) * canvas.width;
        const y = (1 - (data[i] + 140) / 140) * canvas.height;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "#a3a3a3"; // visible in dark
      ctx.lineWidth = 1.5; ctx.stroke();
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [analyser]);

  // Attach/Detach helpers
  const attachNode = (node: Tone.ToneAudioNode) => {
    node.connect(dryGain);
    harmonies.forEach((h) => node.connect(h.shifter).connect(h.gain));
  };
  const detachNode = (node: Tone.ToneAudioNode) => {
    try { node.disconnect(); } catch {}
    harmonies.forEach((h) => { try { h.shifter.disconnect(); } catch {}; try { h.gain.disconnect(); } catch {}; });
  };

  const initAudio = async () => { await Tone.start(); setStatus("ready"); };

  // Device enumeration
  const refreshMicDevices = async () => {
    if (!navigator.mediaDevices?.enumerateDevices) return;
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

  // Mic start/stop
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

  // File player
  const loadFile = async (file: File) => {
    await initAudio(); const url = URL.createObjectURL(file); setFileName(file.name);
    if (playerRef.current) { try { detachNode(playerRef.current); playerRef.current.dispose(); } catch {} }
    const player = new Tone.Player({ url, autostart: false, loop: false });
    playerRef.current = player; attachNode(player); setStatus("ready");
  };
  const playFile = async () => { if (!playerRef.current) return; await Tone.start(); playerRef.current.start(); setStatus("playing"); playerRef.current.onstop = () => setStatus("ready"); };
  const stopFile = () => { playerRef.current?.stop(); setStatus("ready"); };

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
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const lastBlobUrlRef = useRef<string | null>(null);

  // Record routing (bus -> recorder). Ensure singleton.
  const ensureRecorder = () => {
    if (!recorderRef.current) {
      const r = new Tone.Recorder();
      recorderRef.current = r;
      try { bus.connect(r); } catch {}
    }
  };
  useEffect(() => () => {
    try { recorderRef.current?.stop(); } catch {}
    try { if (recorderRef.current) bus.disconnect(recorderRef.current); } catch {}
    recorderRef.current?.dispose(); recorderRef.current = null;
    if (lastBlobUrlRef.current) { try { URL.revokeObjectURL(lastBlobUrlRef.current); } catch {} }
  }, [bus]);

  const showToast = (msg: string, ttl = 2500) => { setToast(msg); (showToast as any)._t && clearTimeout((showToast as any)._t); (showToast as any)._t = setTimeout(() => setToast(""), ttl); };
  const formatMMSS = (ms: number) => { const s = Math.floor(ms / 1000); const mm = String(Math.floor(s / 60)).padStart(2,'0'); const ss = String(s % 60).padStart(2,'0'); return `${mm}:${ss}`; };

  // Monitor mute during recording
  useEffect(() => { try { monitorGain.gain.value = (isRec && muteDuringRec) ? 0 : 1; } catch {} }, [isRec, muteDuringRec, monitorGain]);

  // Apply main (dry) mute when solo is active
  const [mainMuted, setMainMuted] = useState(false);
  const dryDefaultRef = useRef(dryDefault);
  useEffect(() => { try { dryGain.gain.value = mainMuted ? 0 : dryDefaultRef.current; } catch {} }, [mainMuted, dryGain]);

  const startRecord = async () => {
    if (isRec || isStartingRec || recStatusRef.current === "recording") return;
    const hasInput = !!micRef.current || !!playerRef.current; if (!hasInput) { showToast("Start en mikrofon eller vælg en fil først."); return; }
    try { audioPreviewRef.current?.pause(); } catch {}
    setIsStartingRec(true); setDownloadUrl(null);
    try {
      ensureRecorder(); await Tone.start(); await recorderRef.current?.start();
      recStatusRef.current = "recording"; setIsRec(true);
      recStartRef.current = Date.now(); setElapsedMs(0);
      tickRef.current = window.setInterval(() => { if (recStartRef.current) setElapsedMs(Date.now() - recStartRef.current); }, 200) as unknown as number;
      showToast("Optager…");
    } catch (e:any) { const msg = e?.message || String(e); if (!msg.toLowerCase().includes("already started")) showToast("Kunne ikke starte optagelse: " + msg, 4000); }
    finally { setIsStartingRec(false); }
  };
  const stopRecord = async () => {
    if (!isRec && recStatusRef.current !== "recording") return;
    recStatusRef.current = "stopping"; showToast("Stopper og forbereder fil…");
    try {
      const blob = await recorderRef.current?.stop();
      if (blob) {
        const url = URL.createObjectURL(blob);
        if (lastBlobUrlRef.current) { try { URL.revokeObjectURL(lastBlobUrlRef.current); } catch {} }
        lastBlobUrlRef.current = url; setDownloadUrl(url);
        showToast("Optagelse klar.", 3000);
      }
    } catch { showToast("Kunne ikke stoppe optagelse.", 4000); }
    finally {
      recStatusRef.current = "idle"; setIsRec(false);
      recStartRef.current = null; if (tickRef.current) { clearInterval(tickRef.current); tickRef.current = null; }
    }
  };

  // Input level for pot
  const [inputLevel, setInputLevel] = useState(0);
  useEffect(() => {
    let id: number; const sample = () => { const db = meter.getValue(); const norm = Number.isFinite(db) ? Math.max(0, Math.min(1, (db + 60) / 60)) : 0; setInputLevel(norm); id = requestAnimationFrame(sample); };
    id = requestAnimationFrame(sample); return () => cancelAnimationFrame(id);
  }, [meter]);

  // ============================== SOLO / HARMONY CONTROL ==============================
  const toggleHarmonyEnabled = (id: string, on: boolean) => {
    setHarmonies((prev) => prev.map((h) => {
      if (h.id === id) {
        if (on) { h.gain.gain.value = h.prevLevel; h.enabled = true; }
        else { h.prevLevel = h.gain.gain.value as number; h.gain.gain.value = 0; h.enabled = false; }
        return { ...h };
      }
      return h;
    }));
  };

  // Dry channel level and mute
  const [dryPrev, setDryPrev] = useState(dryDefault);
  const setMainLevel = (v: number) => { setDryPrev(v); try { dryGain.gain.value = v; dryDefaultRef.current = v; } catch {} };
  const toggleMainMute = () => setMainMuted((m) => {
    if (!m) { setDryPrev(dryGain.gain.value as number); try { dryGain.gain.value = 0; } catch {} return true; }
    try { dryGain.gain.value = dryPrev; } catch {} return false;
  });

  // Solo logic
  const soloNone = () => {
    setHarmonies((prev) => prev.map((h) => { h.solo = false; h.gain.gain.value = h.prevLevel; return { ...h }; }));
    setMainMuted(false);
  };
  const soloDry = () => {
    setHarmonies((prev) => prev.map((h) => { h.solo = false; h.gain.gain.value = 0; return { ...h }; }));
    setMainMuted(false);
  };
  const toggleSolo = (id: string) => {
    setHarmonies((prev) => {
      const target = prev.find((h) => h.id === id);
      const turningOff = !!target?.solo;
      const next = prev.map((h) => {
        if (turningOff) { h.solo = false; h.gain.gain.value = h.prevLevel; return { ...h }; }
        if (h.id === id) { h.solo = true; h.gain.gain.value = h.prevLevel; return { ...h }; }
        h.solo = false; h.gain.gain.value = 0; return { ...h };
      });
      setMainMuted(!turningOff);
      return next;
    });
  };

  const setHarmonyLevel = (id: string, level: number) => {
    setHarmonies((prev) => prev.map((h) => {
      if (h.id === id) { h.prevLevel = level; h.gain.gain.value = level; return { ...h }; }
      return h;
    }));
  };

  // Helpers for button styles
  const btnMute = (active: boolean) => active ? "bg-amber-600 text-white border-amber-700" : "bg-transparent";
  const btnSolo = (active: boolean) => active ? "bg-blue-600 text-white border-blue-700" : "bg-transparent";

  // ============================== UI ==============================
  return (
    <div className={theme === 'dark' ? 'dark' : ''}>
      <div className="min-h-screen p-4 md:p-6 max-w-7xl mx-auto space-y-6 bg-neutral-50 text-neutral-900 dark:bg-black dark:text-neutral-100">
        {toast && (
          <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-black text-white text-sm px-4 py-2 rounded-xl shadow dark:bg-neutral-800">{toast}</div>
        )}
        {/* Theme toggle */}
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="fixed top-4 right-4 z-50 px-3 py-2 rounded-lg border border-neutral-300 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/80 backdrop-blur text-sm">
          {theme === 'dark' ? '🌞 Lys' : '🌙 Mørk'}
        </button>

        {/* TOP BAR */}
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold">HarmonyLab</h1>
            <p className="text-sm text-neutral-600 dark:text-neutral-400">Studio-mixer visning (Dark)</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex"><Pot value={inputLevel} label="Input" /></div>
            <div className="grid grid-cols-2 gap-2">
              <div className="text-xs text-neutral-600 dark:text-neutral-400 col-span-2">Toneart</div>
              <Select value={selectedKey} onChange={setSelectedKey} options={KEYS} />
              <Select value={scale} onChange={setScale} options={["Dur","Mol"]} />
            </div>
          </div>
        </header>

        {/* TRANSPORT */}
        <section className="p-3 rounded-2xl border bg-white/95 dark:bg-neutral-900/90 dark:border-neutral-800 backdrop-blur sticky bottom-0 z-40 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Button onClick={startRecord} disabled={isRec || (!micRef.current && !playerRef.current)}>⏺ Optag</Button>
            <Button onClick={stopRecord} disabled={!isRec} className="bg-red-600 text-white">⏹ Stop</Button>
            <span className="text-xs text-neutral-600 dark:text-neutral-400">{isRec ? `Optager ${formatMMSS(elapsedMs)}` : "Idle"}</span>
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <Toggle checked={muteDuringRec} onChange={setMuteDuringRec} label="Mute monitor under optag" />
            {downloadUrl && (
              <div className="flex items-center gap-2">
                <a href={downloadUrl} download={`harmonylab-${Date.now()}.webm`} className="text-blue-600 dark:text-blue-400 underline">Download</a>
                <audio ref={audioPreviewRef} src={downloadUrl || undefined} controls className="w-40 sm:w-56" />
              </div>
            )}
          </div>
        </section>

        {/* MIXER */}
        <section className="p-4 rounded-2xl border bg-white dark:bg-neutral-950 dark:border-neutral-800">
          <h2 className="font-semibold mb-3">Mixer</h2>
          <div className="overflow-x-auto">
            <div className="min-w-[560px] sm:min-w-[700px] md:min-w-[760px] grid grid-flow-col auto-cols-[120px] sm:auto-cols-[150px] md:auto-cols-[160px] gap-3 sm:gap-4 overscroll-x-contain">
              {/* DRY CHANNEL */}
              <div className="rounded-xl border p-3 bg-neutral-900/60 dark:bg-neutral-900/60 dark:border-neutral-800 flex flex-col items-stretch">
                <div className="text-sm font-semibold text-center">Main</div>
                <div className="text-[11px] text-neutral-400 text-center mb-2">Hovedstemme</div>
                <div className="flex-1 flex items-center justify-center"><Fader value={Number(dryGain.gain.value)} onChange={(v)=>{try{dryGain.gain.value=v; dryDefaultRef.current=v;}catch{}}} max={1.5} /></div>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Button onClick={toggleMainMute} className={btnMute(mainMuted)}>M</Button>
                  <Button onClick={() => (soloNone(), soloDry())} className={btnSolo(false)}>S</Button>
                </div>
              </div>

              {/* SOURCE CHANNEL */}
              <div className="rounded-xl border p-3 bg-neutral-900/40 dark:bg-neutral-900/40 dark:border-neutral-800 flex flex-col items-stretch">
                <div className="text-sm font-semibold text-center">Kilde</div>
                <div className="text-[11px] text-neutral-400 text-center mb-2">Mic / Lydfil</div>
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <Button className={sourceMode === "mic" ? "bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white" : ""} onClick={() => setSourceMode("mic")}>Mic</Button>
                    <Button className={sourceMode === "file" ? "bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white" : ""} onClick={() => setSourceMode("file")}>Fil</Button>
                  </div>
                  {sourceMode === "mic" ? (
                    <div className="flex flex-col gap-2">
                      <select className="border rounded-xl px-3 py-2 bg-white dark:bg-neutral-900 border-neutral-300 dark:border-neutral-700" value={selectedMicId} onChange={(e) => setSelectedMicId(e.target.value)} onFocus={() => refreshMicDevices()}>
                        <option value="">Systemstandard</option>
                        {micDevices.map((d, i) => (<option key={d.deviceId || i} value={d.deviceId}>{d.label || `Mikrofon ${i+1}`}</option>))}
                      </select>
                      <div className="flex gap-2">
                        {status !== "live" ? (
                          <Button onClick={startMic}>🎤 Start</Button>
                        ) : (
                          <Button className="bg-red-600 text-white" onClick={stopMic}>⏹ Stop</Button>
                        )}
                        <Button onClick={refreshMicDevices}>Opdater</Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <input type="file" accept="audio/*" onChange={(e) => e.target.files && loadFile(e.target.files[0])} />
                      <div className="flex gap-2">
                        <Button onClick={playFile} disabled={!playerRef.current}>▶️ Afspil</Button>
                        <Button onClick={stopFile} disabled={!playerRef.current}>⏹ Stop</Button>
                      </div>
                      {fileName && <div className="text-[11px] text-neutral-400 text-center truncate">{fileName}</div>}
                    </div>
                  )}
                </div>
              </div>

              {/* HARMONY CHANNELS */}
              {harmonies.map((h) => (
                <div key={h.id} className={`rounded-xl border p-3 ${h.solo ? 'bg-blue-900/40' : h.enabled ? 'bg-neutral-900/40' : 'bg-neutral-900/20'} dark:border-neutral-800 flex flex-col items-stretch`}>
                  <div className="text-sm font-semibold text-center">{h.id}</div>
                  <div className="text-[11px] text-neutral-400 text-center mb-2">{h.semitones===3?'L.t. op':h.semitones===7?'Kvint op':h.semitones===-3?'L.t. ned':'Kvint ned'}</div>
                  <div className="flex-1 flex items-center justify-center"><Fader value={Number(h.gain.gain.value)} onChange={(v)=>setHarmonyLevel(h.id, v)} max={1.5} /></div>
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <Button onClick={() => toggleHarmonyEnabled(h.id, !h.enabled)} className={btnMute(!h.enabled)}>M</Button>
                    <Button onClick={() => toggleSolo(h.id)} className={btnSolo(h.solo)}>S</Button>
                  </div>
                </div>
              ))}

              {/* MASTER */}
              <div className="rounded-xl border p-3 bg-neutral-900/60 dark:bg-neutral-900/60 dark:border-neutral-800 flex flex-col items-stretch">
                <div className="text-sm font-semibold text-center">Master</div>
                <div className="text-[11px] text-neutral-400 text-center mb-2">Monitor</div>
                <div className="flex-1 flex items-center justify-center"><Fader value={Number(monitorGain.gain.value)} onChange={(v)=>{try{monitorGain.gain.value=v;}catch{}}} max={1.2} /></div>
                <div className="flex items-center justify-center gap-2 mt-3">
                  <Toggle checked={muteDuringRec} onChange={setMuteDuringRec} label="Mute under optag" />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ANALYSER */}
        <section className="p-4 rounded-2xl border bg-white dark:bg-neutral-950 dark:border-neutral-800 hidden sm:block">
          <h2 className="font-semibold mb-2">Niveau-meter</h2>
          <canvas ref={canvasRef} width={1100} height={160} className="w-full h-40 bg-neutral-100 dark:bg-neutral-900 rounded-xl" />
        </section>
      </div>
    </div>
  );
}
